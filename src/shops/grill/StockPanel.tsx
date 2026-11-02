import { useEffect, useState } from 'react'
import { BOX_LOW, BOX_SHEETS, TISSUE, TISSUE_PACK } from '@/game/tissues'
import { LOADS, USES, POWER_TIERS, WATER_TIERS, WATER_BASE, BILL_DAYS, type Meter, type Use } from '@/game/utilities'
import { createPortal } from 'react-dom'
import { nameIn, tl, type Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { SEASONINGS, SEASON_COST, type Seasoning } from '@/data/recipes'
import { STORAGES, storageName, storageOf, type Storage } from '@/data/storage'
import { PAR } from '@/game/economy'
import { freshGrade } from '@/game/freshness'
import { CHARCOAL, SACK_COST, SACK_STICKS, SEASON_PAR, seasonId, supplyName } from '@/game/supplies'
import { FitLine } from '@/ui/FitLine'
import { FoodArt } from '@/ui/FoodArt'
import type { Restock } from '@/ui/Menu'
import { CRATE, FREEZER_TEMP } from './Decor'
import { GRILL_SEATS, tissuesAt } from './bar'
import { DrinkStockBody } from './DrinkStockPanel'

/** the stock panel's tabs: the freezer, the fridge (the cupboards' under the cook table), the larder at room temperature, the drinks, and what
 * isn't food (the charcoal) */
export type StockTab = Storage | 'drinks' | 'supplies'
const TABS: { id: StockTab; zh: string; ja: string; en: string }[] = [
  { id: 'frozen', zh: '冷凍櫃', ja: '冷凍庫', en: 'Freezer' },
  { id: 'chilled', zh: '冷藏櫃', ja: '冷蔵庫', en: 'Fridge' },
  { id: 'ambient', zh: '常溫區', ja: '常温', en: 'Larder' },
  { id: 'drinks', zh: '飲料', ja: 'ドリンク', en: 'Drinks' },
  { id: 'supplies', zh: '耗材', ja: '消耗品', en: 'Supplies' },
]

/** each seasoning's little pot as the panel draws it: the pot's glaze, what's in it, and the character on its label */
const SEASON_LOOK: Record<Seasoning, { pot: string; fill: string; mark: string }> = {
  salt: { pot: '#3a5a9a', fill: '#f4f4f0', mark: '鹽' },
  soy: { pot: '#3b2a20', fill: '#2a140a', mark: '醬' },
  milk: { pot: '#e2dccb', fill: '#f6efd8', mark: '乳' },
  peanut: { pot: '#8a5a32', fill: '#d9a86a', mark: '花' },
  miso: { pot: '#3a5a9a', fill: '#b5793a', mark: '噌' },
  wasabi: { pot: '#2f4f8a', fill: '#9ac36a', mark: '葵' },
  shichimi: { pot: '#8a5a32', fill: '#c0442a', mark: '七' },
  yuzu: { pot: '#3b2a20', fill: '#b9c64a', mark: '柚' },
  lemon: { pot: '#2f4f8a', fill: '#f2d64a', mark: '檸' },
}
function SeasonIcon({ k }: { k: Seasoning }) {
  const l = SEASON_LOOK[k]
  return (
    <svg className="season-icon" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="29" rx="10" ry="1.6" fill="#1d2a36" opacity="0.2" />
      <path d="M7 12 C7 9.5 9 8.5 16 8.5 C23 8.5 25 9.5 25 12 L24 25 C23.8 27 22 28 16 28 C10 28 8.2 27 8 25 Z" fill={l.pot} stroke="#2a1d14" strokeWidth="1.2" />
      <ellipse cx="16" cy="10.2" rx="8.2" ry="2.4" fill={l.fill} stroke="#2a1d14" strokeWidth="1" />
      <path d="M10.5 9.6 q2.5 -1.4 5 -0.6" stroke="#fff" strokeWidth="1" fill="none" opacity="0.7" />
      <rect x="11" y="15" width="10" height="9" rx="1.4" fill="#f6efe0" stroke="#2a1d14" strokeWidth="0.8" />
      <text x="16" y="22.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#2a1d14">{l.mark}</text>
      <path d="M9.5 14 L9 22" stroke="#fff" strokeWidth="1" opacity="0.35" />
    </svg>
  )
}
/** the sack of binchotan: a burlap sack, its mouth rolled down, the black sticks standing in it */
function CharcoalIcon() {
  return (
    <svg className="season-icon" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="29.2" rx="11" ry="1.6" fill="#1d2a36" opacity="0.2" />
      {[9.5, 12.5, 15.5, 18.5, 21.5].map((x, i) => <rect key={i} x={x} y={4 + (i % 2) * 2} width="2.6" height="12" rx="1" fill="#2a2a2e" stroke="#111" strokeWidth="0.6" />)}
      <path d="M6 13 C6 11 26 11 26 13 L25 25 C24.6 28 22 28.5 16 28.5 C10 28.5 7.4 28 7 25 Z" fill="#b89766" stroke="#4a3520" strokeWidth="1.2" />
      <path d="M6 13 C10 15.5 22 15.5 26 13" stroke="#7a5a34" strokeWidth="1.4" fill="none" />
      <path d="M9 18 h14 M8.6 21.5 h14.8 M9 25 h14" stroke="#9c7c4c" strokeWidth="0.8" opacity="0.7" />
      <rect x="12" y="18.5" width="8" height="6" rx="1" fill="#f3ead6" stroke="#4a3520" strokeWidth="0.6" />
      <text x="16" y="23.4" textAnchor="middle" fontSize="5" fontWeight="700" fill="#2a1d14">炭</text>
    </svg>
  )
}

type Props = {
  lang: Lang
  tab: StockTab
  onTab: (t: StockTab) => void
  /** one thing asked for from the room (the sake barrels: the sake), brought into view and lit a moment; `n` new each time it's asked */
  focus?: { id: string; n: number } | null
  /** the water and power so far this month (game/utilities), shown in the title bar */
  meter?: Meter
  /** the shop's foods (the researching board's: its bases and items) */
  dish: Dish
  stock: Record<string, number>
  fresh: Record<string, number>
  cash: number
  /** what one costs to buy in (a food's portion, a seasoning's dose) */
  unitCost: (id: string) => number
  /** researching at the grill: a click on a food takes one out to try, a right-click puts one back */
  research: boolean
  quantities: Record<string, number>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onBuy: (id: string, n: number) => void
  onRestock: (how: Restock) => void
  restockCost: Record<Restock, number>
  onBuyCharcoal: (sacks: number) => void
  /** packs of tissue boxes bought (game/tissues) */
  onBuyTissues: (packs: number) => void
  onClose: () => void
}

/**
 * The stock (庫存): everything the shop keeps, seen at any time from the little fridge top right (the owner's), in five: the freezer, the
 * fridge, the larder at room temperature (each with its food, and the fridge and the larder with the seasonings kept there: the sauces cold,
 * the dry ones not), the drinks (the fridges by the wall and the back stock behind them), and the supplies (the binchotan: the crate on the
 * table, the sack on the floor by it). Each thing's how many, how fresh, what it costs, and buttons to buy more; researching, a food's
 * clicked to take one out to try. Docked at the right as the other panels are.
 */
export function StockPanel(p: Props) {
  const { lang, tab, onTab, cash, onClose } = p
  // (the crate and the sack move while it's open: the fire, the chef)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(t)
  }, [])
  const foods = [...p.dish.bases.filter((b) => !b.includes), ...p.dish.items]
  useEffect(() => {
    if (!p.focus) return
    const id = p.focus.id
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`.stock-panel [data-id="${id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.remove('is-focus')
      void el.offsetWidth
      el.classList.add('is-focus')
    }, 80)
    return () => window.clearTimeout(t)
  }, [p.focus, tab])
  /** how many in a tab are out (or spoiled): a red mark on the tab */
  const warn = (t: StockTab) => {
    if (t === 'supplies') return (p.stock[CHARCOAL] ?? 0) + CRATE.left <= 0 ? 1 : 0
    if (t === 'drinks') return 0
    const zone = foods.filter((x) => storageOf(x.id) === t).filter((x) => (p.stock[x.id] ?? 0) <= 0 || freshGrade(p.fresh[x.id] ?? 100) === 'spoiled').length
    const seas = SEASONINGS.filter((k) => storageOf(seasonId(k)) === t && (p.stock[seasonId(k)] ?? 0) <= 0).length
    return zone + seas
  }
  return createPortal(
    <>
      <h2 className="dock-title" aria-hidden="true">{tl(lang, '庫存', '在庫', 'Stock')}<small lang="en">STOCK</small></h2>
      <section className="drink-stock stock-panel" role="dialog" aria-label={tl(lang, '庫存', '在庫', 'Stock')}>
        <header className="drink-stock-head">
          <b>{tl(lang, '庫存', '在庫', 'Stock')}</b>
          {p.meter && <MeterChip lang={lang} meter={p.meter} />}
          <span className="drink-stock-cash">{tl(lang, '現金', '現金', 'Cash')} <b className="money">NT${Math.round(cash).toLocaleString()}</b></span>
          <button type="button" className="panel-x" onClick={onClose} aria-label={tl(lang, '關閉', '閉じる', 'Close')}>×</button>
        </header>
        <nav className="stock-tabs" role="tablist">
          {TABS.map((t) => {
            const n = warn(t.id)
            return (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`stock-tab is-${t.id}${tab === t.id ? ' is-on' : ''}`}
                onClick={() => onTab(t.id)}>
                {tl(lang, t.zh, t.ja, t.en)}{n > 0 && <i aria-label={tl(lang, `${n} 樣缺貨`, `${n}品切れ`, `${n} out`)}>{n}</i>}
              </button>
            )
          })}
        </nav>
        {tab === 'drinks' ? <DrinkStockBody lang={lang} /> : tab === 'supplies' ? <Supplies {...p} /> : <Foods {...p} zone={tab} foods={foods} />}
      </section>
    </>,
    document.body,
  )
}

/** a food tab: the food kept there, and the seasonings kept there; its foot, what's out to try (researching) and the three ways to restock */
function Foods(p: Props & { zone: Storage; foods: Dish['items'] }) {
  const { lang, zone, stock, cash, research } = p
  const [nudge, setNudge] = useState<{ id: string; k: number } | null>(null)
  const st = STORAGES.find((s) => s.id === zone)!
  const goods = p.foods.filter((x) => storageOf(x.id) === zone)
  const seasonings = SEASONINGS.filter((k) => storageOf(seasonId(k)) === zone)
  const count = p.foods.reduce((n, x) => n + (p.quantities[x.id] ?? 0), 0)
  const bin = (x: Dish['items'][number]) => {
    const n = p.quantities[x.id] ?? 0
    const name = nameIn(lang, x)
    const cost = p.unitCost(x.id)
    const have = stock[x.id] ?? 0
    const out = have <= 0
    const need = Math.max(0, PAR - have)
    const can = (k: number) => k > 0 && cash >= cost * k
    const buy = (k: number) => (e: { stopPropagation: () => void; preventDefault: () => void }) => { e.stopPropagation(); e.preventDefault(); if (can(k)) p.onBuy(x.id, k) }
    const f = Math.round(p.fresh[x.id] ?? 100)
    const grade = freshGrade(f)
    return (
      <div key={x.id} role={research ? 'button' : undefined} tabIndex={research ? 0 : undefined} aria-pressed={research ? n > 0 : undefined} data-id={x.id}
        className={`chiller-bin${out ? ' is-out' : ''}${n > 0 ? ' is-taken' : ''}${nudge?.id === x.id ? ' is-nudged' : ''}${research ? '' : ' is-still'}`}
        aria-label={`${name}，${tl(lang, '庫存', '在庫', 'Stock')} ${have}${n ? `，${tl(lang, '試', '試', 'Try')}×${n}` : ''}`}
        onClick={() => { if (!research) return; if (out) setNudge({ id: x.id, k: Date.now() }); else p.onAdd(x.id) }}
        onAnimationEnd={(e) => { if (e.animationName === 'bin-nudge') setNudge(null) }}
        onContextMenu={(e) => { e.preventDefault(); if (research) p.onRemove(x.id) }}
        onKeyDown={(e) => { if (research && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onAdd(x.id) } }}>
        <span className="chiller-bin-head">
          <FoodArt id={x.id} store={storageOf(x.id)} band />
          <FitLine className="chiller-bin-name">{name}</FitLine>
          {n > 0 && <span key={n} className="chiller-taken" aria-hidden="true">{tl(lang, '試', '試', 'Try')}×{n}</span>}
        </span>
        {x.en && <span className="chiller-bin-en" lang="en">{x.en}</span>}
        <span className={`chiller-level${out ? ' is-zero' : have < PAR ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (have / PAR) * 100)}%` }} /></span>
        <span className="chiller-bin-info" aria-hidden="true">
          <b className={out ? 'is-zero' : ''}>{tl(lang, '庫存', '在庫', 'Stock')} <em>{have}</em></b>
          <small>{tl(lang, '成本', '原価', 'Cost')} <em>{cost}</em></small>
        </span>
        {!out && (
          <span className={`chiller-fresh is-${grade}`} aria-hidden="true" title={grade === 'spoiled'
            ? tl(lang, `鮮度 ${f}%：已經壞了，不可食用（做出來很難吃，客人吃了容易拉肚子）`, `鮮度 ${f}%：傷んでいて食べられない（まずく、客がお腹を壊しやすい）`, `Freshness ${f}%: spoiled, not fit to eat (it tastes bad, and may well upset a customer's stomach)`)
            : tl(lang, `鮮度 ${f}%：越不新鮮，做出來越不好吃`, `鮮度 ${f}%：鮮度が落ちると味も落ちる`, `Freshness ${f}%: the staler, the less tasty`)}>
            <svg viewBox="0 0 16 16"><path d="M13.5 2.5C7 2.5 3 5.5 3 10c0 1.3.4 2.4 1 3.2C5 9.5 7.5 7 11 5.5 8 7.5 6 10 5.2 13.6 6 14 7 14 8 14c4 0 5.5-4.5 5.5-11.5z" /></svg>
            <span className="chiller-fresh-bar"><i style={{ width: `${f}%` }} /></span>
            <em>{grade === 'spoiled' ? tl(lang, '不可食用', '食用不可', 'Spoiled') : `${f}%`}</em>
          </span>
        )}
        <span className="chiller-buy">
          <span role="button" tabIndex={-1} className={`chiller-btn${can(1) ? '' : ' is-off'}`} title={tl(lang, '叫 1 份', '1つ仕入れる', 'Order 1')} onClick={buy(1)}>+1</span>
          <span role="button" tabIndex={-1} className={`chiller-btn${can(10) ? '' : ' is-off'}`} title={tl(lang, '叫 10 份', '10個仕入れる', 'Order 10')} onClick={buy(10)}>+10</span>
          <span role="button" tabIndex={-1} className={`chiller-btn chiller-fill${can(need) ? '' : ' is-off'}`}
            title={need ? tl(lang, `補到 ${PAR} 份（${need} 份，NT$${cost * need}）`, `${PAR}まで補充（${need}）`, `Fill up to ${PAR} (${need}, NT$${cost * need})`) : tl(lang, '已經夠了', '十分あります', 'Enough already')}
            onClick={buy(need)}>{tl(lang, '補', '補', '+')}</span>
        </span>
      </div>
    )
  }
  const seasonBin = (k: Seasoning) => {
    const id = seasonId(k)
    const have = stock[id] ?? 0
    const out = have <= 0
    const need = Math.max(0, SEASON_PAR - have)
    const cost = SEASON_COST[k]
    const can = (n: number) => n > 0 && cash >= cost * n
    const buy = (n: number) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (can(n)) p.onBuy(id, n) }
    return (
      <div key={id} className={`chiller-bin season-bin is-still${out ? ' is-out' : ''}`} aria-label={`${supplyName(id, lang)}，${tl(lang, '庫存', '在庫', 'Stock')} ${have}`}>
        <span className="chiller-bin-head"><SeasonIcon k={k} /><FitLine className="chiller-bin-name">{supplyName(id, lang)}</FitLine></span>
        <span className={`chiller-level${out ? ' is-zero' : have < SEASON_PAR / 3 ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (have / SEASON_PAR) * 100)}%` }} /></span>
        <span className="chiller-bin-info" aria-hidden="true">
          <b className={out ? 'is-zero' : ''}>{tl(lang, '剩', '残り', 'Left')} <em>{have}</em>{tl(lang, ' 份', '回', '')}</b>
          <small>{tl(lang, '每份', '1回', 'Each')} <em>{cost}</em></small>
        </span>
        <span className="chiller-buy season-buy">
          <span role="button" tabIndex={-1} className={`chiller-btn${can(10) ? '' : ' is-off'}`} title={tl(lang, '叫 10 份', '10回分仕入れる', 'Order 10')} onClick={buy(10)}>+10</span>
          <span role="button" tabIndex={-1} className={`chiller-btn chiller-fill${can(need) ? '' : ' is-off'}`}
            title={need ? tl(lang, `補到 ${SEASON_PAR} 份（NT$${cost * need}）`, `${SEASON_PAR}まで補充`, `Fill up to ${SEASON_PAR} (NT$${cost * need})`) : tl(lang, '已經夠了', '十分あります', 'Enough already')}
            onClick={buy(need)}>{tl(lang, '補', '補', '+')}</span>
        </span>
      </div>
    )
  }
  return (
    <>
      <div className="chiller-scroll">
        <section className={`chiller-zone is-${zone}`}>
          {/* (the freezer's own temperature as it is now, its thermostat's and its lid's (it warms with the lid up); the fridges' as their
              displays have it) */}
          <h3 className="chiller-zone-head"><span>{storageName(st, lang)}</span><i aria-hidden="true">{zone === 'frozen' ? `${FREEZER_TEMP.now < 0 ? '−' : ''}${Math.abs(Math.round(FREEZER_TEMP.now))}℃` : zone === 'chilled' ? '3℃' : st.temp}</i></h3>
          {goods.length > 0 && <div className="chiller-bins">{goods.map(bin)}</div>}
        </section>
        {seasonings.length > 0 && (
          <section className={`chiller-zone is-${zone} is-seasonings`}>
            <h3 className="chiller-zone-head"><span>{tl(lang, '調味料', '調味料', 'Seasonings')}</span><i aria-hidden="true">{tl(lang, '用一次少一份', '1回で1つ', 'one a dab')}</i></h3>
            <div className="chiller-bins">{seasonings.map(seasonBin)}</div>
          </section>
        )}
      </div>
      <footer className="tally tally-research stock-foot">
        {research && (
          <p className="tally-trying">
            {count > 0
              ? (lang === 'ja' ? <>試作中 <strong>{count}</strong> 品</> : lang === 'en' ? <>Trying <strong>{count}</strong></> : <>試做中 <strong>{count}</strong> 份</>)
              : tl(lang, '點食材拿一份到砧板試做（右鍵放回）', '食材をクリックで一つ取り出して試作（右クリックで戻す）', 'Click an ingredient to put one on the board to try (right-click to put back)')}
          </p>
        )}
        {research && count > 0 && <button type="button" className="clear" onClick={p.onClear}>{tl(lang, '全部放回', '全部戻す', 'Put all back')}</button>}
        <span className="tally-buy">
          {([['avg', tl(lang, '補到平均', '平均まで補充', 'Up to average'), tl(lang, '低於平均的食材補到平均', '平均より少ないものを平均まで', 'Bring anything below average up to average')],
            ['each', tl(lang, '各補 5', '各 +5', '+5 each'), tl(lang, '每樣多 5 份', 'すべて5つずつ', '5 more of each')],
            ['full', tl(lang, '補滿', '満タン', 'Fill up'), tl(lang, `每樣補到 ${PAR} 份，調味料補到 ${SEASON_PAR} 份`, `すべて${PAR}まで（調味料は${SEASON_PAR}）`, `Everything up to ${PAR}, the seasonings to ${SEASON_PAR}`)]] as [Restock, string, string][]).map(([k, label, title]) => (
            <button key={k} type="button" className={`tally-restock is-${k}`} disabled={!p.restockCost[k] || cash < p.restockCost[k]} onClick={() => p.onRestock(k)} title={title}>
              {label}{p.restockCost[k] > 0 && <small className="money">NT${p.restockCost[k].toLocaleString()}</small>}
            </button>
          ))}
        </span>
      </footer>
    </>
  )
}

/** the supplies: the binchotan, in the crate on the table and the sack on the floor by it, and sacks to order */
function Supplies(p: Props) {
  const { lang, stock, cash } = p
  const sack = stock[CHARCOAL] ?? 0
  const crate = CRATE.left
  const out = sack + crate <= 0
  return (
    <>
      <div className="chiller-scroll">
        <section className="chiller-zone is-supplies">
          <h3 className="chiller-zone-head"><span>{tl(lang, '燃料', '燃料', 'Fuel')}</span><i aria-hidden="true">{tl(lang, '非食材', '食材以外', 'not food')}</i></h3>
          <div className="chiller-bins">
            <div className={`chiller-bin season-bin supply-bin is-still${out ? ' is-out' : ''}`}>
              <span className="chiller-bin-head"><CharcoalIcon /><FitLine className="chiller-bin-name">{supplyName(CHARCOAL, lang)}</FitLine></span>
              <FitLine className="drink-bin-sub" min={9}>{tl(lang, `一袋 ${SACK_STICKS} 根・NT$${SACK_COST}`, `1袋 ${SACK_STICKS}本・NT$${SACK_COST}`, `${SACK_STICKS} a sack, NT$${SACK_COST}`)}</FitLine>
              <span className={`chiller-level${out ? ' is-zero' : sack < SACK_STICKS ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (sack / (2 * SACK_STICKS)) * 100)}%` }} /></span>
              <span className="chiller-bin-info" aria-hidden="true">
                <b className={sack <= 0 ? 'is-zero' : ''}>{tl(lang, '麻袋', '袋', 'Sack')} <em>{sack}</em></b>
                <small>{tl(lang, '炭箱', '炭箱', 'Crate')} <em>{crate}</em></small>
              </span>
              <span className="chiller-buy season-buy">
                <span role="button" tabIndex={0} className={`chiller-btn${cash >= SACK_COST ? '' : ' is-off'}`} onClick={() => cash >= SACK_COST && p.onBuyCharcoal(1)}
                  title={tl(lang, `訂一袋（${SACK_STICKS} 根，NT$${SACK_COST}）`, `1袋注文`, `Order a sack`)}>{tl(lang, '訂一袋', '1袋', '+1 sack')}</span>
                <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${cash >= 2 * SACK_COST ? '' : ' is-off'}`} onClick={() => cash >= 2 * SACK_COST && p.onBuyCharcoal(2)}
                  title={tl(lang, `訂兩袋（NT$${2 * SACK_COST}）`, `2袋注文`, `Order two sacks`)}>{tl(lang, '兩袋', '2袋', '+2')}</span>
              </span>
            </div>
          </div>
          <p className="stock-note">{tl(lang, '桌上的炭箱用完，會從地上的麻袋補滿；麻袋空了就沒有炭可加。', '卓上の炭箱が空になると床の袋から補充。袋が空なら炭は足せない。', 'When the crate on the table runs out it’s filled from the sack on the floor; with the sack empty there’s no charcoal to add.')}</p>
        </section>
        <TissueZone {...p} />
      </div>
    </>
  )
}

/**
 * The month's water and power in the stock's title bar (the owner's: what keeping the shop going costs, laid out): its day of the month,
 * the kWh and the 度 of water so far and what they've cost; clicked, what drew the power and what used the water, and the tariffs.
 */
function MeterChip({ lang, meter: m }: { lang: Lang; meter: Meter }) {
  const [open, setOpen] = useState(false)
  const name = (id: string) => {
    if (id.startsWith('heat:')) { const u = USES[id.slice(5) as Use]; return tl(lang, `${u.zh}・加熱`, `${u.ja}・加熱`, `${u.en}, heating`) }
    const l = LOADS.find((x) => x.id === id)
    return l ? tl(lang, l.zh, l.ja, l.en) : id
  }
  const power = Object.entries(m.power).sort((a, b) => b[1] - a[1])
  const water = Object.entries(m.water).sort((a, b) => b[1] - a[1]) as [Use, number][]
  const tiers = (t: { upTo: number; rate: number }[], unit: string) => t.map((x, i) => `${i ? t[i - 1].upTo + 1 : 1}${x.upTo === Infinity ? '+' : `–${x.upTo}`} ${unit} ${x.rate}`).join('・')
  return (
    <span className="stock-meter-wrap">
      <button type="button" className={`stock-meter${open ? ' is-open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}
        title={tl(lang, '水電（這個月）', '水道光熱費（今月）', 'Water and power (this month)')}>
        <i>{tl(lang, `第 ${Math.max(1, m.day)} 營業日`, `${Math.max(1, m.day)} 営業日目`, `Opening day ${Math.max(1, m.day)}`)}</i>
        <span>⚡{m.kwh.toFixed(1)}</span>
        <span>💧{(m.m3 * 1000).toFixed(0)}L</span>
        <b>NT${m.cost.toFixed(0)}</b>
      </button>
      {open && (
        <div className="stock-meter-detail" role="dialog">
          <h4>{tl(lang, `這個月的水電（${BILL_DAYS} 個營業日一期，第 ${Math.max(1, m.day)} 個營業日）`, `今月の水道光熱費（${BILL_DAYS} 営業日で一期、${Math.max(1, m.day)} 営業日目）`, `This month's water and power (${BILL_DAYS} opening days a bill; opening day ${Math.max(1, m.day)})`)}</h4>
          <p className="stock-meter-sum">{tl(lang, `用電 ${m.kwh.toFixed(2)} 度・用水 ${m.m3.toFixed(3)} 度（${(m.m3 * 1000).toFixed(0)} 公升）・共 NT$${m.cost.toFixed(1)}`,
            `電気 ${m.kwh.toFixed(2)} kWh・水 ${m.m3.toFixed(3)} m³（${(m.m3 * 1000).toFixed(0)} L）・計 NT$${m.cost.toFixed(1)}`,
            `${m.kwh.toFixed(2)} kWh・${m.m3.toFixed(3)} m³ (${(m.m3 * 1000).toFixed(0)} L)・NT$${m.cost.toFixed(1)} in all`)}</p>
          <h5>{tl(lang, '用電（度）', '電気（kWh）', 'Power (kWh)')}</h5>
          <ul>{power.length ? power.map(([id, k]) => <li key={id}><span>{name(id)}</span><b>{k.toFixed(3)}</b></li>) : <li><span>—</span></li>}</ul>
          <h5>{tl(lang, '用水（公升）', '水（L）', 'Water (litres)')}</h5>
          <ul>{water.length ? water.map(([u, l]) => <li key={u}><span>{tl(lang, USES[u].zh, USES[u].ja, USES[u].en)}</span><b>{l.toFixed(1)}</b></li>) : <li><span>—</span></li>}</ul>
          <p className="stock-meter-note">{tl(lang,
            `電費：台電表燈營業用（非夏月）累進 ${tiers(POWER_TIERS, '度')} 元。水費：台水累進 ${tiers(WATER_TIERS, '度')} 元，水表基本費每期 ${WATER_BASE} 元。沒有瓦斯（全靠炭火）。`,
            `電気：台電の従量制（営業用・夏季以外）${tiers(POWER_TIERS, 'kWh')} 元。水道：台水 ${tiers(WATER_TIERS, 'm³')} 元、基本料金 ${WATER_BASE} 元／期。ガスなし（炭火のみ）。`,
            `Power: Taipower commercial, non-summer, tiered ${tiers(POWER_TIERS, 'kWh')} NT$. Water: Taiwan Water ${tiers(WATER_TIERS, 'm³')} NT$, a ${WATER_BASE} NT$ meter charge a bill. No gas (it's all charcoal).`)}</p>
        </div>
      )}
    </span>
  )
}

/** the tissues (game/tissues, the owner's: two hundred to a box, one box in each place's drawer, a consumable): the spare boxes in stock,
 * each place's box as it is now, and packs of five to buy */
function TissueZone(p: Props) {
  const { lang, stock, cash } = p
  const spares = stock[TISSUE] ?? 0
  const boxes = Array.from({ length: GRILL_SEATS.length }, (_, i) => tissuesAt(i))
  const empty = boxes.filter((n) => n <= 0).length, low = boxes.filter((n) => n > 0 && n < BOX_LOW).length
  const sheets = boxes.reduce((a, b) => a + b, 0)
  return (
    <section className="chiller-zone is-supplies">
      <h3 className="chiller-zone-head"><span>{tl(lang, '民生', '日用品', 'Household')}</span><i aria-hidden="true">{tl(lang, '耗材', '消耗品', 'consumable')}</i></h3>
      <div className="chiller-bins">
        <div className={`chiller-bin season-bin supply-bin is-still${empty ? ' is-out' : ''}`}>
          <span className="chiller-bin-head"><span className="tissue-icon" aria-hidden="true">🧻</span><FitLine className="chiller-bin-name">{supplyName(TISSUE, lang)}</FitLine></span>
          <FitLine className="drink-bin-sub" min={9}>{tl(lang, `${BOX_SHEETS}抽 × ${TISSUE_PACK.boxes}盒・NT$${TISSUE_PACK.cost}`, `${BOX_SHEETS}枚 × ${TISSUE_PACK.boxes}箱・NT$${TISSUE_PACK.cost}`, `${BOX_SHEETS} × ${TISSUE_PACK.boxes} boxes, NT$${TISSUE_PACK.cost}`)}</FitLine>
          <span className={`chiller-level${empty ? ' is-zero' : low ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (sheets / (boxes.length * BOX_SHEETS || 1)) * 100)}%` }} /></span>
          <span className="chiller-bin-info" aria-hidden="true">
            <b className={spares <= 0 ? 'is-zero' : ''}>{tl(lang, '備品', '予備', 'Spare')} <em>{spares}</em></b>
            <small>{tl(lang, `座位 ${boxes.length} 盒：空 ${empty}・快沒 ${low}`, `席 ${boxes.length}箱：空 ${empty}・残少 ${low}`, `${boxes.length} at places: ${empty} empty, ${low} low`)}</small>
          </span>
          <span className="chiller-buy season-buy">
            <span role="button" tabIndex={0} className={`chiller-btn${cash >= TISSUE_PACK.cost ? '' : ' is-off'}`} onClick={() => cash >= TISSUE_PACK.cost && p.onBuyTissues(1)}
              title={tl(lang, `訂一組（${TISSUE_PACK.boxes} 盒，NT$${TISSUE_PACK.cost}）`, '1組注文', 'Order a pack')}>{tl(lang, '訂一組', '1組', '+1 pack')}</span>
            <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${cash >= 2 * TISSUE_PACK.cost ? '' : ' is-off'}`} onClick={() => cash >= 2 * TISSUE_PACK.cost && p.onBuyTissues(2)}
              title={tl(lang, `訂兩組（NT$${2 * TISSUE_PACK.cost}）`, '2組注文', 'Order two packs')}>{tl(lang, '兩組', '2組', '+2')}</span>
          </span>
        </div>
      </div>
      <p className="stock-note">{tl(lang, '每個座位的抽屜一盒；客人吃完會抽幾張，盒子空了客人會不滿（影響店家評價）。開店前空的（或快空的）會用備品換新盒。',
        '各席の引き出しに1箱。食べ終わると数枚使う。空だとお客さんの評価が下がる。開店前に空（残り少ない）箱を予備と交換。',
        'A box in each place’s drawer; customers take a few as they finish, and an empty one costs the shop its rating. Before opening, empty (or nearly empty) boxes are swapped from the spares.')}</p>
    </section>
  )
}
