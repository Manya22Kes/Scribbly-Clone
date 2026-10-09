import { useState } from 'react'
import Avatar from '../components/Avatar'
import SettingsForm from '../components/SettingsForm'
import { AVATARS } from '../tools'
import { DEFAULT_SETTINGS } from '../types'
import type { Settings } from '../types'

interface Props {
  name: string
  onNameChange: (name: string) => void
  avatar: number
  onAvatarChange: (avatar: number) => void
  enterRoom: (event: string, payload: object) => void
}

export default function Home({ name, onNameChange, avatar, onAvatarChange, enterRoom }: Props) {
  const invite = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
  const [code, setCode] = useState(invite)
  const [creating, setCreating] = useState(false)
  const [isPrivate, setIsPrivate] = useState(true)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const trimmed = name.trim()

  const join = (spectate = false) =>
    enterRoom('join_room', { roomId: code, playerName: trimmed, avatar, spectate })
  const quickPlay = () => enterRoom('quick_play', { playerName: trimmed, avatar })
  const create = () => enterRoom('create_room', { hostName: trimmed, settings, isPrivate, avatar })

  return (
    <main className="home">
      <div className="card home-card">
        <h1 className="brand">Scribbly</h1>
        <p className="muted">Draw it. Guess it. Out-score your friends.</p>

        <div className="field">
          <span className="field-label">Pick an avatar</span>
          <div className="avatar-picker">
            {AVATARS.map((_, i) => (
              <button
                key={i}
                className={i === avatar ? 'avatar-choice active' : 'avatar-choice'}
                onClick={() => onAvatarChange(i)}
                aria-label={`Avatar ${i + 1}`}
              >
                <Avatar index={i} size={34} />
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field-label">Your name</span>
          <input
            value={name}
            maxLength={16}
            placeholder="Enter a nickname"
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>

        {invite ? (
          <>
            <button className="primary" disabled={!trimmed} onClick={() => join()}>
              Join room {invite}
            </button>
            <button className="ghost" disabled={!trimmed} onClick={() => join(true)}>
              Just watch
            </button>
          </>
        ) : (
          <>
            <button className="primary" disabled={!trimmed} onClick={quickPlay}>
              Quick play
            </button>

            <div className="row">
              <input
                value={code}
                maxLength={6}
                placeholder="Room code"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button disabled={!trimmed || code.length < 4} onClick={() => join()}>
                Join
              </button>
              <button disabled={!trimmed || code.length < 4} onClick={() => join(true)}>
                Watch
              </button>
            </div>

            <button className="ghost" onClick={() => setCreating((v) => !v)}>
              {creating ? 'Hide room options' : 'Create a room'}
            </button>

            {creating && (
              <div className="create-panel">
                <SettingsForm value={settings} onChange={(patch) => setSettings({ ...settings, ...patch })} />
                <label className="check">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  Private room (invite link only)
                </label>
                <button className="primary" disabled={!trimmed} onClick={create}>
                  Create room
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
