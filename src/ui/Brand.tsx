import type { Lang } from '@/data/i18n'

// the shop's name: 聞野 日式烤魚 ("smelt from out in the fields"), on a vermilion lacquered board cut like a fish
const NAMES: Record<string, Record<Lang, { main: string; sub: string }>> = {
  grilledfish: { zh: { main: '聞野', sub: '日式烤魚' }, ja: { main: '聞野', sub: '炭火焼' } },
}

/**
 * The grill's fish-shaped board: its outline (the corners of a fish in percent of the board's box), cut as a path with
 * every corner rounded off (the curve runs from the middle of one side to the middle of the next, the corner between
 * them as its control point), so nothing on it is sharp: used to clip the board in the CSS (a clipPath in the box's units).
 */
const FISH_BOARD: [number, number][] = [[0, 50], [3, 30], [9, 16], [19, 7], [40, 2], [63, 6], [76, 15], [83, 36], [100, 6], [96, 50],
  [100, 94], [83, 64], [76, 85], [63, 94], [40, 98], [19, 93], [9, 84], [3, 70]]
const FISH_BOARD_PATH = (() => {
  const n = FISH_BOARD.length
  const f = (v: number) => (v / 100).toFixed(4)
  const mid = (a: [number, number], b: [number, number]) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`
  let d = `M${mid(FISH_BOARD[n - 1], FISH_BOARD[0])}`
  for (let i = 0; i < n; i++) {
    const p = FISH_BOARD[i], q = FISH_BOARD[(i + 1) % n]
    d += `Q${f(p[0])} ${f(p[1])} ${mid(p, q)}`
  }
  return `${d}Z`
})()
/** the grill's fish-shaped board's painted rule, just inside its edge */
const FISH_RULE = 'M3 25Q6 11 18 7Q40 3 64 7Q76 10 83 22L94 9Q91 25 94 41L83 28Q76 40 64 43Q40 47 18 43Q6 39 3 25Z'
/**
 * The shop's sign, top-left: it hangs from two cords and sways a little in the breeze, and at night its lettering
 * lights up (and a 深夜 stamp is pressed on beside it).
 */
export function Brand({ night, lang, shop = 'grilledfish', dark = false, ignite = 0, onClick }:
  { night: boolean; lang: Lang; shop?: string; dark?: boolean; ignite?: number; onClick?: () => void }) {
  const { main, sub } = (NAMES[shop] ?? NAMES.grilledfish)[lang]
  return (
    // dark: the business hasn't been founded yet (the sign is unlit); ignite: it's just been founded (it comes to life)
    <h1 key={`${shop}-${ignite}`} className={`brand brand-${shop}${night ? ' brand-night' : ''} brand-${lang}${dark ? ' brand-dark' : ''}${ignite ? ' brand-ignite' : ''}`}
      lang={lang === 'ja' ? 'ja' : 'zh-Hant'} aria-label={`${main}${sub}${night ? ' 深夜' : ''}`}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      style={onClick ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}>
      <span className="brand-plate" aria-hidden="true">
        <span className="brand-cord brand-cord-left" />
        <span className="brand-cord brand-cord-right" />
        {shop === 'grilledfish' && (
          // the board cut in the shape of a fish, nose to the left: its painted rule following its edge, an eye, the
          // line of its gill, a few scales and the rays of its tail
          <>
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <clipPath id="fish-board" clipPathUnits="objectBoundingBox"><path d={FISH_BOARD_PATH} /></clipPath>
          </svg>
          <span className="brand-fishboard" />
          <svg className="brand-fish" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path className="brand-fish-rule" d={FISH_RULE} />
            <path className="brand-fish-line" d="M17 14q5 11 0 22M84 25l11-15M84 25l11 15M86 25h10" />
            <path className="brand-fish-scale" d="M66 16q3 4 0 8M72 18q3 4 0 8M66 26q3 4 0 8M72 28q3 4 0 8" />
          </svg>
          {/* (the eye: an HTML dot, so it's a true circle however the board's stretched) */}
          <span className="brand-fish-eyedot" />
          </>
        )}
        <span className="brand-main">{main}</span>
        <span className="brand-sub">{sub}</span>
      </span>
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
