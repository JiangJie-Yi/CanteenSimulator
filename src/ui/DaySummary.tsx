// The day's closing sheet (the owner's: once the last customer's out of the door and the staff have gone home, the day's takings): the day,
// the profit large (green, or red at a loss), what came in and what went out, who came and how pleased they were, the dish that sold best.
// In the middle of the page over the shut shop; × , the button below, Esc or a click outside put it away, and it goes by itself after
// AUTO_S seconds (the owner's: the game stands still while it's up, App's GAME_SPEED; it goes on after); a bar along its foot runs down.
import { useEffect, useRef, useState } from 'react'
import { CLOSE_AT, OPEN_AT, lateBy, minutesOf } from '@/game/hours'
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'
import type { DaySummary as Summary } from '@/game/daySummary'
import { Stars } from './GameIcons'

/** how long (s, of real time: the game's clock stands still meanwhile) it stays up by itself */
export const AUTO_S = 10
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
  const [left, setLeft] = useState(AUTO_S)
  // (counted from when it came up, once: the page above redraws every second or so (the staff resting), each time with a new onClose)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const t0 = performance.now()
    const tick = window.setInterval(() => {
      const l = Math.max(0, Math.ceil(AUTO_S - (performance.now() - t0) / 1000))
      setLeft(l)
      if (l <= 0) { window.clearInterval(tick); close.current() }
    }, 250)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current() } }
    window.addEventListener('keydown', key, true)
    return () => { window.clearInterval(tick); window.removeEventListener('keydown', key, true) }
  }, [])
  const rows: [string, number, boolean][] = [
    [t('營業額', '売上', 'Takings'), s.revenue, true],
    [t('食材', '食材', 'Food'), -s.food, false],
    [t('燃料（備長炭）', '燃料（備長炭）', 'Charcoal'), -s.fuel, false],
    [t('人事', '人件費', 'Wages'), -s.wage, false],
    [t('水電', '光熱費', 'Power & water'), -s.utility, false],
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
              {t(`${hours[0]} 開店`, `${hours[0]} 開店`, `Opened ${hours[0]}`)}{offBy(OPEN_AT, hours[0])}
              {t('・', '・', ' · ')}
              {t(`${hours[1]} 結束營業`, `${hours[1]} 閉店`, `closed ${hours[1]}`)}{offBy(CLOSE_AT, hours[1])}
            </p>
          )}
          <p className={`day-sum-profit${s.profit < 0 ? ' is-loss' : ''}`}>
            <span>{t('今日利潤', '本日の利益', "Today's profit")}</span>
            <strong>{s.profit < 0 ? '−' : ''}{nt(Math.abs(s.profit))}</strong>
            {s.margin !== null && <small>{t('利潤率', '利益率', 'Margin')} {Math.round(s.margin * 100)}%</small>}
          </p>
          <dl className="day-sum-books">
            {rows.map(([label, n, plus]) => (
              <div key={label}><dt>{label}</dt><dd className={plus ? 'is-in' : 'is-out'}>{plus ? '' : '−'}{nt(Math.abs(n))}</dd></div>
            ))}
          </dl>
          <dl className="day-sum-guests">
            <div><dt>{t('來客', '来客', 'Customers')}</dt><dd>{t(`${s.guests} 位`, `${s.guests} 名`, `${s.guests}`)}{s.walkedOut > 0 && <small>{t(`（${s.walkedOut} 位沒吃就走）`, `（${s.walkedOut} 名が食べずに帰った）`, ` (${s.walkedOut} left without eating)`)}</small>}</dd></div>
            <div><dt>{t('平均評價', '平均評価', 'Rating')}</dt><dd>{stars === null ? '—' : <><span className="day-sum-stars"><Stars value={stars} /></span> {stars.toFixed(1)}</>}</dd></div>
            <div><dt>{t('最暢銷', '一番人気', 'Best seller')}</dt><dd>{s.best ? `${nameOf(s.best.key)} ×${s.best.n}` : '—'}</dd></div>
          </dl>
          <button type="button" className="day-sum-ok" onClick={onClose}>{t('收工', 'お疲れさま', 'Done for the day')}</button>
          <small className="day-sum-auto">{t(`${left} 秒後自動關閉`, `${left} 秒後に閉じます`, `Closing in ${left}s`)}</small>
        </div>
        <i className="day-sum-timer" style={{ animationDuration: `${AUTO_S}s` }} aria-hidden="true" />
      </section>
    </div>,
    document.body,
  )
}
