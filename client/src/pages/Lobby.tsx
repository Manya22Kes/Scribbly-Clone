import { useState } from 'react'
import { socket } from '../socket'
import Chat from '../components/Chat'
import PlayerList from '../components/PlayerList'
import SettingsForm from '../components/SettingsForm'
import type { ChatMessage, Settings, ViewState } from '../types'

interface Props {
  state: ViewState
  messages: ChatMessage[]
  onLeave: () => void
}

export default function Lobby({ state, messages, onLeave }: Props) {
  const [copied, setCopied] = useState(false)
  const isHost = state.hostId === state.you
  const me = state.players.find((p) => p.id === state.you)
  const link = `${window.location.origin}/?room=${state.roomId}`
  const others = state.players.filter((p) => p.id !== state.hostId)
  const everyoneReady = others.every((p) => p.ready)

  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const change = (patch: Partial<Settings>) => socket.emit('update_settings', patch)

  let startLabel = 'Start game'
  if (state.players.length < 2) startLabel = 'Waiting for players'
  else if (!everyoneReady) startLabel = 'Waiting for everyone to be ready'

  let action
  if (state.isSpectator) {
    action = <p className="muted">You are watching this room</p>
  } else if (isHost) {
    action = (
      <button
        className="primary"
        disabled={state.players.length < 2 || !everyoneReady}
        onClick={() => socket.emit('start_game')}
      >
        {startLabel}
      </button>
    )
  } else {
    action = (
      <button
        className={me?.ready ? '' : 'primary'}
        onClick={() => socket.emit('ready', { ready: !me?.ready })}
      >
        {me?.ready ? 'Not ready' : "I'm ready"}
      </button>
    )
  }

  return (
    <main className="lobby">
      <section className="card">
        <header className="lobby-head">
          <div>
            <p className="eyebrow">{state.isPrivate ? 'Private room' : 'Public room'}</p>
            <h2 className="code">{state.roomId}</h2>
          </div>
          <button onClick={copy}>{copied ? 'Copied' : 'Copy invite link'}</button>
        </header>

        <h3>
          Players <span className="muted">{state.players.length}/{state.settings.maxPlayers}</span>
        </h3>
        <PlayerList
          players={state.players}
          hostId={state.hostId}
          you={state.you}
          showReady
          canModerate={!state.isSpectator}
        />

        {state.spectators.length > 0 && (
          <p className="muted watchers">Watching: {state.spectators.map((s) => s.name).join(', ')}</p>
        )}

        <div className="lobby-actions">
          {action}
          <button className="ghost" onClick={onLeave}>
            Leave
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Settings {!isHost && <span className="muted">(host only)</span>}</h3>
        <SettingsForm value={state.settings} onChange={change} disabled={!isHost} />
      </section>

      <section className="card lobby-chat">
        <h3>Chat</h3>
        <Chat messages={messages} placeholder="Say hi" onSend={(text) => socket.emit('chat', { text })} />
      </section>
    </main>
  )
}
