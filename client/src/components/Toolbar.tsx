import { socket } from '../socket'
import { COLORS, SIZES } from '../tools'

interface Props {
  color: string
  size: number
  eraser: boolean
  onColor: (color: string) => void
  onSize: (size: number) => void
  onEraser: (on: boolean) => void
}

export default function Toolbar({ color, size, eraser, onColor, onSize, onEraser }: Props) {
  return (
    <div className="toolbar">
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            className={!eraser && c === color ? 'swatch active' : 'swatch'}
            style={{ background: c }}
            onClick={() => {
              onColor(c)
              onEraser(false)
            }}
          />
        ))}
      </div>

      <div className="sizes">
        {SIZES.map((s) => (
          <button
            key={s}
            aria-label={`Brush size ${s}`}
            className={s === size ? 'size active' : 'size'}
            onClick={() => onSize(s)}
          >
            <span style={{ width: s / 1.6 + 4, height: s / 1.6 + 4 }} />
          </button>
        ))}
      </div>

      <div className="actions">
        <button className={eraser ? 'tool active' : 'tool'} onClick={() => onEraser(!eraser)}>
          Eraser
        </button>
        <button className="tool" onClick={() => socket.emit('draw_undo')}>
          Undo
        </button>
        <button className="tool" onClick={() => socket.emit('canvas_clear')}>
          Clear
        </button>
      </div>
    </div>
  )
}
