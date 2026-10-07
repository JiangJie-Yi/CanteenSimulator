import type { Lang } from '../i18n'

// the shop name per language: 甲粗飽 is Taiwanese for "eat your fill", which Japanese says as たらふく
const NAME = {
  zh: { main: '甲粗飽', sub: '食堂' },
  ja: { main: 'たらふく', sub: '食堂' },
}

/**
 * Shop sign in the style of an old Shōwa / Taiwanese eatery board: a vermilion lacquered plate with a cream
 * double rule, the name in retro Mincho and 食堂 stacked small beside it. It hangs from two cords and sways a
 * little in the breeze. At night the board lights up like a lightbox and a 深夜 stamp is pressed on beside it.
 */
export function Brand({ night, lang }: { night: boolean; lang: Lang }) {
  const { main, sub } = NAME[lang]
  return (
    <h1 className={`brand${night ? ' brand-night' : ''} brand-${lang}`} lang={lang === 'ja' ? 'ja' : 'zh-Hant'}
      aria-label={`${main}${sub}${night ? ' 深夜' : ''}`}>
      <span className="brand-plate" aria-hidden="true">
        <span className="brand-cord brand-cord-left" />
        <span className="brand-cord brand-cord-right" />
        <span className="brand-main">{main}</span>
        <span className="brand-sub">{sub}</span>
      </span>
      {/* keyed so the stamp animation replays each time night falls */}
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
