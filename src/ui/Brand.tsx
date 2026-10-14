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

/** the grill's fish-shaped board's painted rule, just inside its edge (the board's own outline is in the CSS) */
const FISH_RULE = 'M3 26Q7 15 16 11Q30 8 50 8Q66 9 76 13Q82 17 86 21L96 9Q92 25 96 41L86 29Q82 33 76 37Q66 41 50 42Q30 42 16 39Q7 36 3 26Z'
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
          <span className="brand-fishboard" />
          <svg className="brand-fish" viewBox="0 0 100 50" preserveAspectRatio="none">
            <path className="brand-fish-rule" d={FISH_RULE} />
            {/* a saury (秋刀魚): long and slim, its jaw pointed, its back dark, the small finlets toward its forked tail */}
            <path className="brand-fish-back" d="M14 11.5Q40 7.5 64 9Q74 10.5 82 16" />
            <path className="brand-fish-line" d="M13 15q4 10 0 20M88 22l9-11M88 28l9 11M89 25h8" />
            <path className="brand-fish-scale" d="M70 11.5l2-2.5 1 2.6M75 13l2-2.4 1 2.5M79 15.5l1.8-2.2.8 2.4M75 37l2 2.4 1-2.5M79 34.5l1.8 2.2.8-2.4" />
            <ellipse className="brand-fish-eye" cx="8" cy="23.5" rx="1.5" ry="3" />
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
