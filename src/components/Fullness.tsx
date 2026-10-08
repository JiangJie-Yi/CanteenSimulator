import { UI, type Lang } from '../i18n'
import { starText } from './Notebook'

type FullnessProps = {
  /** calories eaten and not yet digested */
  kcal: number
  /** what counts as completely full */
  full: number
  lang: Lang
  /** average 美味 (0..100) of what's been eaten, or null before anything has */
  rating: number | null
  /** the last thing tried, with its stars (tasting while the shop is closed) */
  lastTry?: { name: string; taste: number; key: number } | null
}

function fullWord(pct: number, lang: Lang) {
  const w = UI[lang].fullWords
  if (pct < 15) return w[0]
  if (pct < 45) return w[1]
  if (pct < 80) return w[2]
  if (pct < 100) return w[3]
  return w[4]
}

/*
 * A stomach as an anatomy sketch draws it: the gullet coming down into the rounded fundus at the top left, the
 * body swelling in a J along the greater curvature, narrowing through the antrum to the pylorus at the lower right,
 * the duodenum turning down from there; the lesser curvature is the short inner bend between the two.
 */
const STOMACH = 'M17 2 L19 10 C11 9 5 15 6 24 C7 34 15 42 25 42 C31 42 35 39 37 35 L42 34 L42 29 L37 29 ' +
  'C35 31 32 33 28 32 C24 31 22 27 22 22 C22 17 24 13 24 2 Z'
const DUODENUM = 'M42 29 C46 30 47 35 45 40 C44 43 41 45 38 46'

/**
 * 飽足: a stomach that fills up from the bottom as you eat (by each food's real-world calories) and empties as it
 * digests — grey when empty, turning green as it fills — with the average 評價 of what's been eaten.
 */
export function Fullness({ kcal, full, lang, rating, lastTry }: FullnessProps) {
  const pct = Math.min(100, (kcal / full) * 100)
  // grey → green as it fills
  const fill = `hsl(122 ${Math.round(8 + pct * 0.5)}% ${Math.round(64 - pct * 0.2)}%)`
  const level = 43 - (pct / 100) * 38           // the fill's top edge, in the icon's 0..48 box
  const stars = rating === null ? 0 : Math.max(1, Math.round(rating / 20))
  return (
    <div className="fullness" role="meter" aria-label={UI[lang].fullness} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(pct)} aria-valuetext={`${fullWord(pct, lang)}，${Math.round(kcal)} kcal`}>
      <svg className="fullness-icon" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <clipPath id="stomach-shape">
            <path d={STOMACH} />
          </clipPath>
        </defs>
        <path d={STOMACH} fill="#c9c3ba" opacity="0.4" />
        <g clipPath="url(#stomach-shape)">
          <rect x="0" y={level} width="48" height={48 - level} fill={fill} style={{ transition: 'y 500ms ease' }} />
          <path d={`M0 ${level} q6 -2 12 0 t12 0 t12 0 t12 0 v3 h-48z`} fill={fill} />
          {/* folds of the stomach lining (rugae) */}
          <path d="M10 22c4 2 6 6 7 11M13 18c4 3 7 8 9 15M9 28c4 1 7 5 9 9" fill="none" stroke="currentColor"
            strokeOpacity="0.18" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <path d={STOMACH} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d={DUODENUM} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="heat-value">
        <span className="heat-word">{fullWord(pct, lang)}</span> {Math.round(kcal)} kcal
        {lastTry ? (
          <span key={lastTry.key} className="fullness-rating fullness-try" title={`美味 ${Math.round(lastTry.taste)}`}>
            {lang === 'ja' ? '試食' : '試吃'} {lastTry.name} {starText(lastTry.taste)}
            <small> 美味 {Math.round(lastTry.taste)}</small>
          </span>
        ) : rating !== null && (
          <span className="fullness-rating" title={`${UI[lang].rating} ${Math.round(rating)}`}>
            {UI[lang].rating} {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </span>
        )}
      </span>
    </div>
  )
}

/** a small stomach that fills grey → green, for each AI customer */
export function MiniStomach({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct))
  const fill = `hsl(122 ${Math.round(8 + p * 0.5)}% ${Math.round(64 - p * 0.2)}%)`
  const level = 43 - (p / 100) * 38
  const id = `ms-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg className="mini-stomach" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <clipPath id={id}><path d={STOMACH} /></clipPath>
      </defs>
      <path d={STOMACH} fill="#c9c3ba" opacity="0.45" />
      <rect x="0" y={level} width="48" height={48 - level} fill={fill} clipPath={`url(#${id})`} />
      <path d={STOMACH} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d={DUODENUM} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}