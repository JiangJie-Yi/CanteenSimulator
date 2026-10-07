import type { CSSProperties } from 'react'

type FireControlProps = {
  /** 0..100 */
  level: number
  onAdd: () => void
}

function fireWord(level: number) {
  if (level < 8) return '快熄了'
  if (level < 35) return '小火'
  if (level < 70) return '中火'
  return '旺火'
}

/** 火力 gauge for the charcoal grill: the fire burns down on its own, 添炭 builds it back up. */
export function FireControl({ level, onAdd }: FireControlProps) {
  return (
    <div className="heat fire-control">
      <span className="heat-label" aria-hidden="true">火力</span>
      <div className="fire-meter" role="meter" aria-label="火力" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(level)} aria-valuetext={`${fireWord(level)}，${Math.round(level)}%`}
        style={{ '--heat': `${level}%` } as CSSProperties} />
      <div className="fire-row">
        <span className="heat-value"><span className="heat-word">{fireWord(level)}</span> {Math.round(level)}%</span>
        <button type="button" className="fire-add" onClick={onAdd} disabled={level >= 100}>添炭</button>
      </div>
    </div>
  )
}
