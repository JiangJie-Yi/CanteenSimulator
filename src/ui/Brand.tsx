import type { Lang } from '@/data/i18n'

// each shop has its own name and its own kind of sign
//   noodles  甲粗飽 食堂 — Taiwanese for "eat your fill": a vermilion lacquered board on two cords
//   grill    聞野 日式烤魚 — "smelt from out in the fields": the same vermilion lacquered board as the first sign
//   hot pot  鼎沸 火鍋  — "bubbling like a cauldron": a round-cornered red-and-gold plaque with a flame crest
//   bakery   麥田 烘焙  — "wheat field", a French-style bakery: a cream-painted board edged in brown, with a wheat ear
const NAMES: Record<string, Record<Lang, { main: string; sub: string }>> = {
  beefnoodle: { zh: { main: '甲粗飽', sub: '食堂' }, ja: { main: 'たらふく', sub: '食堂' } },
  grilledfish: { zh: { main: '聞野', sub: '日式烤魚' }, ja: { main: '聞野', sub: '炭火焼' } },
  hotpot: { zh: { main: '鼎沸', sub: '火鍋' }, ja: { main: '鼎沸', sub: '鍋' } },
  bakery: { zh: { main: '麥田', sub: '烘焙' }, ja: { main: '麦田', sub: 'ベーカリー' } },
}

/**
 * The grill's board, cut to a saury (秋刀魚) in a box 100 wide by 50 high: a pointed jaw, a long slim body, a row of
 * finlets on the back and the belly toward a forked tail. (The CSS clip-path is made from these same points.)
 */
const FISH: [number, number][] = [
  [0, 26], [1.5, 24.2], [4, 22.2], [8, 19.2], [13, 16.8], [20, 14.9], [30, 13.5], [44, 12.7], [56, 12.9],
  [60, 12.9], [62, 11.2], [63.5, 13.1], [66, 11.5], [67.5, 13.4], [70, 11.9], [71.5, 14], [74, 12.6], [75.5, 14.9], [78, 13.9],
  [82, 17.5], [86, 22], [88.5, 24.5], [93, 16], [100, 6.5], [96.5, 25], [100, 43.5], [93, 34], [88.5, 27], [86, 30], [82, 34.5],
  [78, 36.4], [75.5, 37.6], [74, 39.8], [71.5, 38.6], [70, 40.4], [67.5, 39.2], [66, 41], [63.5, 39.6], [62, 41.3], [60, 39.6],
  [56, 39.5], [44, 39.1], [30, 38.2], [20, 36], [13, 32.8], [8, 29.8], [4, 28.2], [1, 27.2],
]
const FISH_PATH = `M${FISH.map(([x, y]) => `${x} ${y}`).join('L')}Z`
const FISH_CLIP = `polygon(${FISH.map(([x, y]) => `${x}% ${y * 2}%`).join(', ')})`
/**
 * The shop's sign, top-left: it hangs from two cords and sways a little in the breeze, and at night its lettering
 * lights up (and a 深夜 stamp is pressed on beside it). Which sign depends on which shop is on screen.
 */
export function Brand({ night, lang, shop = 'beefnoodle', dark = false, ignite = 0, onClick }:
  { night: boolean; lang: Lang; shop?: string; dark?: boolean; ignite?: number; onClick?: () => void }) {
  const { main, sub } = (NAMES[shop] ?? NAMES.beefnoodle)[lang]
  return (
    // dark: the business hasn't been founded yet (the sign is unlit); ignite: it's just been founded (it comes to life)
    <h1 key={`${shop}-${ignite}`} className={`brand brand-${shop}${night ? ' brand-night' : ''} brand-${lang}${dark ? ' brand-dark' : ''}${ignite ? ' brand-ignite' : ''}`}
      lang={lang === 'ja' ? 'ja' : 'zh-Hant'} aria-label={`${main}${sub}${night ? ' 深夜' : ''}`}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      style={onClick ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}>
      <span className="brand-plate" aria-hidden="true">
        <span className="brand-cord brand-cord-left" />
        <span className="brand-cord brand-cord-right" />
        {shop === 'hotpot' && (
          <svg className="brand-flame" viewBox="0 0 20 24">
            <path d="M10 1c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-7 0 3 1 4 2 4 0-4 1-7 2-10z" />
          </svg>
        )}
        {shop === 'grilledfish' && (
          // the board cut in the shape of a fish, nose to the left: its painted rule following its edge, an eye, the
          // line of its gill, a few scales and the rays of its tail
          <>
          <span className="brand-fishboard" style={{ clipPath: FISH_CLIP }} />
          <svg className="brand-fish" viewBox="0 0 100 50" preserveAspectRatio="none">
            <defs>
              <clipPath id="fish-body"><path d={FISH_PATH} /></clipPath>
              <pattern id="fish-scales" width="3.4" height="3" patternUnits="userSpaceOnUse">
                <path d="M0 3Q1.7 0.2 3.4 3M-1.7 1.5Q0 -1.3 1.7 1.5M1.7 1.5Q3.4 -1.3 5.1 1.5" />
              </pattern>
              <linearGradient id="fish-back" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0c0604" stopOpacity="0.62" /><stop offset="1" stopColor="#0c0604" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fish-belly" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#fff2d6" stopOpacity="0.34" /><stop offset="1" stopColor="#fff2d6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g clipPath="url(#fish-body)">
              {/* the dark back fading down its flanks, the pale belly, the scales over the middle */}
              <rect x="0" y="10" width="100" height="16" fill="url(#fish-back)" stroke="none" />
              <rect x="0" y="26" width="100" height="16" fill="url(#fish-belly)" stroke="none" />
              <rect className="brand-fish-scales" x="14" y="16" width="74" height="22" fill="url(#fish-scales)" />
            </g>
            {/* carved round its edge: a dark cut, and the painted rule inside it */}
            <path className="brand-fish-cut" d={FISH_PATH} />
            <g transform="translate(50 26) scale(0.95 0.86) translate(-50 -26)"><path className="brand-fish-rule" d={FISH_PATH} /></g>
            {/* the gill covers, the silver line down its side, the mouth, the pectoral fin, the tail's rays */}
            <path className="brand-fish-line" d="M17.2 17.6Q22.4 26 17.4 34.2M19.8 18.4Q24.4 26 20 33.6" />
            <path className="brand-fish-silver" d="M21 25.4Q52 23 87 25.2" />
            <path className="brand-fish-line" d="M0.8 26.2L7 26.7M22.5 31Q27.4 32.6 31.4 37.4Q25.4 36.4 22.5 31Z" />
            <path className="brand-fish-line" d="M89 25L98.6 8.6M89.4 25L98 14.6M89.6 25L97.6 20M89 25.6L98.6 41.6M89.4 25.6L98 35.6M89.6 25.6L97.6 30.6M90 25.3H96" />
            <circle className="brand-fish-ring" cx="9.4" cy="22.8" r="2.3" />
            <circle className="brand-fish-pupil" cx="9.4" cy="22.8" r="1.15" />
          </svg>
          </>
        )}
        {shop === 'bakery' && (
          <svg className="brand-wheat" viewBox="0 0 16 28">
            <path d="M8 27V6M8 9c-3-1-4-4-3-6 2 1 3 3 3 6zm0 0c3-1 4-4 3-6-2 1-3 3-3 6zM8 15c-3-1-4-4-3-6 2 1 3 3 3 6zm0 0c3-1 4-4 3-6-2 1-3 3-3 6zM8 21c-3-1-4-4-3-6 2 1 3 3 3 6zm0 0c3-1 4-4 3-6-2 1-3 3-3 6z" />
          </svg>
        )}
        <span className="brand-main">{main}</span>
        <span className="brand-sub">{sub}</span>
      </span>
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
