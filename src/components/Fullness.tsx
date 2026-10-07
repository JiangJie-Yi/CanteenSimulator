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

// a stomach, drawn as a curved bean with the gullet coming in at the top left and the gut leaving at the bottom
const STOMACH = 'M14 4c0 4 1 6 4 8 5 3 13 3 18 9 5 7 2 17-6 21-8 4-18 2-22-5-2-4-1-8 2-11 2-2 2-5 0-8-2-4-2-9 1-14z'

/**
 * 飽足: a little stomach that fills up from the bottom as you eat (by each food's real-world calories) and
 * empties as it digests — grey when empty, turning green as it fills.
 */
export function Fullness({ kcal, full, lang }: FullnessProps) {
  const pct = Math.min(100, (kcal / full) * 100)
  // grey → green as it fills
  const hue = 120
  const sat = Math.round(10 + pct * 0.45)
  const light = Math.round(62 - pct * 0.18)
  const fill = `hsl(${hue} ${sat}% ${light}%)`
  const level = 46 - (pct / 100) * 42           // the fill's top edge, in the icon's 0..48 box
  return (
    <div className="fullness" role="meter" aria-label={UI[lang].fullness} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(pct)} aria-valuetext={`${fullWord(pct, lang)}，${Math.round(kcal)} kcal`}>
      <svg className="fullness-icon" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <clipPath id="stomach-shape">
            <path d={STOMACH} />
          </clipPath>
        </defs>
        <path d={STOMACH} fill="#b9b4ac" opacity="0.45" />
        <g clipPath="url(#stomach-shape)">
          <rect x="0" y={level} width="48" height={48 - level} fill={fill} style={{ transition: 'y 500ms ease' }} />
          {/* a gentle wave on the surface */}
          <path d={`M0 ${level} q6 -2 12 0 t12 0 t12 0 t12 0 v3 h-48z`} fill={fill} />
        </g>
        <path d={STOMACH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 4V1M30 42l3 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="heat-value">
        <span className="heat-word">{fullWord(pct, lang)}</span> {Math.round(kcal)} kcal
      </span>
    </div>
  )
}
