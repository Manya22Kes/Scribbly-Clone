# Scribbly

A multiplayer drawing and guessing game in the style of skribbl.io. One player draws a word, everyone else races to guess it. Built with React, TypeScript, Express and Socket.IO.

**Live demo:** https://scribbly-clone.vercel.app

Render's free tier sleeps after a while, so the first load can take about 30 seconds.

## Running it locally

You need Node 18 or newer.

```bash
npm run install:all
npm run dev
```

The client runs on http://localhost:5173 and proxies Socket.IO to the server on port 3001. Open it in two or three tabs to play against yourself.

To run the production setup (one process serving everything):

```bash
npm run build
npm start
```

Then open http://localhost:3001.

## Features

Core game
- Create a room with settings, join by link or six character code, public and private rooms, Quick play for public ones
- Lobby with player list, ready-up, and a host-only start button
- Turn-based rounds with one drawer, a choice of 1 to 5 words, real-time canvas, guessing, chat, scoring, leaderboard and a winner
- Drawing tools: brush, 12 colours, 3 sizes, eraser, undo, clear (drawer only)
- Hints that reveal letters over time, and a draw-time countdown

Room settings (all validated on the server): players 2 to 20, rounds 2 to 10, draw time 15 to 240 seconds, 1 to 5 word choices, 0 to 5 hints (0 turns them off), word mode, language, category, custom words.

Extras
- Word modes: Normal, Hidden (no blanks shown) and Combination (the drawer gets two words joined together)
- Word categories, and three word lists: English, Hindi and Spanish
- Custom words: the host adds their own words, mixed in with the list or used on their own
- Moderation: host kick, host ban (by IP address), votekick (majority of the other players), and report with a reason (the host is notified and it is logged on the server)
- Avatars for every player
- Spectator mode: watch a room by code or invite link without playing
- Replay: after any turn, replay how that drawing was made, stroke by stroke

## How to play

1. Pick an avatar and a name, then Quick play, join with a room code, or create a room.
2. Private rooms are joined with the invite link (`/?room=ABC123`) or the code. Use Watch instead of Join to spectate.
3. Everyone except the host presses "I'm ready". The host can then start once there are at least two players.
4. The drawer picks one of a few words and draws it. Everyone else types guesses in the chat box.
5. Faster correct guesses score more. After the last round the highest score wins.

## Project layout

```
server/src
  index.js     express, socket.io, and the mapping from events to room methods
  Room.js      players, spectators, host, settings, moderation, chat, per-player snapshots
  Game.js      phases, turn order, timers, hints, scoring, strokes, replay storage
  Player.js    id, name, avatar, score, ready, hasGuessed
  words.js     loads the word lists and picks options (normal, custom, combination)
  words/       en.json, hi.json, es.json
  utils.js     word normalising, close-guess check, masking, room codes
client/src
  App.tsx      holds the latest game state and picks the screen
  pages        Home, Lobby, Game
  components   Canvas, Toolbar, TopBar, Chat, PlayerList, SettingsForm, WordChoice,
               ScoreOverlay, ReplayModal, Avatar
  paint.ts     canvas drawing helpers shared by the live canvas and the replay
```

## Architecture

### State lives on the server

There is no database. Rooms sit in a `Map` in memory, and each `Room` owns its players and, while a game is running, a `Game`. Whenever anything changes the server builds a snapshot for each person and sends it as `game_state`. The snapshot is personal: the drawer and anyone who already guessed get the real word, everybody else (spectators included) gets a masked version, and only the drawer receives the word choices. The client keeps no game logic, it just renders the latest snapshot.

Cheating is handled the same way. The word never leaves the server for a player who should not see it, and draw events from anyone other than the current drawer are ignored.

The granular events from the assignment (`player_joined`, `round_start`, `guess_result` and so on) are emitted as well. The UI renders from `game_state` and uses a few of the others, such as `guess_result` for the "+points" toast and `kicked` to send a removed player home.

### Game flow

`choosing` (15 seconds to pick, then a random option is picked) leads to `drawing` (the draw timer), then `turn_end` (4 second results screen), then either the next drawer or `game_over`. A round is one turn per player. The turn order is fixed when the round starts, and players who left are skipped. One `setTimeout` ends each turn, hint reveals use one `setInterval`, and every timer is cleared on each phase change so nothing leaks when a room closes.

Scoring: a correct guess gives `round(50 + 450 * timeLeft / drawTime)` points, and the drawer gets 50 for every player who guesses.

The clock is sent as "time left" rather than a deadline, and the client adds it to its own clock. That way a client whose clock is a few seconds off still counts down correctly.

### Real-time drawing

The canvas has a fixed internal size (960 by 720) and is scaled with CSS, so every client draws the same picture regardless of screen size. All coordinates are sent normalised to the 0 to 1 range.

1. The drawer's pointer events become `draw_start`, `draw_move` and `draw_end`. Moves are batched with `requestAnimationFrame` so a fast mouse does not flood the socket.
2. The server checks the sender is the drawer, stores the stroke in `game.strokes` (a stroke is a colour, a size and a list of points), and broadcasts `draw_data` to the whole room. The drawer already painted the stroke locally, so their client skips its own echo.
3. Other clients paint line segments as the points arrive.
4. Undo and clear change the stored strokes on the server, which then sends `canvas_sync` with the full list. Clients wipe the canvas and repaint it. A client that mounts the canvas mid-turn asks for the same thing with `canvas_request`, which is how late joiners and spectators catch up.
5. When a turn ends the server keeps a copy of the strokes. `replay_request` returns them and the client animates them point by point.

The eraser is just a wide white brush.

### Guess matching

Both sides are trimmed, lowercased, Unicode-normalised and have repeated spaces collapsed, so ` Elephant ` matches `elephant`. Spanish also ignores accents, so `arbol` matches `árbol`. An exact match scores. If a guess is one edit away (Levenshtein distance 1) and the word has at least four characters, only that player gets a private "is close" message and the text is not shown to anyone else. Everyone else sees "PlayerX guessed the word!" and never the word itself.

Words are split into grapheme clusters rather than raw characters, so Hindi words with vowel signs get one blank per visible letter and hints reveal whole letters.

The client sends `guess` while guessing and `chat` otherwise. The server routes a `chat` from someone who has not guessed yet through the same checks, so the word can never slip out through the chat route. Once a player has guessed, or if they are the drawer, their chat goes only to the others who already know the word. Spectators chat only with other spectators.

### Moderation

- Kick (host): removes the player, who can rejoin.
- Ban (host): removes the player and blocks their IP address from rejoining that room. Because it is per IP, people sharing a network share a ban.
- Votekick: needs at least 3 players and a majority of the other players.
- Report: five fixed reasons. The host sees it in chat and the server logs it.

### Disconnects

A leaving player is removed. If they were the host, the next player takes over. If the drawer leaves, the turn ends (or is skipped if they had not picked a word). If fewer than two players remain, the room goes back to the lobby. An empty room is deleted and any spectators are sent home. Reconnecting to a game is not supported.

## Socket events

| Event | Direction | Payload |
| --- | --- | --- |
| `create_room` | client to server | `{ hostName, settings, isPrivate, avatar }` |
| `join_room` | client to server | `{ roomId, playerName, avatar, spectate }` |
| `quick_play` | client to server | `{ playerName, avatar }` |
| `leave_room` | client to server | none |
| `ready` | client to server | `{ ready }` |
| `update_settings` | client to server | partial settings, host only |
| `start_game` | client to server | none, host only, everyone ready |
| `back_to_lobby` | client to server | none, host only, after game over |
| `word_chosen` | client to server | `{ word }` |
| `guess` | client to server | `{ text }` |
| `chat` | client to server | `{ text }` |
| `draw_start` | client to server | `{ x, y, color, size }` |
| `draw_move` | client to server | `{ x, y }` |
| `draw_end` | client to server | none |
| `draw_undo` | client to server | none |
| `canvas_clear` | client to server | none |
| `canvas_request` | client to server | none |
| `kick_player`, `ban_player` | client to server | `{ playerId }`, host only |
| `vote_kick` | client to server | `{ playerId }` |
| `report_player` | client to server | `{ playerId, reason }` |
| `replay_request` | client to server | none |
| `game_state` | server to client | personal snapshot: phase, round, players, word or mask, word options, time left, results, leaderboard |
| `player_joined` | server to client | `{ player, players }` |
| `player_left` | server to client | `{ playerId, players }` |
| `round_start` | server to client | `{ drawerId, wordOptions, drawTime }`, options only for the drawer |
| `round_end` | server to client | `{ word, scores, nextDrawer }` |
| `game_over` | server to client | `{ winner, leaderboard }` |
| `guess_result` | server to client | `{ correct, playerId, playerName, points }` |
| `chat_message` | server to client | `{ kind, text, playerId, playerName }`, kind is chat, system, correct or close |
| `draw_data` | server to client | `{ kind: start / move / end, x, y, color, size, playerId }` |
| `canvas_sync` | server to client | `{ strokes }` |
| `replay_data` | server to client | `{ word, drawerName, strokes }` |
| `kicked` | server to client | message string |
| `error_msg` | server to client | string |

## Deployment

The app is one Node service: Express serves the built React app and Socket.IO on the same origin, so there is no CORS setup and no client-side URL config.

On Render:

1. Push the repo to GitHub.
2. Create a new Web Service from it (or use the included `render.yaml` as a Blueprint).
3. Build command `npm run build`, start command `npm start`. Render supplies `PORT` itself.
4. Put the resulting URL at the top of this file.

Render sits behind a proxy, and the server reads the player's address from the `x-forwarded-for` header so bans work there.

### Optional: client on Vercel

The server cannot run on Vercel, but the React client can. Keep the server on Render and deploy `client/` to Vercel (root directory `client`, framework Vite). Then set:

- On Vercel: `VITE_SERVER_URL` = the Render URL, for example `https://scribbly-m0ln.onrender.com`
- On Render: `CLIENT_ORIGIN` = the Vercel URL, for example `https://your-app.vercel.app` (comma separated for several)

With neither variable set, the client and server are same-origin, as in the Render-only setup above.

Vercel and Netlify do not fit the backend. They run serverless functions, which cannot hold a long-lived WebSocket connection, and this game also keeps room state in process memory. Render and Railway run a normal long-lived server, so both work. The trade-off of in-memory state is that a restart wipes all rooms and the app cannot be scaled past one instance without adding something like Redis.
