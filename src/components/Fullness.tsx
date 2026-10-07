import type { CSSProperties } from 'react'
import { UI, type Lang } from '../i18n'

type FullnessProps = {
  /** calories eaten and not yet digested */
  kcal: number
  /** what counts as completely full */
  full: number
  lang: Lang
}

function fullWord(pct: number, lang: Lang) {
  const w = UI[lang].fullWords
  if (pct < 15) return w[0]
  if (pct < 45) return w[1]
  if (pct < 80) return w[2]
  if (pct < 100) return w[3]
  return w[4]
}

/** 飽足度: a little belly meter that fills as you eat (by each food's real-world calories) and slowly settles. */
export function Fullness({ kcal, full, lang }: FullnessProps) {
  const pct = Math.min(120, (kcal / full) * 100)
  return (
    <div className="fullness">
      <span className="heat-label" aria-hidden="true">{UI[lang].fullness}</span>
      <div className="fullness-meter" role="meter" aria-label={UI[lang].fullness} aria-valuemin={0}
        aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, pct))}
        aria-valuetext={`${fullWord(pct, lang)}，${Math.round(kcal)} kcal`}
        style={{ '--full': `${Math.min(100, pct)}%` } as CSSProperties} />
      <span className="heat-value">
        <span className="heat-word">{fullWord(pct, lang)}</span> {Math.round(kcal)} kcal
      </span>
    </div>
  )
}
