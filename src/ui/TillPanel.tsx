import { memo, useEffect, useState } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import { drawerTotal, takeTakings, type Denom, type DrawerCash } from '@/game/till'
import { usePanelSound } from './uiSound'

/**
 * The till's own panel (item 366, the owner's, 2026-11-19: 「收銀櫃的錢要另外畫個介面，可以與總金額結合」): opened from the till's chip beside
 * the cash (CashChip) or by pulling the register's drawer out by hand in the room. At its head all the shop's money, the cash in hand and
 * what's in the till, a bar to show the share of each; under it the drawer as it is in the room, the notes in their compartments and the
 * coins in their cups, each with how many and what they come to, a click on one taking it out to the cash in hand (as a click on it in the
 * room does); the day's takings out, leaving the float for change, or all of it; and the day so far as the closing sheet will reckon it.
 */

/** the notes' and the coins' looks, as the room's (shops/grill/Cash): the 2024 series' colours, the coins' metals */
const NOTE_LOOK: Record<number, { paper: string; ink: string }> = {
  10000: { paper: '#e2d6b4', ink: '#5e4a26' }, 5000: { paper: '#ddd0e6', ink: '#5a3d7c' }, 1000: { paper: '#cfdcea', ink: '#2e4d78' },
}
const COIN_LOOK: Record<number, { base: string; edge: string; hole?: boolean }> = {
  500: { base: '#d6bd6c', edge: '#8c7634' }, 100: { base: '#dcdedf', edge: '#96989a' }, 50: { base: '#d6d8da', edge: '#8c8e90', hole: true },
  10: { base: '#c4794c', edge: '#7e4624' }, 5: { base: '#d6b65c', edge: '#8e7230', hole: true }, 1: { base: '#e4e6e7', edge: '#9a9c9e' },
}
const NOTES: Denom[] = [10000, 5000, 1000]
const COINS: Denom[] = [500, 100, 50, 10, 5, 1]
const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`

/** the day so far, as the closing sheet reckons it (App's, from the books at the opening): null before the shop's opened */
export type TillDay = { from: string; revenue: number; cashIn: number; taken: number; spent: number; profit: number } | null

export const TillPanel = memo(function TillPanel({ lang, open, cash, read, locked, today, onTake, onTakings, onAll, onLedger, onClose }: {
  lang: Lang; open: boolean; cash: number
  /** what's in the drawer now (game/till, kept in the room: read a few times a second while open) */
  read: () => DrawerCash
  /** the drawer locked with its key (the room's register): nothing can be taken till it's turned */
  locked: () => boolean
  today: TillDay
  onTake: (k: Denom) => void; onTakings: () => void; onAll: () => void; onLedger: () => void; onClose: () => void
}) {
  usePanelSound(open)
  const [d, setD] = useState(read)
  const [shut, setShut] = useState(locked)
  useEffect(() => {
    if (!open) return
    const look = () => { setD(read()); setShut(locked()) }
    look()
    const t = window.setInterval(look, 250)
    return () => window.clearInterval(t)
  }, [open, read, locked])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); e.preventDefault() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  if (!open) return null
  const t3 = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const inTill = drawerTotal(d), total = Math.max(0, cash) + inTill
  const takings = takeTakings(d).amount
  const share = total > 0 ? Math.max(0, cash) / total : 1
  const face = (k: Denom) => k.toLocaleString()
  const slot = (k: Denom, coin: boolean) => {
    const n = d[k], sum = n * k
    const tip = shut ? t3('抽屜上鎖了：到收銀機轉一下鑰匙', '引き出しに鍵：レジで鍵を回す', 'The drawer is locked: turn its key at the till')
      : n ? t3(`點一下取出 ${money(sum)}，加進手上現金`, `クリックで ${money(sum)} を取り出し、手元の現金へ`, `Click to take ${money(sum)} into the cash in hand`)
        : t3('這格是空的', 'この仕切りは空', 'This one is empty')
    return (
      <button key={k} type="button" className={`till-slot ${coin ? 'is-coin' : 'is-note'}${n ? '' : ' is-empty'}`} disabled={!n || shut} title={tip}
        onClick={() => onTake(k)}>
        <span className="till-art" aria-hidden="true">
          {coin ? (
            // (a heap of the coin, up to three showing, more as there are more)
            Array.from({ length: Math.min(3, Math.ceil(n / 6)) }, (_, i) => (
              <i key={i} className={COIN_LOOK[k].hole ? 'has-hole' : ''} style={{ background: `radial-gradient(circle at 38% 34%, #fff8 0 18%, ${COIN_LOOK[k].base} 46%, ${COIN_LOOK[k].edge} 100%)`,
                translate: `${(i - 1) * 7}px ${-i * 3}px` }} />
            ))
          ) : (
            // (a stack of the note, its colour, a few edges showing under the top one as there are more)
            <i style={{ background: NOTE_LOOK[k].paper, color: NOTE_LOOK[k].ink, boxShadow: Array.from({ length: Math.min(4, Math.max(0, n - 1)) }, (_, j) => `${j + 1}px ${(j + 1) * 2}px 0 -0.5px ${NOTE_LOOK[k].ink}55`).join(', ') || 'none' }}>
              <b>{face(k)}</b>
            </i>
          )}
        </span>
        {coin && <b className="till-face">{face(k)}</b>}
        <em className="till-n">×{n}</em>
        <small className="till-sum">{money(sum)}</small>
      </button>
    )
  }
  return (
    <section className="till-panel" role="dialog" aria-label={t3('收銀機', 'レジ', 'Till')}>
      <header className="till-head">
        <TillGlyph />
        <b>{t3('收銀機', 'レジ', 'Till')}</b>
        <button type="button" className="panel-x" onClick={onClose} aria-label={t3('關閉', '閉じる', 'Close')}>×</button>
      </header>
      {/* (all the money, and the share of it in hand and in the till) */}
      <div className="till-total">
        <span>{t3('總資金', '総資金', 'All the money')}</span>
        <b className="money">{money(total)}</b>
      </div>
      <div className="till-bar" aria-hidden="true"><i style={{ width: `${(share * 100).toFixed(1)}%` }} /></div>
      <p className="till-split">
        <span className="is-cash" title={t3('可以拿來付錢的現金（採買、薪水、房租）', '支払いに使える現金（仕入れ・給料・家賃）', 'Cash to pay with (stock, wages, rent)')}>
          {t3('手上現金', '手元の現金', 'In hand')} <b>{money(cash)}</b></span>
        <span className="is-till" title={t3('付現的客人付的錢在抽屜裡，取出來才能用', '現金払いの代金は引き出しの中、取り出すと使える', "Cash customers' money, in the drawer till it's taken out")}>
          {t3('收銀機裡', 'レジの中', 'In the till')} <b>{money(inTill)}</b></span>
      </p>
      {/* (the drawer as it is in the room: the notes behind, the coins in front) */}
      <div className={`till-tray${shut ? ' is-locked' : ''}`}>
        <div className="till-notes">{NOTES.map((k) => slot(k, false))}</div>
        <div className="till-coins">{COINS.map((k) => slot(k, true))}</div>
        {shut && <p className="till-lock">{t3('抽屜上鎖了：到收銀機轉一下鑰匙', '引き出しに鍵：レジで鍵を回す', 'Locked: turn its key at the till')}</p>}
      </div>
      <div className="till-acts">
        <button type="button" disabled={shut || takings <= 0} onClick={onTakings}
          title={t3('把開店零錢以外的錢取出來（從大鈔先拿，零錢留著找）', '釣り銭準備金を残して取り出す（大きいお札から）', 'Take out all but the float (the big notes first, the change left)')}>
          {t3('取出營收', '売上を回収', 'Take the takings')} <b>{money(takings)}</b></button>
        <button type="button" disabled={shut || inTill <= 0} onClick={onAll}
          title={t3('連找零的零錢一起全部取出', '釣り銭も含めて全部取り出す', 'Everything, the change too')}>
          {t3('全部取出', '全部取り出す', 'Take it all')} <b>{money(inTill)}</b></button>
      </div>
      {/* (the day so far, as the closing sheet will have it) */}
      <div className="till-day">
        {today ? (<>
          <p className="till-day-head">{t3(`今天（${today.from} 開店起）`, `今日（${today.from} 開店から）`, `Today (open since ${today.from})`)}</p>
          <dl>
            <dt>{t3('營收', '売上', 'Takings')}</dt><dd className="is-in">{money(today.revenue)}</dd>
            <dt>{t3('付現進收銀機', '現金でレジへ', 'Paid in cash')}</dt><dd>{money(today.cashIn)}</dd>
            <dt>{t3('從收銀機取出', 'レジから回収', 'Taken from the till')}</dt><dd>{money(today.taken)}</dd>
            <dt>{t3('成本與費用', '原価と経費', 'Costs')}</dt><dd className="is-out">−{money(today.spent)}</dd>
            <dt>{t3('淨利', '純利益', 'Profit')}</dt><dd className={today.profit < 0 ? 'is-out' : 'is-in'}>{today.profit < 0 ? '−' : ''}{money(Math.abs(today.profit))}</dd>
          </dl>
        </>) : <p className="till-day-head">{t3('今天還沒開店', '今日はまだ開店していない', 'Not open yet today')}</p>}
      </div>
      <footer className="till-foot">
        <button type="button" onClick={onLedger}>{t3('看帳簿', '帳簿を見る', 'The ledger')}</button>
      </footer>
    </section>
  )
})

/** the till, drawn: its body, the display on its stalk, the drawer out with a note in it */
export function TillGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg className="till-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="2.5" width="9" height="4.5" rx="1" fill="#2c3a34" stroke="currentColor" strokeWidth="1.1" />
      <path d="M13.5 7v2.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 9.5h16l1.2 6H2.8z" fill="#efe6d2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6.5 11.6h2M10 11.6h2M13.5 11.6h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="2.5" y="15.5" width="19" height="5.5" rx="1" fill="#d4b25c" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 18.2h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
