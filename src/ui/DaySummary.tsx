// The day's closing sheet (the owner's: once the last customer's out of the door and the staff have gone home, the day's takings): the day,
// the profit large (green, or red at a loss), what came in and what went out, who came and how pleased they were, the dish that sold best.
// In the middle of the page over the shut shop; × , the button below, Esc or a click outside put it away.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'
import type { DaySummary as Summary } from '@/game/daySummary'

const nt = (n: number) => `NT$${Math.round(n).toLocaleString('en-US')}`

export function DaySummary({ s, day, lang, nameOf, onClose }: { s: Summary; day: number; lang: Lang; nameOf: (key: string) => string; onClose: () => void }) {
  const t = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])
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
            <div><dt>{t('平均評價', '平均評価', 'Rating')}</dt><dd>{stars === null ? '—' : <><span className="day-sum-stars" aria-hidden="true">{'★'.repeat(Math.round(stars))}{'☆'.repeat(5 - Math.round(stars))}</span> {stars.toFixed(1)}</>}</dd></div>
            <div><dt>{t('最暢銷', '一番人気', 'Best seller')}</dt><dd>{s.best ? `${nameOf(s.best.key)} ×${s.best.n}` : '—'}</dd></div>
          </dl>
          <button type="button" className="day-sum-ok" onClick={onClose}>{t('收工', 'お疲れさま', 'Done for the day')}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
