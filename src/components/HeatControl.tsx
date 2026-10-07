import type { CSSProperties } from 'react'

type HeatControlProps = {
  heat: number
  onChange: (heat: number) => void
}

function heatWord(heat: number) {
  if (heat === 0) return '關火'
  if (heat <= 30) return '小火'
  if (heat <= 70) return '中火'
  return '大火'
}

/** 火候 slider for the gas stove: 0 is off, 100 is full flame. */
export function HeatControl({ heat, onChange }: HeatControlProps) {
  return (
    <div className="heat">
      <label htmlFor="heat-range" className="heat-label">火候</label>
      <input id="heat-range" type="range" min={0} max={100} step={5} value={heat}
        style={{ '--heat': `${heat}%` } as CSSProperties}
        aria-valuetext={`${heatWord(heat)}，${heat}%`}
        onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor="heat-range" className="heat-value">
        <span className="heat-word">{heatWord(heat)}</span> {heat}%
      </output>
    </div>
  )
}
