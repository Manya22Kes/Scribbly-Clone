import { useEffect, useRef } from 'react'
import { socket } from '../socket'
import { HEIGHT, WIDTH, blank, paintDot, paintSegment, paintStrokes } from '../paint'
import type { Point } from '../paint'
import type { Stroke } from '../types'

interface Pen {
  color: string
  size: number
  last: Point | null
}

interface DrawEvent {
  kind: 'start' | 'move' | 'end'
  playerId: string
  x?: number
  y?: number
  color?: string
  size?: number
}

interface Props {
  canDraw: boolean
  color: string
  size: number
}

export default function Canvas({ canDraw, color, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remotePen = useRef<Pen>({ color: '#000000', size: 4, last: null })
  const localPen = useRef<Pen>({ color, size, last: null })
  const pending = useRef<Point[]>([])
  const frame = useRef<number | null>(null)
  const drawing = useRef(false)

  const context = () => canvasRef.current!.getContext('2d')!

  useEffect(() => {
    const ctx = context()
    blank(ctx)

    const onDraw = (event: DrawEvent) => {
      if (event.playerId === socket.id) return
      const pen = remotePen.current
      if (event.kind === 'start') {
        const point: Point = [event.x!, event.y!]
        remotePen.current = { color: event.color!, size: event.size!, last: point }
        paintDot(ctx, point, event.color!, event.size!)
      } else if (event.kind === 'move' && pen.last) {
        const point: Point = [event.x!, event.y!]
        paintSegment(ctx, pen.last, point, pen.color, pen.size)
        pen.last = point
      } else if (event.kind === 'end') {
        pen.last = null
      }
    }

    const onSync = ({ strokes }: { strokes: Stroke[] }) => paintStrokes(ctx, strokes)

    socket.on('draw_data', onDraw)
    socket.on('canvas_sync', onSync)
    socket.emit('canvas_request')
    return () => {
      socket.off('draw_data', onDraw)
      socket.off('canvas_sync', onSync)
    }
  }, [])

  const toPoint = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    return [x, y]
  }

  const flush = () => {
    frame.current = null
    const pen = localPen.current
    const ctx = context()
    for (const point of pending.current) {
      if (pen.last) paintSegment(ctx, pen.last, point, pen.color, pen.size)
      pen.last = point
      socket.emit('draw_move', { x: point[0], y: point[1] })
    }
    pending.current = []
  }

  const onDown = (e: React.PointerEvent) => {
    if (!canDraw) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = toPoint(e)
    drawing.current = true
    localPen.current = { color, size, last: point }
    paintDot(context(), point, color, size)
    socket.emit('draw_start', { x: point[0], y: point[1], color, size })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return
    pending.current.push(toPoint(e))
    if (frame.current === null) frame.current = requestAnimationFrame(flush)
  }

  const onUp = () => {
    if (!drawing.current) return
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    flush()
    drawing.current = false
    localPen.current.last = null
    socket.emit('draw_end')
  }

  return (
    <canvas
      ref={canvasRef}
      className={canDraw ? 'board drawable' : 'board'}
      width={WIDTH}
      height={HEIGHT}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  )
}
