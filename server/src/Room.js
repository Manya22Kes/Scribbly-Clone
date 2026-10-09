import Player from './Player.js'
import Game from './Game.js'
import { categories, languages } from './words.js'
import { clamp, cleanWordList } from './utils.js'

export const WORD_MODES = ['normal', 'hidden', 'combination']
export const REPORT_REASONS = ['Offensive name', 'Spam', 'Revealing the word', 'Inappropriate drawing', 'Other']
export const AVATAR_COUNT = 12
const MAX_SPECTATORS = 20

export const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  category: 'all',
  language: 'en',
  customWords: [],
  customOnly: false,
}

export function sanitizeSettings(input = {}, current = DEFAULT_SETTINGS) {
  const merged = { ...current, ...input }
  return {
    maxPlayers: clamp(merged.maxPlayers, 2, 20, DEFAULT_SETTINGS.maxPlayers),
    rounds: clamp(merged.rounds, 2, 10, DEFAULT_SETTINGS.rounds),
    drawTime: clamp(merged.drawTime, 15, 240, DEFAULT_SETTINGS.drawTime),
    wordCount: clamp(merged.wordCount, 1, 5, DEFAULT_SETTINGS.wordCount),
    hints: clamp(merged.hints, 0, 5, DEFAULT_SETTINGS.hints),
    wordMode: WORD_MODES.includes(merged.wordMode) ? merged.wordMode : 'normal',
    category: categories.includes(merged.category) ? merged.category : 'all',
    language: languages.includes(merged.language) ? merged.language : 'en',
    customWords: cleanWordList(merged.customWords),
    customOnly: Boolean(merged.customOnly),
  }
}

export default class Room {
  constructor(io, id, settings, isPrivate, onEmpty) {
    this.io = io
    this.id = id
    this.settings = settings
    this.isPrivate = isPrivate
    this.onEmpty = onEmpty
    this.players = new Map()
    this.spectators = new Map()
    this.banned = new Set()
    this.votes = new Map()
    this.reports = []
    this.hostId = null
    this.game = null
  }

  get isFull() {
    return this.players.size >= this.settings.maxPlayers
  }

  get spectatorsFull() {
    return this.spectators.size >= MAX_SPECTATORS
  }

  get isOpenForQuickPlay() {
    return !this.isPrivate && !this.game && !this.isFull
  }

  audience() {
    return [...this.players.keys(), ...this.spectators.keys()]
  }

  emitAll(event, payload) {
    this.audience().forEach((id) => this.io.to(id).emit(event, payload))
  }

  publicPlayer(player) {
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      ready: player.ready,
      hasGuessed: player.hasGuessed,
    }
  }

  publicPlayers() {
    return [...this.players.values()].map((p) => this.publicPlayer(p))
  }

  addPlayer(socketId, name, avatar, ip) {
    const player = new Player(socketId, name, avatar, ip)
    this.players.set(socketId, player)
    if (!this.hostId) this.hostId = socketId
    this.say('system', `${name} joined the room`)
    this.emitAll('player_joined', { player: this.publicPlayer(player), players: this.publicPlayers() })
    this.broadcastState()
    return player
  }

  addSpectator(socketId, name, avatar, ip) {
    const spectator = new Player(socketId, name, avatar, ip)
    this.spectators.set(socketId, spectator)
    this.say('system', `${name} is watching`)
    this.broadcastState()
    return spectator
  }

  removeMember(socketId) {
    if (this.spectators.has(socketId)) {
      const spectator = this.spectators.get(socketId)
      this.spectators.delete(socketId)
      this.say('system', `${spectator.name} stopped watching`)
      this.broadcastState()
      return
    }
    this.removePlayer(socketId)
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId)
    if (!player) return
    this.players.delete(socketId)
    this.votes.delete(socketId)
    this.votes.forEach((voters) => voters.delete(socketId))

    if (this.players.size === 0) {
      if (this.game) this.game.stop()
      this.spectators.forEach((_, id) => this.io.to(id).emit('kicked', 'The room was closed'))
      this.onEmpty(this.id)
      return
    }

    if (this.hostId === socketId) {
      this.hostId = this.players.keys().next().value
      this.say('system', `${this.players.get(this.hostId).name} is now the host`)
    }
    this.say('system', `${player.name} left the room`)
    this.emitAll('player_left', { playerId: socketId, players: this.publicPlayers() })
    if (this.game) this.game.playerLeft(socketId)
    this.broadcastState()
  }

  findMember(id) {
    return this.players.get(id) ?? this.spectators.get(id) ?? null
  }

  setReady(socketId, value) {
    const player = this.players.get(socketId)
    if (!player || this.game) return
    player.ready = Boolean(value)
    this.broadcastState()
  }

  get allReady() {
    return [...this.players.values()].every((p) => p.id === this.hostId || p.ready)
  }

  updateSettings(input) {
    this.settings = sanitizeSettings(input, this.settings)
    this.broadcastState()
  }

  startGame() {
    this.game = new Game(this)
    this.game.start()
  }

  endGame() {
    if (this.game) this.game.stop()
    this.game = null
    this.players.forEach((p) => {
      p.score = 0
      p.hasGuessed = false
      p.ready = false
    })
    this.broadcastState()
  }

  voteKick(voterId, targetId) {
    const voter = this.players.get(voterId)
    const target = this.players.get(targetId)
    if (!voter || !target || voterId === targetId) return { error: 'You cannot vote on that player' }
    if (this.players.size < 3) return { error: 'Votekick needs at least 3 players' }
    const voters = this.votes.get(targetId) ?? new Set()
    if (voters.has(voterId)) return { error: 'You already voted for this player' }
    voters.add(voterId)
    this.votes.set(targetId, voters)
    const needed = Math.floor((this.players.size - 1) / 2) + 1
    this.say('system', `${voter.name} voted to kick ${target.name} (${voters.size}/${needed})`)
    return { passed: voters.size >= needed }
  }

  report(reporterId, targetId, reason) {
    const reporter = this.players.get(reporterId)
    const target = this.players.get(targetId)
    if (!reporter || !target || reporterId === targetId) return { error: 'You cannot report that player' }
    if (!REPORT_REASONS.includes(reason)) return { error: 'Pick a report reason' }
    const duplicate = this.reports.some((r) => r.by === reporterId && r.target === targetId && r.reason === reason)
    if (duplicate) return { error: 'You already reported this' }
    this.reports.push({ by: reporterId, target: targetId, reason, at: Date.now() })
    console.log(`[report] room ${this.id}: ${reporter.name} reported ${target.name} (${reason})`)
    if (reporterId !== this.hostId) {
      this.say('system', `${reporter.name} reported ${target.name}: ${reason}`, null, [this.hostId])
    }
    this.say('system', `Your report about ${target.name} was sent`, null, [reporterId])
    return {}
  }

  say(kind, text, from = null, to = null) {
    const payload = {
      kind,
      text,
      playerId: from ? from.id : null,
      playerName: from ? from.name : null,
    }
    const recipients = to ?? this.audience()
    recipients.forEach((id) => this.io.to(id).emit('chat_message', payload))
  }

  snapshotFor(viewer) {
    const drawerId = this.game ? this.game.drawerId : null
    const base = {
      roomId: this.id,
      isPrivate: this.isPrivate,
      hostId: this.hostId,
      you: viewer.id,
      isSpectator: this.spectators.has(viewer.id),
      settings: this.settings,
      phase: 'lobby',
      round: 0,
      totalRounds: this.settings.rounds,
      hasReplay: Boolean(this.game && this.game.lastDrawing),
      players: [...this.players.values()].map((p) => ({
        ...this.publicPlayer(p),
        isDrawer: p.id === drawerId,
      })),
      spectators: [...this.spectators.values()].map((s) => ({ id: s.id, name: s.name, avatar: s.avatar })),
    }
    if (!this.game) return base
    return { ...base, ...this.game.viewFor(viewer) }
  }

  broadcastState() {
    this.players.forEach((player, id) => this.io.to(id).emit('game_state', this.snapshotFor(player)))
    this.spectators.forEach((spectator, id) => this.io.to(id).emit('game_state', this.snapshotFor(spectator)))
  }
}
