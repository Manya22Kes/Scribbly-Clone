import type { Stroke } from './types'

export const WIDTH = 960
export const HEIGHT = 720

export type Point = [number, number]

export function blank(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

export function paintDot(ctx: CanvasRenderingContext2D, [x, y]: Point, color: string, size: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x * WIDTH, y * HEIGHT, size / 2, 0, Math.PI * 2)
  ctx.fill()
}

export function paintSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, size: number) {
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(from[0] * WIDTH, from[1] * HEIGHT)
  ctx.lineTo(to[0] * WIDTH, to[1] * HEIGHT)
  ctx.stroke()
}

export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  blank(ctx)
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points
    if (!first) continue
    paintDot(ctx, first, stroke.color, stroke.size)
    let prev = first
    for (const point of rest) {
      paintSegment(ctx, prev, point, stroke.color, stroke.size)
      prev = point
    }
  }
}
