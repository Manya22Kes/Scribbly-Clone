import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket'
import { HEIGHT, WIDTH, blank, paintDot, paintSegment } from '../paint'
import type { Point } from '../paint'
import type { ReplayData } from '../types'

interface Props {
  onClose: () => void
}

interface Step {
  from: Point | null
  to: Point
  color: string
  size: number
}

function toSteps(data: ReplayData): Step[] {
  const steps: Step[] = []
  for (const stroke of data.strokes) {
    stroke.points.forEach((point, i) => {
      steps.push({ from: i === 0 ? null : stroke.points[i - 1], to: point, color: stroke.color, size: stroke.size })
    })
  }
  return steps
}

export default function ReplayModal({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<ReplayData | null>(null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const onData = (payload: ReplayData) => setData(payload)
    socket.on('replay_data', onData)
    socket.emit('replay_request')
    return () => {
      socket.off('replay_data', onData)
    }
  }, [])

  useEffect(() => {
    if (!data || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    blank(ctx)
    const steps = toSteps(data)
    const perFrame = Math.max(1, Math.ceil(steps.length / 240))
    let index = 0
    let raf = 0

    const tick = () => {
      for (let k = 0; k < perFrame && index < steps.length; k++, index++) {
        const step = steps[index]
        if (step.from) paintSegment(ctx, step.from, step.to, step.color, step.size)
        else paintDot(ctx, step.to, step.color, step.size)
      }
      if (index < steps.length) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data, run])

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{data ? `${data.drawerName} drew "${data.word}"` : 'Loading replay'}</h3>
        <canvas ref={canvasRef} className="board" width={WIDTH} height={HEIGHT} />
        <div className="lobby-actions">
          <button onClick={() => setRun((r) => r + 1)} disabled={!data}>
            Play again
          </button>
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
