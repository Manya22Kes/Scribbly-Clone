import { socket } from '../socket'
import type { ViewState } from '../types'
import Avatar from './Avatar'

interface Props {
  state: ViewState
  onLeave: () => void
  onReplay: () => void
}

export default function ScoreOverlay({ state, onLeave, onReplay }: Props) {
  if (state.phase === 'turn_end' && state.result) {
    const { word, gains } = state.result
    return (
      <div className="overlay">
        <div className="overlay-card">
          <p className="eyebrow">The word was</p>
          <h2 className="reveal">{word}</h2>
          {gains.length === 0 ? (
            <p className="muted">Nobody got it this time</p>
          ) : (
            <ul className="gains">
              {gains.map((g) => (
                <li key={g.id}>
                  <span>{g.name}</span>
                  <b>+{g.points}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  const board = state.leaderboard ?? []
  const top = board[0]?.score ?? 0
  const winners = board.filter((p) => p.score === top)
  const isHost = state.hostId === state.you

  return (
    <div className="overlay">
      <div className="overlay-card">
        <p className="eyebrow">Winner{winners.length > 1 ? 's' : ''}</p>
        <h2 className="reveal">{winners.map((w) => w.name).join(' & ')}</h2>
        <ol className="board-list">
          {board.map((p, i) => (
            <li key={p.id}>
              <span className="rank">{i + 1}</span>
              <Avatar index={p.avatar} size={24} />
              <span className="player-name">{p.name}</span>
              <b>{p.score}</b>
            </li>
          ))}
        </ol>
        <div className="lobby-actions">
          {isHost ? (
            <button className="primary" onClick={() => socket.emit('back_to_lobby')}>
              Back to lobby
            </button>
          ) : (
            <p className="muted">Waiting for the host</p>
          )}
          {state.hasReplay && <button onClick={onReplay}>Replay last drawing</button>}
          <button className="ghost" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
