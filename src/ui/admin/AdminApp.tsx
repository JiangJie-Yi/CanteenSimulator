import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ADMIN_TEXT } from '@/data/adminText'
import { remarkOf, visitSides, visitStars } from '@/game/reputation'
import { EDITOR_URL, GAME_URL } from '@/scene/toolPage'
import { Glyph, StarIcon } from '@/ui/GameIcons'
import type { GlyphId } from '@/ui/glyphs'
import { listenToGame, type AdminCmd, type AdminSnap } from './link'

/**
 * The back office (item 184, admin.html): a console on the game being played in another tab of this browser (ui/admin/link), as a game
 * server's admin page is. Its flow (docs/BACKOFFICE.md): open it beside the game, it connects by itself; an overview of how the shop's doing
 * (cash, the books, the rating, who's in, the game's time), the books in full, each day's closing sheet, the reviews, the guests and the
 * orders waiting, the staff, the day's log as it's written; and the few things it can do to the game (its speed, its clock), for testing.
 * Light: no 3D, none of the game's own stylesheet.
 */
type Page = 'overview' | 'ledger' | 'days' | 'reviews' | 'guests' | 'staff' | 'log' | 'control'
const PAGES: { id: Page; icon: GlyphId }[] = [
  { id: 'overview', icon: 'eye' }, { id: 'ledger', icon: 'receipt' }, { id: 'days', icon: 'calendar' }, { id: 'reviews', icon: 'heart' },
  { id: 'guests', icon: 'people' }, { id: 'staff', icon: 'person' }, { id: 'log', icon: 'list' }, { id: 'control', icon: 'fast' },
]
const PAGE_KEY = 'jgs-admin-page-1'
/** the costs in the books (what's taken off the cash), in the order they're listed */
const COSTS = ['bought', 'fuel', 'wage', 'overtime', 'utility', 'setup', 'offering', 'promo']
const money = (n: number) => `${n < 0 ? '-' : ''}NT$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m) % 60).padStart(2, '0')}`
/** the clock's presets, as minutes of the day */
const PRESETS: Record<string, number> = { morning: 600, prep: 960, opening: 990, late: 30, closing: 240 }

function Stars({ n }: { n: number | null }) {
  if (n === null) return <span className="ad-dim">-</span>
  return (
    <span className="ad-stars">
      {[1, 2, 3, 4, 5].map((k) => <StarIcon key={k} size={12} fill={n >= k - 0.25 ? 1 : n >= k - 0.75 ? 0.5 : 0} />)}
      <b>{n.toFixed(1)}</b>
    </span>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className={`ad-tile${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub !== undefined && <small>{sub}</small>}
    </div>
  )
}

export function AdminApp() {
  const [snap, setSnap] = useState<AdminSnap | null>(null)
  const [got, setGot] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [page, setPage] = useState<Page>(() => { try { const p = localStorage.getItem(PAGE_KEY) as Page | null; return p && PAGES.some((x) => x.id === p) ? p : 'overview' } catch { return 'overview' } })
  const [said, setSaid] = useState('')
  const [custom, setCustom] = useState('17:00')
  const ask = useRef<(c: AdminCmd) => void>(() => {})
  useEffect(() => {
    const l = listenToGame((s) => { setSnap(s); setGot(Date.now()) })
    ask.current = l.ask
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { l.stop(); window.clearInterval(t) }
  }, [])
  useEffect(() => { if (!said) return; const t = window.setTimeout(() => setSaid(''), 2400); return () => window.clearTimeout(t) }, [said])
  const T = ADMIN_TEXT[snap?.lang ?? 'zh']
  useEffect(() => { document.title = `${T.title} · 烤魚經營` }, [T])
  // (connected while a snapshot's come in the last four seconds)
  const live = !!snap && now - got < 4000
  const go = (p: Page) => { setPage(p); try { localStorage.setItem(PAGE_KEY, p) } catch { /* (not kept) */ } }
  const jump = (minute: number) => {
    if (!snap) return
    ask.current({ kind: 'clock', day: snap.clock.day, minute })
    setSaid(T.jumped(hhmm(minute)))
  }

  const body = (s: AdminSnap): ReactNode => {
    const spent = COSTS.reduce((n, k) => n + (s.ledger[k] ?? 0), 0)
    const inShop = s.guests.filter((g) => g.state === 'waiting' || g.state === 'eating')
    if (page === 'overview') return (
      <>
        <div className="ad-tiles">
          <Tile label={T.cash} value={money(s.cash)} tone={s.cash >= s.capital ? 'up' : 'down'} sub={`${T.capital} ${money(s.capital)}`} />
          <Tile label={T.revenue} value={money(s.ledger.revenue ?? 0)} />
          <Tile label={T.spent} value={money(spent)} />
          <Tile label={T.rating} value={<Stars n={s.rating.stars} />} sub={T.reviewsN(s.rating.n)} />
          <Tile label={T.visits} value={s.visits} />
          <Tile label={T.inShop} value={inShop.length} sub={`${T.ordersTitle} ${s.orders.reduce((n, o) => n + o.n, 0)}`} />
          <Tile label={T.status} value={s.open ? T.open : T.closed} tone={s.open ? 'up' : undefined} />
          {/* (the servers' trays and the square tray by the fire (items 311, 317)) */}
          {s.ware && <Tile label={T.trays} value={`${s.ware.hands} / ${s.ware.hands + s.ware.pass}`} sub={T.traysSub(s.ware.pass, s.ware.kakubat)} />}
          <Tile label={T.time} value={hhmm(s.clock.minute)} sub={`${T.day(s.clock.day)} · ${T.speed} x${s.speed}`} />
        </div>
        <section className="ad-card">
          <h3>{T.nav.log}</h3>
          {s.log.length ? <ul className="ad-log">{s.log.slice(-8).map((l) => <li key={l.id}><span>{T.who[l.who] ?? l.who}</span>{l.text}</li>)}</ul> : <p className="ad-dim">{T.none.log}</p>}
        </section>
      </>
    )
    if (page === 'ledger') return (
      <section className="ad-card">
        <table className="ad-table">
          <thead><tr><th>{T.item}</th><th className="num">{T.amount}</th></tr></thead>
          <tbody>
            <tr><td>{T.capital}</td><td className="num">{money(s.capital)}</td></tr>
            <tr><td>{T.ledger.revenue}</td><td className="num is-up">+{money(s.ledger.revenue ?? 0)}</td></tr>
            {(s.ledger.till ?? 0) > 0 && <tr><td>{T.ledger.till}</td><td className="num is-up">+{money(s.ledger.till)}</td></tr>}
            {/* (a cash customer's bill goes into the till's drawer, not the cash, till it's taken out (item 195)) */}
            {(s.ledger.tillIn ?? 0) > 0 && <tr><td>{T.ledger.tillIn}</td><td className="num is-down">-{money(s.ledger.tillIn)}</td></tr>}
            {COSTS.filter((k) => (s.ledger[k] ?? 0) > 0).map((k) => <tr key={k}><td>{T.ledger[k] ?? k}</td><td className="num is-down">-{money(s.ledger[k])}</td></tr>)}
            {(s.ledger.food ?? 0) > 0 && <tr className="ad-sub"><td>{T.ledger.food}</td><td className="num">{money(s.ledger.food)}</td></tr>}
          </tbody>
          <tfoot><tr><td>{T.cash}</td><td className="num">{money(s.cash)}</td></tr></tfoot>
        </table>
      </section>
    )
    if (page === 'days') return (
      <section className="ad-card">
        {s.days.length ? (
          <table className="ad-table">
            <thead><tr>{['day', 'revenue', 'profit', 'guests', 'stars', 'best'].map((k) => <th key={k} className={k === 'day' || k === 'best' ? '' : 'num'}>{T.daysHead[k]}</th>)}</tr></thead>
            <tbody>
              {[...s.days].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{T.day(d.day)}</td><td className="num">{money(d.revenue)}</td><td className={`num ${d.profit >= 0 ? 'is-up' : 'is-down'}`}>{money(d.profit)}</td>
                  <td className="num">{d.guests}</td><td className="num"><Stars n={d.stars} /></td><td>{d.best ? `${s.names[d.best.key] ?? d.best.key} x${d.best.n}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="ad-dim">{T.none.days}</p>}
      </section>
    )
    if (page === 'reviews') return (
      <>
        <div className="ad-tiles">
          <Tile label={T.rating} value={<Stars n={s.rating.stars} />} sub={T.reviewsN(s.rating.n)} />
          {(['food', 'service', 'place'] as const).map((k) => <Tile key={k} label={T.sides[k]} value={<Stars n={s.rating[k]} />} />)}
        </div>
        <section className="ad-card">
          {s.reviews.length ? (
            <ul className="ad-reviews">
              {s.reviews.map((v) => {
                const sides = visitSides(v)
                return (
                  <li key={`${v.id}-${v.day ?? 0}`}>
                    <Stars n={visitStars(v)} />
                    <b>{T.remark[remarkOf(v)] ?? remarkOf(v)}</b>
                    <span>{T.guestNo(v.id)}{v.day !== undefined ? ` · ${T.day(v.day)}` : ''} · {T.waited(Math.round(v.waited))}</span>
                    <small>{(['food', 'service', 'place'] as const).map((k) => `${T.sides[k]} ${sides[k] === null ? '-' : Math.round(sides[k] as number)}`).join('　')}</small>
                    {v.gripes.length > 0 && <em>{v.gripes.map((g) => T.remark[g] ?? g).join('、')}</em>}
                  </li>
                )
              })}
            </ul>
          ) : <p className="ad-dim">{T.none.reviews}</p>}
        </section>
      </>
    )
    if (page === 'guests') return (
      <div className="ad-cols">
        <section className="ad-card">
          <h3>{T.guestsTitle}</h3>
          {s.guests.length ? (
            <table className="ad-table">
              <tbody>
                {s.guests.map((g) => (
                  <tr key={g.id}><td>{T.guestNo(g.id)}</td><td><span className={`ad-pill is-${g.state}`}>{T.state[g.state] ?? g.state}</span></td>
                    <td>{g.seat !== undefined ? T.seatNo(g.seat + 1) : '-'}</td><td className="num">{T.items(g.items)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="ad-dim">{T.none.guests}</p>}
        </section>
        <section className="ad-card">
          <h3>{T.ordersTitle}</h3>
          {s.orders.length ? (
            <table className="ad-table"><tbody>{s.orders.map((o) => <tr key={o.id}><td>{o.name}</td><td className="num">x{o.n}</td></tr>)}</tbody></table>
          ) : <p className="ad-dim">{T.none.orders}</p>}
        </section>
      </div>
    )
    if (page === 'staff') return (
      <section className="ad-card">
        {s.staff.length ? (
          <table className="ad-table">
            <tbody>
              {s.staff.map((w) => <tr key={w.id}><td>{T.role[w.role] ?? w.role}</td><td>{w.name}</td><td><span className={`ad-pill${w.on ? ' is-on' : ''}`}>{w.on ? T.onShift : T.offShift}</span></td></tr>)}
            </tbody>
          </table>
        ) : <p className="ad-dim">{T.none.staff}</p>}
      </section>
    )
    if (page === 'log') return (
      <section className="ad-card">
        {s.log.length ? <ul className="ad-log is-full">{s.log.map((l) => <li key={l.id}><span>{T.who[l.who] ?? l.who}</span>{l.text}</li>)}</ul> : <p className="ad-dim">{T.none.log}</p>}
      </section>
    )
    return (
      <>
        <section className="ad-card">
          <h3>{T.speedTitle}</h3>
          <div className="ad-btns">
            {[1, 2].map((x) => (
              <button key={x} type="button" className={s.speed === x ? 'is-on' : ''} onClick={() => ask.current({ kind: 'speed', x })}>{x === 1 ? T.x1 : T.x2}</button>
            ))}
          </div>
        </section>
        <section className="ad-card">
          <h3>{T.timeTitle}</h3>
          <div className="ad-btns">
            {Object.entries(PRESETS).map(([k, m]) => <button key={k} type="button" onClick={() => jump(m)}>{T.presets[k]}</button>)}
          </div>
          <div className="ad-row">
            <label>{T.custom}<input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} /></label>
            <button type="button" className="is-main" onClick={() => { const [h, m] = custom.split(':').map(Number); if (Number.isFinite(h) && Number.isFinite(m)) jump(h * 60 + m) }}>{T.go}</button>
          </div>
          <p className="ad-dim">{T.controlNote}</p>
        </section>
      </>
    )
  }

  return (
    <div className="ad">
      <header className="ad-top">
        <div className="ad-brand"><span className="ad-mark"><Glyph id="receipt" size={18} /></span><b>{T.title}</b><small>{T.sub}</small></div>
        <span className={`ad-link${live ? ' is-live' : ''}`}><i />{live ? T.connected : T.waiting}{live && <em>{T.updated(Math.max(0, Math.round((now - got) / 1000)))}</em>}</span>
        <div className="ad-acts">
          <button type="button" onClick={() => window.open(GAME_URL, 'grill-game')}><Glyph id="gamepad" size={14} />{T.openGame}</button>
          <button type="button" onClick={() => window.open(EDITOR_URL, 'grill-editor')}><Glyph id="tools" size={14} />{T.openEditor}</button>
        </div>
      </header>
      <nav className="ad-nav">
        {PAGES.map((p) => (
          <button key={p.id} type="button" className={page === p.id ? 'is-on' : ''} onClick={() => go(p.id)}><Glyph id={p.icon} size={15} />{T.nav[p.id]}</button>
        ))}
      </nav>
      <main className="ad-main">
        <h2>{T.nav[page]}</h2>
        {snap ? body(snap) : (
          <section className="ad-card ad-empty">
            <h3>{T.emptyTitle}</h3>
            <p>{T.emptyBody}</p>
            <button type="button" className="is-main" onClick={() => window.open(GAME_URL, 'grill-game')}><Glyph id="gamepad" size={14} />{T.openGame}</button>
          </section>
        )}
      </main>
      {said && <div className="ad-toast">{said}</div>}
    </div>
  )
}
