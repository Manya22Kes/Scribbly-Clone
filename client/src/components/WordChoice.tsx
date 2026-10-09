import { socket } from '../socket'

interface Props {
  options: string[]
  seconds: number | null
}

export default function WordChoice({ options, seconds }: Props) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h3>Choose a word</h3>
        <div className="word-options">
          {options.map((word) => (
            <button key={word} className="primary" onClick={() => socket.emit('word_chosen', { word })}>
              {word}
            </button>
          ))}
        </div>
        <p className="muted">Auto-picking in {seconds ?? 0}s</p>
      </div>
    </div>
  )
}
