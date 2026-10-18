import type { CSSProperties } from 'react'
import { UI, type Lang } from '@/data/i18n'

type FireControlProps = {
  /** 0..100 */
  level: number
  /** (the coals are clicked to add charcoal: see Roasting) */
  onAdd?: () => void
  lang: Lang
}

function fireWord(level: number, lang: Lang) {
  const w = UI[lang].fireWords
  if (level < 8) return w[0]
  if (level < 35) return w[1]
  if (level < 70) return w[2]
  return w[3]
}

/** 火力 gauge for the charcoal grill: the fire burns down on its own; a click on the coals builds it back up. */
export function FireControl({ level, lang }: FireControlProps) {
  return (
    <div className="heat fire-control">
      <span className="heat-label" aria-hidden="true">{UI[lang].fire}</span>
      <div className={`fire-meter${level > 100 ? ' fire-over' : ''}`} role="meter" aria-label="火力" aria-valuemin={0} aria-valuemax={120}
        aria-valuenow={Math.round(level)} aria-valuetext={`${fireWord(level, lang)}，${Math.round(level)}%`}
        style={{ '--heat': `${Math.min(100, level)}%` } as CSSProperties} />
      <div className="fire-row">
        <span className="heat-value"><span className="heat-word">{fireWord(level, lang)}</span> {Math.round(level)}%</span>
        <span className="fire-tip">{UI[lang].tapCoals}</span>
      </div>
    </div>
  )
}
