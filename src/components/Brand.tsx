import type { Lang } from '../i18n'

// each shop has its own name and its own kind of sign
//   noodles  甲粗飽 食堂 — Taiwanese for "eat your fill": a vermilion lacquered board on two cords
//   grill    聞野 燒烤  — "smelt from out in the fields": a board of charred cedar (焼杉), white brush lettering
//            and a red seal
//   hot pot  鼎沸 火鍋  — "bubbling like a cauldron": a round-cornered red-and-gold plaque with a flame crest
const NAMES: Record<string, Record<Lang, { main: string; sub: string }>> = {
  beefnoodle: { zh: { main: '甲粗飽', sub: '食堂' }, ja: { main: 'たらふく', sub: '食堂' } },
  grilledfish: { zh: { main: '聞野', sub: '燒烤' }, ja: { main: '聞野', sub: '炭火焼' } },
  hotpot: { zh: { main: '鼎沸', sub: '火鍋' }, ja: { main: '鼎沸', sub: '鍋' } },
}

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
        <span className="brand-main">{main}</span>
        <span className="brand-sub">{sub}</span>
        {shop === 'grilledfish' && <span className="brand-seal">炭</span>}
      </span>
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
