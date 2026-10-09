import { useState } from 'react'
import { socket } from '../socket'
import Canvas from '../components/Canvas'
import Chat from '../components/Chat'
import PlayerList from '../components/PlayerList'
import ReplayModal from '../components/ReplayModal'
import ScoreOverlay from '../components/ScoreOverlay'
import Toolbar from '../components/Toolbar'
import TopBar from '../components/TopBar'
import WordChoice from '../components/WordChoice'
import { COLORS, SIZES } from '../tools'
import { useCountdown } from '../useCountdown'
import type { ChatMessage, ViewState } from '../types'

interface Props {
  state: ViewState
  messages: ChatMessage[]
  onLeave: () => void
}

export default function Game({ state, messages, onLeave }: Props) {
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [eraser, setEraser] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const seconds = useCountdown(state.deadline)

  const me = state.players.find((p) => p.id === state.you)
  const isDrawer = state.drawerId === state.you
  const canDraw = isDrawer && state.phase === 'drawing'
  const drawer = state.players.find((p) => p.id === state.drawerId)
  const isGuessing = state.phase === 'drawing' && !state.isSpectator && !isDrawer && !me?.hasGuessed

  let placeholder = 'Type your guess here'
  if (state.isSpectator) placeholder = 'Chat with other spectators'
  else if (isDrawer) placeholder = 'Chat with players who guessed'
  else if (me?.hasGuessed) placeholder = 'You got it. Chat with other guessers'
  else if (state.phase !== 'drawing') placeholder = 'Say something'

  const send = (text: string) => socket.emit(isGuessing ? 'guess' : 'chat', { text })

  return (
    <main className="game">
      <aside className="card side">
        {state.isSpectator && <p className="spectator-note">You are spectating</p>}
        <PlayerList
          players={state.players}
          hostId={state.hostId}
          you={state.you}
          canModerate={!state.isSpectator}
        />
        {state.spectators.length > 0 && (
          <p className="muted watchers">Watching: {state.spectators.map((s) => s.name).join(', ')}</p>
        )}
        <button className="ghost" onClick={onLeave}>
          Leave room
        </button>
      </aside>

      <section className="stage">
        <TopBar state={state} seconds={seconds} />
        <div className="board-wrap">
          <Canvas canDraw={canDraw} color={eraser ? '#ffffff' : color} size={eraser ? 28 : size} />
          {state.phase === 'choosing' && isDrawer && state.wordOptions && (
            <WordChoice options={state.wordOptions} seconds={seconds} />
          )}
          {state.phase === 'choosing' && !isDrawer && (
            <div className="overlay">
              <div className="overlay-card">
                <h3>{drawer?.name ?? 'Someone'} is choosing a word</h3>
              </div>
            </div>
          )}
          {(state.phase === 'turn_end' || state.phase === 'game_over') && (
            <ScoreOverlay state={state} onLeave={onLeave} onReplay={() => setReplaying(true)} />
          )}
        </div>
        {canDraw ? (
          <Toolbar
            color={color}
            size={size}
            eraser={eraser}
            onColor={setColor}
            onSize={setSize}
            onEraser={setEraser}
          />
        ) : (
          <div className="toolbar toolbar-idle">
            <span>{state.phase === 'drawing' && drawer ? `${drawer.name} is drawing` : ''}</span>
            {state.hasReplay && state.phase !== 'game_over' && (
              <button className="tool replay-btn" onClick={() => setReplaying(true)}>
                Replay last drawing
              </button>
            )}
          </div>
        )}
      </section>

      <aside className="card side">
        <Chat messages={messages} placeholder={placeholder} onSend={send} />
      </aside>

      {replaying && <ReplayModal onClose={() => setReplaying(false)} />}
    </main>
  )
}
