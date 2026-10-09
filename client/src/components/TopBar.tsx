import type { ViewState } from '../types'

interface Props {
  state: ViewState
  seconds: number | null
}

export default function TopBar({ state, seconds }: Props) {
  const drawer = state.players.find((p) => p.id === state.drawerId)
  const isDrawer = state.drawerId === state.you

  let center
  if (state.phase === 'choosing') {
    center = <span className="hint-text">{isDrawer ? 'Pick a word to draw' : `${drawer?.name ?? 'Someone'} is choosing a word`}</span>
  } else if (state.phase === 'drawing' && state.word) {
    center = (
      <span className="word">
        {state.word}
        {isDrawer && <small>your word</small>}
      </span>
    )
  } else if (state.phase === 'drawing' && state.mask) {
    center = (
      <span className="word mask">
        {state.mask.map((ch, i) => (
          <span key={i} className={ch === ' ' ? 'gap' : 'slot'}>
            {ch === ' ' ? '' : ch}
          </span>
        ))}
        <small>{state.mask.filter((c) => c !== ' ').length} letters</small>
      </span>
    )
  } else if (state.phase === 'drawing') {
    center = <span className="hint-text">The word is hidden</span>
  } else if (state.phase === 'turn_end' && state.result) {
    center = <span className="word">{state.result.word}</span>
  } else {
    center = <span className="hint-text">Game over</span>
  }

  return (
    <div className="topbar">
      <span className="pill">
        Round {Math.min(state.round, state.totalRounds)} / {state.totalRounds}
      </span>
      {center}
      <span className={seconds !== null && seconds <= 10 && state.phase === 'drawing' ? 'pill timer urgent' : 'pill timer'}>
        {seconds ?? '–'}
      </span>
    </div>
  )
}
