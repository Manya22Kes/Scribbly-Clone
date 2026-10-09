import { useState } from 'react'
import type { Settings } from '../types'
import { CATEGORIES, LANGUAGES } from '../types'

interface Props {
  value: Settings
  onChange: (patch: Partial<Settings>) => void
  disabled?: boolean
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step = 1, suffix = '', disabled, onChange }: SliderProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export default function SettingsForm({ value, onChange, disabled }: Props) {
  const joined = value.customWords.join(', ')
  const [draft, setDraft] = useState<string | null>(null)

  const commitWords = () => {
    const words = (draft ?? joined)
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean)
    onChange({ customWords: words })
    setDraft(null)
  }

  return (
    <div className="settings">
      <Slider label="Players" value={value.maxPlayers} min={2} max={20} disabled={disabled} onChange={(maxPlayers) => onChange({ maxPlayers })} />
      <Slider label="Rounds" value={value.rounds} min={2} max={10} disabled={disabled} onChange={(rounds) => onChange({ rounds })} />
      <Slider label="Draw time" value={value.drawTime} min={15} max={240} step={5} suffix="s" disabled={disabled} onChange={(drawTime) => onChange({ drawTime })} />
      <Slider label="Word choices" value={value.wordCount} min={1} max={5} disabled={disabled} onChange={(wordCount) => onChange({ wordCount })} />
      <Slider label="Hints" value={value.hints} min={0} max={5} disabled={disabled} onChange={(hints) => onChange({ hints })} />
      <label className="field">
        <span className="field-label">Word mode</span>
        <select
          value={value.wordMode}
          disabled={disabled}
          onChange={(e) => onChange({ wordMode: e.target.value as Settings['wordMode'] })}
        >
          <option value="normal">Normal</option>
          <option value="hidden">Hidden (no blanks)</option>
          <option value="combination">Combination (two words)</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">Language</span>
        <select value={value.language} disabled={disabled} onChange={(e) => onChange({ language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Category</span>
        <select value={value.category} disabled={disabled} onChange={(e) => onChange({ category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">
          Custom words
          <b>{value.customWords.length}</b>
        </span>
        <textarea
          rows={2}
          value={draft ?? joined}
          disabled={disabled}
          placeholder="comma separated, e.g. laptop, monsoon, cricket"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitWords}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={value.customOnly}
          disabled={disabled}
          onChange={(e) => onChange({ customOnly: e.target.checked })}
        />
        Use only my custom words
      </label>
    </div>
  )
}
