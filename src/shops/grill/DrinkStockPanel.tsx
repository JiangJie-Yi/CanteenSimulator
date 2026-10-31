import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'
import { buyCase, caseCost, CASE_SIZE, drinkCounts, fillFromBack } from '@/game/drinkStock'
import { DRINK_BACK, DRINK_PANEL, DRINKS, FRIDGE_STOCK, FRIDGE_UNITS, onDrinkPanel, setDrinkPanel, SHOP_PURSE, type DrinkId } from './bar'

type Drink = (typeof DRINKS)[number]
const HOMES = FRIDGE_UNITS.map((u) => u.shelves.map((sh) => sh.ids))
/** each fridge's drinks, in the order they first stand on its shelves (bottom up) */
const UNIT_DRINKS = FRIDGE_UNITS.map((u) => [...new Set(u.shelves.flatMap((sh) => sh.ids))])
const drinkOf = (id: DrinkId) => DRINKS.find((d) => d.id === id)!

/** a little picture of a drink as it stands in the fridge: a can, a bottle, or the little bottle of cultured milk; in its own colours */
function DrinkIcon({ d }: { d: Drink }) {
  const [bg, fg] = d.label
  const ink = '#3b2a20'
  if (d.shape === 'can') {
    return (
      <svg className="drink-icon" viewBox="0 0 24 32" aria-hidden="true">
        <rect x="5" y="3.5" width="14" height="25" rx="2.6" fill="#c8ccd2" stroke={ink} strokeWidth="1" />
        <rect x="5.5" y="8" width="13" height="15.5" fill={bg} />
        <rect x="7.5" y="13" width="9" height="4.5" rx="1" fill={fg} opacity="0.9" />
        <rect x="7" y="2" width="10" height="2.4" rx="1.2" fill="#9aa0a8" stroke={ink} strokeWidth="0.8" />
        <path d="M7 6.5h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </svg>
    )
  }
  if (d.shape === 'small') {
    return (
      <svg className="drink-icon" viewBox="0 0 24 32" aria-hidden="true">
        <path d="M8.5 9 C8.5 7 10 6 12 6 C14 6 15.5 7 15.5 9 L16.5 14 C17 17 16.5 25 15.5 28 L8.5 28 C7.5 25 7 17 7.5 14 Z" fill={d.color} stroke={ink} strokeWidth="1" />
        <rect x="8.6" y="4" width="6.8" height="2.6" rx="1" fill={d.cap} stroke={ink} strokeWidth="0.8" />
        <rect x="8.2" y="16" width="7.6" height="6" fill={bg} />
        <path d="M9.8 18.5h4.4" stroke={fg} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="drink-icon" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M10 2.5h4v6c0 1.4 3.5 2.6 3.5 6V28a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 28V14.5c0-3.4 3.5-4.6 3.5-6z"
        fill={d.color} stroke={ink} strokeWidth="1" />
      <rect x="9.6" y="1.4" width="4.8" height="2.6" rx="0.8" fill={d.cap} stroke={ink} strokeWidth="0.8" />
      <rect x="7" y="16" width="10" height="8.5" fill={bg} />
      <path d="M9 20.3h6" stroke={fg} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.3 13.5v12" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

/**
 * The drinks' stock (opened by a click on the back stock by the fridges): for each fridge every drink it holds, how many stand in it of the
 * places meant for them and how many wait in the back, with a case to order in (paid from the shop's cash) and the fridge to fill from the
 * back at a click; at its foot, every fridge filled from the back, and a case ordered of each drink the back hasn't enough of to fill its
 * places. Esc or × shuts it. (Pure rules: game/drinkStock.)
 */
export function DrinkStockPanel({ lang }: { lang: Lang }) {
  const open = useSyncExternalStore(onDrinkPanel, () => DRINK_PANEL.open)
  // (the stock moves while it's open (customers, the stocker): looked at again a few times a second)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!open) return
    const t = window.setInterval(() => tick((n) => n + 1), 300)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setDrinkPanel(false) } }
    window.addEventListener('keydown', key)
    return () => { window.clearInterval(t); window.removeEventListener('keydown', key) }
  }, [open])
  if (!open) return null
  const cash = SHOP_PURSE.cash()
  const changed = () => { FRIDGE_STOCK.ver++; DRINK_BACK.ver++; tick((n) => n + 1) }
  const buy = (id: DrinkId) => {
    const r = buyCase(DRINK_BACK.back, id, SHOP_PURSE.cash())
    if (!r.ok) return
    DRINK_BACK.back = r.back
    SHOP_PURSE.spend(caseCost(id))
    changed()
  }
  const fill = (only?: DrinkId) => {
    FRIDGE_STOCK.units.forEach((rows, u) => {
      const r = fillFromBack(rows, HOMES[u], DRINK_BACK.back, only)
      FRIDGE_STOCK.units[u] = r.rows
      DRINK_BACK.back = r.back
    })
    changed()
  }
  const counts = FRIDGE_STOCK.units.map((rows, u) => drinkCounts(rows, HOMES[u]))
  /** a drink's count over the fridges, and its places */
  const total = (id: DrinkId) => counts.reduce((t, c) => ({ have: t.have + (c[id]?.have ?? 0), places: t.places + (c[id]?.places ?? 0) }), { have: 0, places: 0 })
  /** the drinks the back can't fill their empty places from: a case of each of those is what the foot's button orders */
  const short = UNIT_DRINKS.flat().filter((id) => { const t = total(id); return (DRINK_BACK.back[id] ?? 0) < t.places - t.have })
  const shortCost = short.reduce((n, id) => n + caseCost(id), 0)
  const anyToFill = UNIT_DRINKS.flat().some((id) => { const t = total(id); return t.have < t.places && (DRINK_BACK.back[id] ?? 0) > 0 })
  return createPortal(
    <section className="drink-stock" role="dialog" aria-label={tl(lang, '飲料庫存', 'ドリンク在庫', 'Drinks stock')}>
      <header className="drink-stock-head">
        <b>{tl(lang, '飲料庫存', 'ドリンク在庫', 'Drinks stock')}</b>
        <span className="drink-stock-cash">{tl(lang, '現金', '現金', 'Cash')} <b className="money">NT${Math.round(cash).toLocaleString()}</b></span>
        <button type="button" className="drink-stock-close" onClick={() => setDrinkPanel(false)} aria-label="close">×</button>
      </header>
      <div className="chiller-scroll">
        {FRIDGE_UNITS.map((unit, u) => (
          <section key={u} className={`chiller-zone ${u ? 'is-drinks-alcohol' : 'is-chilled'}`}>
            <h3 className="chiller-zone-head"><span>{tl(lang, unit.sign[0], unit.sign[1], u ? 'Alcohol' : 'Drinks')}</span><i aria-hidden="true">4°C</i></h3>
            <div className="chiller-bins">
              {UNIT_DRINKS[u].map((id) => {
                const d = drinkOf(id), c = counts[u][id] ?? { have: 0, places: 0 }, back = DRINK_BACK.back[id] ?? 0
                const name = tl(lang, d.zh, d.ja, d.ja)
                const out = c.have <= 0
                const cost = caseCost(id)
                return (
                  <div key={id} className={`chiller-bin drink-bin${out ? ' is-out' : ''}`}
                    aria-label={`${name}：${tl(lang, '櫃中', '庫内', 'in the fridge')} ${c.have}/${c.places}，${tl(lang, '後場', 'バック', 'in the back')} ${back}`}>
                    <span className="chiller-bin-head"><DrinkIcon d={d} /><span className="chiller-bin-name">{name}</span></span>
                    <span className="drink-bin-sub">{tl(lang, `一箱 ${CASE_SIZE[id]} 瓶`, `1ケース ${CASE_SIZE[id]}本`, `${CASE_SIZE[id]} a case`)}</span>
                    <span className={`chiller-level${out ? ' is-zero' : c.have < c.places ? ' is-low' : ''}`} aria-hidden="true">
                      <i style={{ width: `${c.places ? Math.min(100, (c.have / c.places) * 100) : 0}%` }} />
                    </span>
                    <span className="chiller-bin-info" aria-hidden="true">
                      <b className={out ? 'is-zero' : ''}>{tl(lang, '櫃中', '庫内', 'Fridge')} <em>{c.have}/{c.places}</em></b>
                      <small>{tl(lang, '後場', 'バック', 'Back')} <em>{back}</em></small>
                    </span>
                    <span className="chiller-buy drink-bin-buy">
                      <span role="button" tabIndex={0} className={`chiller-btn${cash >= cost ? '' : ' is-off'}`}
                        title={tl(lang, `訂一箱（${CASE_SIZE[id]} 瓶，NT$${cost}）`, `1ケース注文（${CASE_SIZE[id]}本、NT$${cost}）`, `Order a case (${CASE_SIZE[id]}, NT$${cost})`)}
                        onClick={() => buy(id)} onKeyDown={(e) => { if (e.key === 'Enter') buy(id) }}>{tl(lang, '訂一箱', '注文', 'Order')}</span>
                      <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${back > 0 && c.have < c.places ? '' : ' is-off'}`}
                        title={tl(lang, '從後場補進櫃子', 'バックから補充', 'Fill from the back')}
                        onClick={() => fill(id)} onKeyDown={(e) => { if (e.key === 'Enter') fill(id) }}>{tl(lang, '補', '補', 'Fill')}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <footer className="drink-stock-foot">
        <button type="button" className="tally-restock" disabled={!anyToFill} onClick={() => fill()}>{tl(lang, '全部補滿（從後場）', '全部補充（バックから）', 'Fill all (from the back)')}</button>
        <button type="button" className="tally-restock" disabled={!short.length || cash < shortCost}
          onClick={() => { for (const id of short) buy(id) }}>
          {tl(lang, `缺的各訂一箱`, `足りない分を各1ケース`, `A case of each that's short`)}{short.length ? <> <b className="money">{shortCost.toLocaleString()}</b></> : null}
        </button>
      </footer>
    </section>,
    document.body,
  )
}
