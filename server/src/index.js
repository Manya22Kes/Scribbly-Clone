import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { Server } from 'socket.io'
import Room, { AVATAR_COUNT, DEFAULT_SETTINGS, sanitizeSettings } from './Room.js'
import { roomCode, cleanName, clamp } from './utils.js'

const PORT = process.env.PORT || 3001
const here = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.resolve(here, '../../client/dist')

const app = express()
const server = http.createServer(app)
// Only needed when the client is hosted on another origin (e.g. Vercel).
const clientOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)
const io = new Server(server, {
  maxHttpBufferSize: 1e5,
  ...(clientOrigins.length > 0 && { cors: { origin: clientOrigins } }),
})
const rooms = new Map()

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }))
app.use(express.static(clientDir))
app.use((_req, res, next) => {
  res.sendFile(path.join(clientDir, 'index.html'), (err) => {
    if (err) next(err)
  })
})
app.use((err, _req, res, _next) => {
  console.error(err)
  if (err.code === 'ENOENT' || err.status === 404) return res.status(503).send('Client build not found. Run npm run build.')
  res.status(500).send('Internal server error')
})

function createRoom(settings, isPrivate) {
  let id = roomCode()
  while (rooms.has(id)) id = roomCode()
  const room = new Room(io, id, settings, isPrivate, (roomId) => rooms.delete(roomId))
  rooms.set(id, room)
  return room
}

function enter(socket, room, name, avatar, spectate = false) {
  socket.join(room.id)
  socket.data.roomId = room.id
  const safeAvatar = clamp(avatar, 0, AVATAR_COUNT - 1, 0)
  if (spectate) room.addSpectator(socket.id, name, safeAvatar, socket.data.ip)
  else room.addPlayer(socket.id, name, safeAvatar, socket.data.ip)
}

function leave(socket) {
  const room = rooms.get(socket.data.roomId)
  socket.data.roomId = null
  if (room) {
    socket.leave(room.id)
    room.removeMember(socket.id)
  }
}

function removeByForce(targetId, message) {
  const target = io.sockets.sockets.get(targetId)
  if (!target) return
  target.emit('kicked', message)
  leave(target)
}

const CHAT_WINDOW_MS = 3000
const CHAT_LIMIT = 6

io.on('connection', (socket) => {
  // A malformed payload must never take the whole server down.
  const register = socket.on.bind(socket)
  socket.on = (event, handler) =>
    register(event, (...args) => {
      try {
        handler(...args)
      } catch (err) {
        console.error(`handler error for ${event}: ${err.message}`)
      }
    })

  let chatTimes = []
  const forwarded = socket.handshake.headers['x-forwarded-for']
  socket.data.ip = String(forwarded ?? socket.handshake.address).split(',')[0].trim()

  const fail = (message) => socket.emit('error_msg', message)
  const current = () => rooms.get(socket.data.roomId)

  const hostRoom = () => {
    const room = current()
    return room && room.hostId === socket.id ? room : null
  }

  const handleText = (text) => {
    const room = current()
    const clean = String(text ?? '').trim().slice(0, 100)
    if (!room || !clean) return
    const now = Date.now()
    chatTimes = chatTimes.filter((t) => now - t < CHAT_WINDOW_MS)
    if (chatTimes.length >= CHAT_LIMIT) return fail('You are sending messages too fast')
    chatTimes.push(now)
    const spectator = room.spectators.get(socket.id)
    if (spectator) {
      room.say('chat', clean, spectator, [...room.spectators.keys()])
      return
    }
    const player = room.players.get(socket.id)
    if (!player) return
    if (room.game) room.game.onMessage(player, clean)
    else room.say('chat', clean, player)
  }

  socket.on('create_room', ({ hostName, settings, isPrivate, avatar } = {}) => {
    const name = cleanName(hostName)
    if (!name) return fail('Please enter a name')
    if (current()) leave(socket)
    const room = createRoom(sanitizeSettings(settings), Boolean(isPrivate))
    enter(socket, room, name, avatar)
  })

  socket.on('join_room', ({ roomId, playerName, avatar, spectate } = {}) => {
    const name = cleanName(playerName)
    if (!name) return fail('Please enter a name')
    const room = rooms.get(String(roomId ?? '').trim().toUpperCase())
    if (!room) return fail('Room not found')
    if (room.banned.has(socket.data.ip)) return fail('You are banned from this room')
    if (spectate) {
      if (room.spectatorsFull) return fail('Too many spectators in this room')
    } else if (room.isFull) {
      return fail('Room is full')
    }
    if (current()) leave(socket)
    enter(socket, room, name, avatar, Boolean(spectate))
  })

  socket.on('quick_play', ({ playerName, avatar } = {}) => {
    const name = cleanName(playerName)
    if (!name) return fail('Please enter a name')
    if (current()) leave(socket)
    const open = [...rooms.values()].find((r) => r.isOpenForQuickPlay && !r.banned.has(socket.data.ip))
    enter(socket, open || createRoom({ ...DEFAULT_SETTINGS }, false), name, avatar)
  })

  socket.on('leave_room', () => leave(socket))

  socket.on('ready', ({ ready } = {}) => current()?.setReady(socket.id, ready))

  socket.on('update_settings', (settings) => {
    const room = hostRoom()
    if (room && !room.game) room.updateSettings(settings)
  })

  socket.on('start_game', () => {
    const room = hostRoom()
    if (!room || room.game) return
    if (room.players.size < 2) return fail('You need at least 2 players to start')
    if (!room.allReady) return fail('Everyone has to be ready first')
    room.startGame()
  })

  socket.on('back_to_lobby', () => {
    const room = hostRoom()
    if (room && room.game && room.game.phase === 'game_over') room.endGame()
  })

  socket.on('word_chosen', ({ word } = {}) => {
    const room = current()
    if (room && room.game) room.game.chooseWord(socket.id, word)
  })

  socket.on('guess', ({ text } = {}) => handleText(text))
  socket.on('chat', ({ text } = {}) => handleText(text))

  socket.on('kick_player', ({ playerId } = {}) => {
    const room = hostRoom()
    const target = room?.players.get(playerId)
    if (!room || !target || playerId === socket.id) return
    room.say('system', `${target.name} was kicked by the host`)
    removeByForce(playerId, 'You were kicked from the room')
  })

  socket.on('ban_player', ({ playerId } = {}) => {
    const room = hostRoom()
    const target = room?.players.get(playerId)
    if (!room || !target || playerId === socket.id) return
    room.banned.add(target.ip)
    room.say('system', `${target.name} was banned by the host`)
    removeByForce(playerId, 'You were banned from the room')
  })

  socket.on('vote_kick', ({ playerId } = {}) => {
    const room = current()
    if (!room) return
    const target = room.players.get(playerId)
    const result = room.voteKick(socket.id, playerId)
    if (result.error) return fail(result.error)
    if (result.passed && target) {
      room.say('system', `${target.name} was removed by vote`)
      removeByForce(playerId, 'You were removed by a vote')
    }
  })

  socket.on('report_player', ({ playerId, reason } = {}) => {
    const room = current()
    if (!room) return
    const result = room.report(socket.id, playerId, reason)
    if (result.error) fail(result.error)
  })

  socket.on('replay_request', () => {
    const drawing = current()?.game?.lastDrawing
    if (drawing) socket.emit('replay_data', drawing)
  })

  socket.on('canvas_request', () => current()?.game?.syncCanvasTo(socket.id))
  socket.on('draw_start', (data) => current()?.game?.drawStart(socket.id, data))
  socket.on('draw_move', (data) => current()?.game?.drawMove(socket.id, data))
  socket.on('draw_end', () => current()?.game?.drawEnd(socket.id))
  socket.on('draw_undo', () => current()?.game?.undo(socket.id))
  socket.on('canvas_clear', () => current()?.game?.clearCanvas(socket.id))

  socket.on('disconnect', () => leave(socket))
})

process.on('uncaughtException', (err) => console.error('uncaught exception', err))
process.on('unhandledRejection', (err) => console.error('unhandled rejection', err))

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`)
})
