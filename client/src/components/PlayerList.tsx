import { useState } from 'react'
import { socket } from '../socket'
import { REPORT_REASONS } from '../tools'
import type { PlayerInfo } from '../types'
import Avatar from './Avatar'

interface Props {
  players: PlayerInfo[]
  hostId: string
  you: string
  showReady?: boolean
  canModerate?: boolean
}

export default function PlayerList({ players, hostId, you, showReady, canModerate }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const ranked = showReady ? players : [...players].sort((a, b) => b.score - a.score)
  const iAmHost = hostId === you

  const close = () => {
    setOpen(null)
    setReporting(false)
  }

  const act = (event: string, payload: object) => {
    socket.emit(event, payload)
    close()
  }

  return (
    <ul className="players">
      {ranked.map((p, i) => (
        <li key={p.id} className={p.hasGuessed ? 'guessed' : ''}>
          {!showReady && <span className="rank">{i + 1}</span>}
          <Avatar index={p.avatar} />
          <span className="who">
            <span className="player-name">
              {p.name}
              {p.id === you && <i> (you)</i>}
            </span>
            <span className="tags">
              {p.id === hostId && <span className="tag">host</span>}
              {p.isDrawer && <span className="tag tag-draw">drawing</span>}
              {showReady && p.id !== hostId && (
                <span className={p.ready ? 'tag tag-ready' : 'tag tag-wait'}>{p.ready ? 'ready' : 'not ready'}</span>
              )}
            </span>
          </span>
          {!showReady && <span className="score">{p.score}</span>}
          {canModerate && p.id !== you && (
            <span className="menu-anchor">
              <button
                className="more"
                aria-label={`Actions for ${p.name}`}
                onClick={() => {
                  setReporting(false)
                  setOpen(open === p.id ? null : p.id)
                }}
              >
                ⋯
              </button>
              {open === p.id && (
                <div className="menu">
                  {!reporting ? (
                    <>
                      {players.length >= 3 && (
                        <button onClick={() => act('vote_kick', { playerId: p.id })}>Vote to kick</button>
                      )}
                      <button onClick={() => setReporting(true)}>Report</button>
                      {iAmHost && <button onClick={() => act('kick_player', { playerId: p.id })}>Kick</button>}
                      {iAmHost && (
                        <button className="danger" onClick={() => act('ban_player', { playerId: p.id })}>
                          Ban
                        </button>
                      )}
                    </>
                  ) : (
                    REPORT_REASONS.map((reason) => (
                      <button key={reason} onClick={() => act('report_player', { playerId: p.id, reason })}>
                        {reason}
                      </button>
                    ))
                  )}
                </div>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
