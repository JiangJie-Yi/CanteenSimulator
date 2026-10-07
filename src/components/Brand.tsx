/**
 * Shop sign in the style of an old Shōwa / Taiwanese eatery board: a vermilion lacquered plate with a cream
 * double rule, 甲粗飽 in retro Mincho and 食堂 stacked small beside it. It hangs from two cords and sways a
 * little in the breeze. At night the board lights up like a lightbox and a 深夜 stamp is pressed on beside it.
 */
export function Brand({ night }: { night: boolean }) {
  return (
    <h1 className={`brand${night ? ' brand-night' : ''}`} aria-label={night ? '甲粗飽食堂 深夜' : '甲粗飽食堂'}>
      <span className="brand-plate" aria-hidden="true">
        <span className="brand-cord brand-cord-left" />
        <span className="brand-cord brand-cord-right" />
        <span className="brand-main">甲粗飽</span>
        <span className="brand-sub">食堂</span>
      </span>
      {/* keyed so the stamp animation replays each time night falls */}
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
