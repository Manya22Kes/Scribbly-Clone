import { useEffect, useRef, useState } from 'react'
import { AVATARS } from '../tools'
import Avatar from './Avatar'

interface Props {
  connected: boolean
  onFinish: () => void
}

const TICK_MS = 100
const SLOW_AFTER_MS = 5000
const MIN_SHOW_MS = 2200
const MIN_FINISH_MS = 1300
const FADE_MS = 400
// The bar eases towards this while we wait, so it never looks finished before we are.
const WAITING_CAP = 90
const POP_SPAN = 85

export default function Loader({ connected, onFinish }: Props) {
  const [waited, setWaited] = useState(0)
  const [slow, setSlow] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    if (connected) return
    const timer = setInterval(() => {
      setWaited((p) => p + (WAITING_CAP - p) * 0.03)
      if (Date.now() - startedAt > SLOW_AFTER_MS) setSlow(true)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [connected, startedAt])

  useEffect(() => {
    if (!connected) return
    const elapsed = Date.now() - startedAt
    const wait = Math.max(MIN_FINISH_MS, MIN_SHOW_MS - elapsed)
    const leave = setTimeout(() => setLeaving(true), wait)
    const done = setTimeout(() => onFinishRef.current(), wait + FADE_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [connected, startedAt])

  const progress = connected ? 100 : waited
  const shown = Math.round(progress)

  return (
    <div className={leaving ? 'loader leaving' : 'loader'} role="status" aria-live="polite">
      <h1 className="loader-title">
        Scribbly<span className="loader-scribble" aria-hidden="true" />
      </h1>

      <div className="loader-avatars" aria-hidden="true">
        {AVATARS.map((_, i) => {
          const visible = progress >= (i / AVATARS.length) * POP_SPAN
          return (
            <span
              key={i}
              className={visible ? 'loader-avatar show' : 'loader-avatar'}
              style={{ animationDelay: connected ? `${i * 60}ms` : '0ms', ['--bob' as string]: `${(i % 4) * 0.25}s` }}
            >
              <Avatar index={i} size={52} />
            </span>
          )
        })}
      </div>

      <div
        className="loader-bar"
        role="progressbar"
        aria-label="Loading"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
      >
        <div className="loader-fill" style={{ width: `${progress}%` }} />
      </div>

      <p className="loader-text">
        {connected ? 'Ready, grab a pencil!' : slow ? 'Waking up the server, the first visit can take up to 30 seconds' : 'Sharpening pencils…'}
      </p>
    </div>
  )
}
