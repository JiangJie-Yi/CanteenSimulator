// The day's closing sheet (the owner's: once the last customer's out of the door and the staff have gone home, the day's takings): the day,
// the profit large (green, or red at a loss), what came in and what went out, who came and how pleased they were, the dish that sold best.
// In the middle of the page over the shut shop; × , the button below, Esc or a click outside put it away, and it goes by itself after
// AUTO_S seconds (the owner's: the game stands still while it's up, App's GAME_SPEED; it goes on after); a bar along its foot runs down.
import { useEffect, useRef, useState } from 'react'
import { CLOSE_AT, OPEN_AT, lateBy, minutesOf } from '@/game/hours'
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'
import { adviceOf, type DaySummary as Summary } from '@/game/daySummary'
import { Glyph, Stars } from './GameIcons'
import { FitLine } from './FitLine'

/** how long (s, of real time: the game's clock stands still meanwhile) it stays up by itself; a few more with things to point out, to
 * read them (item 329) */
export const AUTO_S = 10
const AUTO_TIPS_S = 16
const nt = (n: number) => `NT$${Math.round(n).toLocaleString('en-US')}`

export function DaySummary({ s, day, hours, lang, nameOf, onClose }: { s: Summary; day: number; hours?: [string, string]; lang: Lang; nameOf: (key: string) => string; onClose: () => void }) {
  /** how far off its hour a time was, as a small note after it (none if on the minute) */
  const offBy = (hour: number, hhmm: string) => {
    const at = minutesOf(hhmm)
    if (at === null) return null
    const d = lateBy(hour, at)
    if (d === 0) return null
    const n = Math.abs(d), hm = n >= 60 ? (lang === 'en' ? `${Math.floor(n / 60)} h ${n % 60} min` : lang === 'ja' ? `${Math.floor(n / 60)}時間${n % 60}分` : `${Math.floor(n / 60)} 小時 ${n % 60} 分`)
      : (lang === 'en' ? `${n} min` : lang === 'ja' ? `${n}分` : `${n} 分`)
    return <small className={`day-sum-late${d > 0 ? ' is-late' : ''}`}>{d > 0 ? (lang === 'en' ? ` (${hm} late)` : lang === 'ja' ? `（${hm}遅れ）` : `（晚 ${hm}）`)
      : (lang === 'en' ? ` (${hm} early)` : lang === 'ja' ? `（${hm}早い）` : `（提早 ${hm}）`)}</small>
  }
  const t = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  // (what could be done better, past where a shop's usually run (game/daySummary's adviceOf, item 329))
  const tips = adviceOf(s)
  const auto = tips.length ? AUTO_TIPS_S : AUTO_S
  const [left, setLeft] = useState(auto)
  // (counted from when it came up, once: the page above redraws every second or so (the staff resting), each time with a new onClose)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const t0 = performance.now()
    const tick = window.setInterval(() => {
      const l = Math.max(0, Math.ceil(auto - (performance.now() - t0) / 1000))
      setLeft(l)
      if (l <= 0) { window.clearInterval(tick); close.current() }
    }, 250)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current() } }
    window.addEventListener('keydown', key, true)
    return () => { window.clearInterval(tick); window.removeEventListener('keydown', key, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // (each line: its label, the sum, whether it came in; `sub`, a part of the line above it, already in it (the wages' premiums))
  type Row = [string, number, boolean, boolean?]
  const rows: Row[] = [
    [t('營業額', '売上', 'Takings'), s.revenue, true],
    // (given back to those who left before it all came, out of the takings already (item 329))
    ...(s.refunds > 0.5 ? [[t('已扣退款（沒吃完就走）', 'うち返金（食べきれず退店）', 'less refunds (left before it came)'), -s.refunds, false, true] as Row] : []),
    [t('食材', '食材', 'Food'), -s.food, false],
    ...(s.tossed > 0.5 ? [[t('其中丟掉的食材', 'うち廃棄した食材', 'of which thrown away'), -s.tossed, false, true] as Row] : []),
    [t('燃料（備長炭）', '燃料（備長炭）', 'Charcoal'), -s.fuel, false],
    [t('人事', '人件費', 'Wages'), -s.wage, false],
    // (of the wages, what was paid over the hour's pay, as Japan's labour law has it (game/hours, item 210): past eight hours, and the night's)
    ...(s.overtime > 0.5 ? [[t('其中加班費（超過 8 小時）', 'うち残業代（8 時間超）', 'of which overtime (past 8 h)'), -s.overtime, false, true] as Row] : []),
    ...(s.night > 0.5 ? [[t('其中深夜加給（22 點後）', 'うち深夜割増（22 時以降）', 'of which night pay (after 22:00)'), -s.night, false, true] as Row] : []),
    [t('水電', '光熱費', 'Power & water'), -s.utility, false],
    // (the rent, the delivery platform's cut and the card company's fee (item 210): a line each, on a day there was any)
    ...(s.rent > 0 ? [[t('房租', '家賃', 'Rent'), -s.rent, false] as Row] : []),
    ...(s.platform > 0.5 ? [[t('外送平台抽成', 'デリバリー手数料', 'Delivery platform'), -s.platform, false] as Row] : []),
    ...(s.cardFee > 0.5 ? [[t('刷卡手續費', 'カード決済手数料', 'Card fees'), -s.cardFee, false] as Row] : []),
    // (the reviews bought and the shrine's offerings, out of the profit too (item 203): a line only on a day there were any)
    ...(s.other > 0 ? [[t('宣傳與供品', '宣伝・お供え', 'Promotion & offerings'), -s.other, false] as Row] : []),
  ]
  const stars = s.stars === null ? null : Math.round(s.stars * 10) / 10
  return createPortal(
    <div className="day-sum-veil" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="day-sum" role="dialog" aria-label={t('打烊結算', '閉店の締め', "The day's takings")}>
        <header>
          <h2>{t(`第 ${day} 天・打烊結算`, `${day} 日目・閉店の締め`, `Day ${day} · closing up`)}</h2>
          <button type="button" className="panel-x" onClick={onClose} aria-label={t('關閉', '閉じる', 'Close')}>×</button>
        </header>
        <div className="day-sum-body">
          {/* (when it opened and when it closed (the owner's: the sheet says what time the day's business ended)) */}
          {/* (and how late either was, past 16:30 and 04:30 (the owner's, 2026-11-10); early, how early) */}
          {hours && (
            <p className="day-sum-hours">
              {/* (on one line, smaller where it's long: both late by hours) */}
              <FitLine min={9}>
                {t(`${hours[0]} 開店`, `${hours[0]} 開店`, `Opened ${hours[0]}`)}{offBy(OPEN_AT, hours[0])}
                {t('・', '・', ' · ')}
                {t(`${hours[1]} 結束營業`, `${hours[1]} 閉店`, `closed ${hours[1]}`)}{offBy(CLOSE_AT, hours[1])}
              </FitLine>
            </p>
          )}
          <p className={`day-sum-profit${s.profit < 0 ? ' is-loss' : ''}`}>
            <span>{t('今日利潤', '本日の利益', "Today's profit")}</span>
            <strong>{s.profit < 0 ? '−' : ''}{nt(Math.abs(s.profit))}</strong>
            {s.margin !== null && <small>{t('利潤率', '利益率', 'Margin')} {Math.round(s.margin * 100)}%
              {/* (and the wages over the takings (人件費率, item 210)) */}
              {s.labour !== null && t(`・人事費率 ${Math.round(s.labour * 100)}%`, `・人件費率 ${Math.round(s.labour * 100)}%`, ` · Labour ${Math.round(s.labour * 100)}%`)}</small>}
          </p>
          <dl className="day-sum-books">
            {rows.map(([label, n, plus, sub]) => (
              <div key={label} className={sub ? 'is-sub' : undefined}><dt>{label}</dt><dd className={plus ? 'is-in' : 'is-out'}>{plus || sub ? '' : '−'}{nt(Math.abs(n))}</dd></div>
            ))}
          </dl>
          <dl className="day-sum-guests">
            <div><dt>{t('來客', '来客', 'Customers')}</dt><dd>{t(`${s.guests} 位`, `${s.guests} 名`, `${s.guests}`)}{s.walkedOut > 0 && <small>{t(`（${s.walkedOut} 位沒吃就走）`, `（${s.walkedOut} 名が食べずに帰った）`, ` (${s.walkedOut} left without eating)`)}</small>}</dd></div>
            <div><dt>{t('平均評價', '平均評価', 'Rating')}</dt><dd>{stars === null ? '—' : <><span className="day-sum-stars"><Stars value={stars} /></span> {stars.toFixed(1)}</>}</dd></div>
            <div><dt>{t('最暢銷', '一番人気', 'Best seller')}</dt><dd className="day-sum-best"><FitLine>{s.best ? `${nameOf(s.best.key)} ×${s.best.n}` : '—'}</FitLine></dd></div>
          </dl>
          {/* (what could be done better: past where a shop's usually run, what it came to and what to try (item 329)) */}
          {tips.length > 0 && (
            <ul className="day-sum-tips" aria-label={t('可以改進的地方', '改善できるところ', 'What could be better')}>
              {tips.map((a) => {
                const pct = Math.round(a.share * 100)
                const [head, hint] = a.kind === 'labour'
                  ? [t(`人事費率 ${pct}%，一般店約三成`, `人件費率 ${pct}%（普通は3割ほど）`, `Wages ${pct}% of takings (a shop runs on ~30%)`),
                    t(`今天 ${s.guests} 位客人，排班可以少一兩位`, `本日の来客 ${s.guests} 名、シフトを1、2人減らせる`, `${s.guests} customers: one or two fewer on the rota`)]
                  : a.kind === 'tossed'
                    ? [t(`丟掉的食材 ${nt(a.amount)}（食材的 ${pct}%）`, `廃棄した食材 ${nt(a.amount)}（食材の${pct}%）`, `Food thrown away ${nt(a.amount)} (${pct}%)`),
                      t('叫貨少一點，先賣快壞的', '仕入れを減らし、傷みかけから売る', "Order less, sell what's going off first")]
                    : [t(`退款 ${nt(a.amount)}（菜沒上完就走）`, `返金 ${nt(a.amount)}（食べきれず退店）`, `Refunds ${nt(a.amount)} (left before it came)`),
                      t('出菜太慢：多一位廚手，或少放烤很久的魚', '料理が遅い：調理を一人増やすか、焼きの長い魚を減らす', 'Too slow: another cook, or fewer slow fish')]
                return (
                  <li key={a.kind}><Glyph id="bolt" size="13px" /><span><b><FitLine>{head}</FitLine></b><small><FitLine>{hint}</FitLine></small></span></li>
                )
              })}
            </ul>
          )}
          <button type="button" className="day-sum-ok" onClick={onClose}>{t('收工', 'お疲れさま', 'Done for the day')}</button>
          <small className="day-sum-auto">{t(`${left} 秒後自動關閉`, `${left} 秒後に閉じます`, `Closing in ${left}s`)}</small>
        </div>
        <i className="day-sum-timer" style={{ animationDuration: `${auto}s` }} aria-hidden="true" />
      </section>
    </div>,
    document.body,
  )
}
