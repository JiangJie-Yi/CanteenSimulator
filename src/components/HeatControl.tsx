import type { CSSProperties } from 'react'
import { UI, type Lang } from '../i18n'

type HeatControlProps = {
  heat: number
  onChange: (heat: number) => void
  lang: Lang
}

function heatWord(heat: number, lang: Lang) {
  const w = UI[lang].heatWords
  if (heat === 0) return w[0]
  if (heat <= 30) return w[1]
  if (heat <= 70) return w[2]
  return w[3]
}

/** 火候 slider for the gas stove: 0 is off, 100 is full flame. */
export function HeatControl({ heat, onChange, lang }: HeatControlProps) {
  return (
    <div className="heat">
      <label htmlFor="heat-range" className="heat-label">{UI[lang].heat}</label>
      <input id="heat-range" type="range" min={0} max={100} step={5} value={heat}
        style={{ '--heat': `${heat}%` } as CSSProperties}
        aria-valuetext={`${heatWord(heat, lang)}，${heat}%`}
        onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor="heat-range" className="heat-value">
        <span className="heat-word">{heatWord(heat, lang)}</span> {heat}%
      </output>
    </div>
  )
}
