import { pickWords } from './words.js'
import { normalize, isClose, maskWord, graphemes } from './utils.js'

const CHOOSE_MS = 15000
const TURN_END_MS = 4000
const MAX_STROKES = 400
const MAX_POINTS = 4000

export default class Game {
  constructor(room) {
    this.room = room
    this.phase = 'choosing'
    this.round = 1
    this.order = []
    this.turnIndex = -1
    this.drawerId = null
    this.word = null
    this.chars = []
    this.wordOptions = []
    this.revealed = new Set()
    this.hintsGiven = 0
    this.endsAt = null
    this.strokes = []
    this.gains = new Map()
    this.result = null
    this.lastDrawing = null
    this.timers = {}
  }

  get settings() {
    return this.room.settings
  }

  get drawer() {
    return this.room.players.get(this.drawerId)
  }

  start() {
    this.room.players.forEach((p) => {
      p.score = 0
      p.hasGuessed = false
    })
    this.order = [...this.room.players.keys()]
    this.advance()
  }

  stop() {
    this.clearTimers()
  }

  clearTimers() {
    clearTimeout(this.timers.choose)
    clearTimeout(this.timers.turn)
    clearTimeout(this.timers.next)
    clearInterval(this.timers.hint)
    this.timers = {}
  }

  advance() {
    this.clearTimers()
    this.turnIndex += 1
    while (
      this.turnIndex < this.order.length &&
      !this.room.players.has(this.order[this.turnIndex])
    ) {
      this.turnIndex += 1
    }
    if (this.turnIndex >= this.order.length) {
      this.round += 1
      if (this.round > this.settings.rounds) return this.finish()
      this.order = [...this.room.players.keys()]
      this.turnIndex = 0
    }
    this.beginChoosing(this.order[this.turnIndex])
  }

  peekNextDrawer() {
    let i = this.turnIndex + 1
    while (i < this.order.length && !this.room.players.has(this.order[i])) i += 1
    if (i < this.order.length) return this.order[i]
    if (this.round >= this.settings.rounds) return null
    return this.room.players.keys().next().value ?? null
  }

  beginChoosing(drawerId) {
    this.drawerId = drawerId
    this.phase = 'choosing'
    this.word = null
    this.chars = []
    this.result = null
    this.strokes = []
    this.revealed = new Set()
    this.hintsGiven = 0
    this.gains = new Map()
    this.wordOptions = pickWords(this.settings.wordCount, {
      language: this.settings.language,
      category: this.settings.category,
      customWords: this.settings.customWords,
      customOnly: this.settings.customOnly,
      combination: this.settings.wordMode === 'combination',
    })
    this.endsAt = Date.now() + CHOOSE_MS
    this.room.players.forEach((p) => {
      p.hasGuessed = false
    })
    this.timers.choose = setTimeout(() => {
      const pick = this.wordOptions[Math.floor(Math.random() * this.wordOptions.length)]
      this.beginDrawing(pick)
    }, CHOOSE_MS)
    this.room.emitAll('canvas_sync', { strokes: [] })
    this.room.audience().forEach((id) => {
      this.room.io.to(id).emit('round_start', {
        drawerId,
        drawTime: this.settings.drawTime,
        wordOptions: id === drawerId ? this.wordOptions : null,
      })
    })
    this.room.broadcastState()
  }

  chooseWord(playerId, word) {
    if (this.phase !== 'choosing' || playerId !== this.drawerId) return
    if (!this.wordOptions.includes(word)) return
    this.beginDrawing(word)
  }

  beginDrawing(word) {
    clearTimeout(this.timers.choose)
    this.word = word
    this.chars = graphemes(word)
    this.phase = 'drawing'
    const total = this.settings.drawTime * 1000
    this.endsAt = Date.now() + total
    this.timers.turn = setTimeout(() => this.endTurn(), total)
    this.startHints(total)
    this.room.broadcastState()
  }

  startHints(total) {
    const letters = this.chars.filter((c) => c !== ' ').length
    const limit = Math.min(this.settings.hints, letters - 1)
    if (this.settings.wordMode === 'hidden' || limit <= 0) return
    const step = total / (this.settings.hints + 1)
    this.timers.hint = setInterval(() => {
      if (this.phase !== 'drawing') return
      const hidden = []
      this.chars.forEach((c, i) => {
        if (c !== ' ' && !this.revealed.has(i)) hidden.push(i)
      })
      if (hidden.length === 0 || this.hintsGiven >= limit) {
        clearInterval(this.timers.hint)
        return
      }
      this.revealed.add(hidden[Math.floor(Math.random() * hidden.length)])
      this.hintsGiven += 1
      this.room.broadcastState()
    }, step)
  }

  addGain(player, points) {
    player.score += points
    const entry = this.gains.get(player.id) || { id: player.id, name: player.name, points: 0 }
    entry.points += points
    this.gains.set(player.id, entry)
  }

  onMessage(player, rawText) {
    const text = String(rawText ?? '').trim().slice(0, 100)
    if (!text) return

    if (this.phase !== 'drawing') {
      this.room.say('chat', text, player)
      return
    }

    const knowers = [...this.room.players.values()]
      .filter((p) => p.id === this.drawerId || p.hasGuessed)
      .map((p) => p.id)

    if (player.id === this.drawerId || player.hasGuessed) {
      this.room.say('chat', text, player, knowers)
      return
    }

    const language = this.settings.language
    const guess = normalize(text, language)
    const word = normalize(this.word, language)

    if (guess === word) {
      this.acceptGuess(player)
      return
    }

    this.room.io.to(player.id).emit('guess_result', {
      correct: false,
      playerId: player.id,
      playerName: player.name,
      points: 0,
    })

    if (isClose(guess, word)) {
      this.room.say('close', `"${text}" is close!`, null, [player.id])
      return
    }

    this.room.say('chat', text, player)
  }

  acceptGuess(player) {
    const total = this.settings.drawTime * 1000
    const left = Math.max(0, this.endsAt - Date.now())
    const points = Math.round(50 + 450 * (left / total))
    player.hasGuessed = true
    this.addGain(player, points)
    if (this.drawer) this.addGain(this.drawer, 50)
    this.room.emitAll('guess_result', {
      correct: true,
      playerId: player.id,
      playerName: player.name,
      points,
    })
    this.room.say('correct', `${player.name} guessed the word!`)
    this.room.broadcastState()
    this.checkAllGuessed()
  }

  checkAllGuessed() {
    if (this.phase !== 'drawing') return
    const guessers = [...this.room.players.values()].filter((p) => p.id !== this.drawerId)
    if (guessers.length > 0 && guessers.every((p) => p.hasGuessed)) this.endTurn()
  }

  endTurn() {
    if (this.phase !== 'drawing') return
    this.clearTimers()
    this.phase = 'turn_end'
    this.result = {
      word: this.word,
      gains: [...this.gains.values()].sort((a, b) => b.points - a.points),
    }
    this.lastDrawing = {
      word: this.word,
      drawerName: this.drawer ? this.drawer.name : 'Someone',
      strokes: this.strokes.map(({ color, size, points }) => ({ color, size, points })),
    }
    this.endsAt = Date.now() + TURN_END_MS
    this.timers.next = setTimeout(() => this.advance(), TURN_END_MS)
    this.room.emitAll('round_end', {
      word: this.word,
      scores: this.leaderboard(),
      nextDrawer: this.peekNextDrawer(),
    })
    this.room.broadcastState()
  }

  finish() {
    this.clearTimers()
    this.phase = 'game_over'
    this.drawerId = null
    this.endsAt = null
    const board = this.leaderboard()
    this.room.emitAll('game_over', { winner: board[0] ?? null, leaderboard: board })
    this.room.broadcastState()
  }

  abort() {
    this.stop()
    this.room.game = null
    this.room.players.forEach((p) => {
      p.score = 0
      p.hasGuessed = false
      p.ready = false
    })
    this.room.say('system', 'Not enough players, back to the lobby')
  }

  playerLeft(id) {
    if (this.room.players.size < 2) {
      this.abort()
      return
    }
    if (id === this.drawerId) {
      if (this.phase === 'drawing') {
        this.endTurn()
      } else if (this.phase === 'choosing') {
        this.room.say('system', 'The drawer left, skipping this turn')
        this.advance()
      }
      return
    }
    if (this.phase === 'drawing') this.checkAllGuessed()
  }

  leaderboard() {
    return [...this.room.players.values()]
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score }))
      .sort((a, b) => b.score - a.score)
  }

  viewFor(viewer) {
    const isDrawer = viewer.id === this.drawerId
    const knows = isDrawer || viewer.hasGuessed
    const drawing = this.phase === 'drawing'
    const hidden = this.settings.wordMode === 'hidden'
    return {
      phase: this.phase,
      round: this.round,
      drawerId: this.drawerId,
      timeLeft: this.endsAt ? Math.max(0, this.endsAt - Date.now()) : null,
      word: drawing && knows ? this.word : null,
      mask: drawing && !knows && !hidden ? maskWord(this.word, this.revealed) : null,
      wordOptions: this.phase === 'choosing' && isDrawer ? this.wordOptions : null,
      result: this.phase === 'turn_end' ? this.result : null,
      leaderboard: this.phase === 'game_over' ? this.leaderboard() : null,
    }
  }

  syncCanvasTo(socketId) {
    this.room.io.to(socketId).emit('canvas_sync', { strokes: this.strokes })
  }

  canDraw(socketId) {
    return this.phase === 'drawing' && socketId === this.drawerId
  }

  drawStart(socketId, data) {
    if (!this.canDraw(socketId) || this.strokes.length >= MAX_STROKES) return
    const x = Number(data?.x)
    const y = Number(data?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const size = Math.min(40, Math.max(1, Number(data.size) || 4))
    const color = /^#[0-9a-fA-F]{3,8}$/.test(data.color) ? data.color : '#000000'
    this.strokes.push({ color, size, points: [[x, y]] })
    this.broadcastDraw(socketId, { kind: 'start', x, y, color, size })
  }

  drawMove(socketId, data) {
    if (!this.canDraw(socketId)) return
    const stroke = this.strokes[this.strokes.length - 1]
    const x = Number(data?.x)
    const y = Number(data?.y)
    if (!stroke || stroke.closed || stroke.points.length >= MAX_POINTS) return
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    stroke.points.push([x, y])
    this.broadcastDraw(socketId, { kind: 'move', x, y })
  }

  drawEnd(socketId) {
    if (!this.canDraw(socketId)) return
    const stroke = this.strokes[this.strokes.length - 1]
    if (stroke) stroke.closed = true
    this.broadcastDraw(socketId, { kind: 'end' })
  }

  undo(socketId) {
    if (!this.canDraw(socketId)) return
    this.strokes.pop()
    this.pushCanvas()
  }

  clearCanvas(socketId) {
    if (!this.canDraw(socketId)) return
    this.strokes = []
    this.pushCanvas()
  }

  broadcastDraw(fromId, payload) {
    this.room.emitAll('draw_data', { ...payload, playerId: fromId })
  }

  pushCanvas() {
    const strokes = this.strokes.map(({ color, size, points }) => ({ color, size, points }))
    this.room.emitAll('canvas_sync', { strokes })
  }
}
