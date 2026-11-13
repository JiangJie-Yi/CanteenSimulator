import { useSyncExternalStore, type CSSProperties } from 'react'
import { UI, type Lang } from '@/data/i18n'

/**
 * The gauge's two numbers (0..1): the fire's heat, and what's on the bed it's rising to (App's tick sets them, a fifth of a second apart).
 * Kept here, not in App's state: it changes every moment fresh charcoal's catching, and only the gauge needs drawing again.
 */
let gauge = { heat: 0, bed: 0 }
const subs = new Set<() => void>()
export function setFireGauge(heat: number, bed: number) {
  if (Math.round(heat * 100) === Math.round(gauge.heat * 100) && Math.round(bed * 100) === Math.round(gauge.bed * 100)) return
  gauge = { heat, bed }
  subs.forEach((f) => f())
}
const useGauge = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => gauge)

type FireControlProps = {
  /** (the coals are clicked to add charcoal: see Roasting) */
  onAdd?: () => void
  lang: Lang
}

function fireWord(level: number, lang: Lang) {
  const w = UI[lang].fireWords
  if (level < 1) return w[4] ?? w[0]
  if (level < 8) return w[0]
  if (level < 35) return w[1]
  if (level < 70) return w[2]
  return w[3]
}

/** 火力 gauge for the charcoal grill: the fire burns down on its own; a click on the coals builds it back up. */
export function FireControl({ lang }: FireControlProps) {
  const g = useGauge()
  // (0..120: the heat; and what's on the bed, the heat rising to it as it catches: shown faint past the heat)
  const level = Math.round(g.heat * 100), bed = Math.max(level, Math.round(g.bed * 100))
  return (
    <div className="heat fire-control">
      <span className="heat-label" aria-hidden="true">{UI[lang].fire}</span>
      <div className={`fire-meter${level > 100 ? ' fire-over' : ''}`} role="meter" aria-label="火力" aria-valuemin={0} aria-valuemax={120}
        aria-valuenow={Math.round(level)} aria-valuetext={`${fireWord(level, lang)}，${Math.round(level)}%`}
        style={{ '--heat': `${Math.min(100, level)}%`, '--bed': `${Math.min(100, bed)}%` } as CSSProperties} />
      <div className="fire-row">
        <span className="heat-value"><span className="heat-word">{fireWord(level, lang)}</span> {Math.round(level)}%</span>
        <span className="fire-tip">{UI[lang].tapCoals}</span>
      </div>
    </div>
  )
}
