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
  [0, 25], [1.5, 20], [4, 15], [8, 10.5], [13, 7], [19, 4],
  [27, 2.25], [36, 1.25], [46, 1], [56, 1.5], [65, 3], [72, 5.5],
  [78, 9.5], [82, 15], [84, 18], [88, 15], [93, 9], [98, 4],
  [100, 2.5], [96, 25], [100, 47.5], [98, 46], [93, 41], [88, 35],
  [84, 32], [82, 35], [78, 40.5], [72, 44.5], [65, 47], [56, 48.5],
  [46, 49], [36, 48.75], [27, 47.75], [19, 46], [13, 43], [8, 39.5],
  [4, 35], [1.5, 30],
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
              <rect x="0" y="0" width="100" height="26" fill="url(#fish-back)" stroke="none" />
              <rect x="0" y="26" width="100" height="24" fill="url(#fish-belly)" stroke="none" />
              <rect className="brand-fish-scales" x="24" y="9" width="60" height="32" fill="url(#fish-scales)" />
            </g>
            {/* carved round its edge: a dark cut, and the painted rule inside it */}
            <path className="brand-fish-cut" d={FISH_PATH} />
            <g transform="translate(50 26) scale(0.95 0.86) translate(-50 -26)"><path className="brand-fish-rule" d={FISH_PATH} /></g>
            {/* the gill covers, the silver line down its side, the mouth, the pectoral fin, the tail's rays */}
            <path className="brand-fish-line" d="M20 11Q27 25 20 39M23 11.5Q29.5 25 23 38.5" />
            <path className="brand-fish-silver" d="M26 25.4Q56 22.5 84 25.2" />
            <path className="brand-fish-line" d="M0.8 25.6L6.5 26.2M26 33Q31 35 35 42Q28.5 40.4 26 33Z" />
            <path className="brand-fish-line" d="M88 25L98.6 6.6M88.4 25L98 13.6M88.6 25L97.6 19.6M88 25.6L98.6 43.4M88.4 25.6L98 36.4M88.6 25.6L97.6 30.6M89 25.3H95" />
            <circle className="brand-fish-ring" cx="10" cy="19.6" r="2.7" />
            <circle className="brand-fish-pupil" cx="10" cy="19.6" r="1.35" />
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
