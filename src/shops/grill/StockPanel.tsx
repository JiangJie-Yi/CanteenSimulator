import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BOX_LOW, BOX_SHEETS, TISSUE, TISSUE_PACK } from '@/game/tissues'
import { ROLL, SOAP, SOAP_FULL, SOAP_REFILL_AT, TOWEL, TOWEL_FULL, TOWEL_REFILL_AT, WASHROOM_PACKS } from '@/game/washroom'
import { ROLL_LOW } from '@/game/stocker'
import { RECEIPT, RECEIPT_PACK, ROLL_SLIPS } from '@/game/receipts'
import { HOUSEHOLD, HOUSEHOLD_PACK, householdName, type Household } from '@/game/household'
import { tablewareList } from '@/game/tableware'
import { LOADS, USES, POWER_TIERS, WATER_TIERS, WATER_BASE, BILL_DAYS, type Meter, type Use } from '@/game/utilities'
import { createPortal } from 'react-dom'
import { nameIn, tl, type Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { SeasoningArt } from '@/ui/SeasoningArt'
import { SEASONINGS, SEASON_COST, type Seasoning } from '@/data/recipes'
import { STORAGES, stockNameOf, storageName, storageOf, type Storage } from '@/data/storage'
import { PAR, STOCK_CAP, inPacks, keepsDry, packOf, roomFor } from '@/game/economy'
import { freshGrade } from '@/game/freshness'
import { lotGrades, type Lot } from '@/game/lots'
import { CHARCOAL, NORI, NORI_COST, NORI_PAR, SACK_COST, SACK_STICKS, SEASON_PAR, seasonId, supplyName } from '@/game/supplies'
import { FitLine } from '@/ui/FitLine'
import { Glyph } from '@/ui/GameIcons'
import { FoodArt } from '@/ui/FoodArt'
import type { Restock } from '@/ui/Menu'
import { CRATE, FREEZER_TEMP } from './Decor'
import { GRILL_SEATS, onPrinter, PLATE_COUNT, PRINTER, tissuesAt, TOILETS } from './bar'
import { DrinkStockBody } from './DrinkStockPanel'
import { frostSound, usePanelSound } from '@/ui/uiSound'

/** the stock panel's tabs: the freezer, the fridge (the cupboards' under the cook table), the larder at room temperature, the drinks, and what
 * isn't food (the charcoal) */
export type StockTab = Storage | 'drinks' | 'tableware' | 'supplies'
const TABS: { id: StockTab; zh: string; ja: string; en: string }[] = [
  { id: 'frozen', zh: '冷凍櫃', ja: '冷凍庫', en: 'Freezer' },
  { id: 'chilled', zh: '冷藏櫃', ja: '冷蔵庫', en: 'Fridge' },
  { id: 'ambient', zh: '常溫區', ja: '常温', en: 'Larder' },
  { id: 'drinks', zh: '飲料', ja: 'ドリンク', en: 'Drinks' },
  { id: 'tableware', zh: '餐具', ja: '食器', en: 'Tableware' },
  { id: 'supplies', zh: '耗材', ja: '消耗品', en: 'Supplies' },
]

/** each seasoning's picture as the panel draws it: its own vessel (ui/SeasoningArt) */
function SeasonIcon({ k }: { k: Seasoning }) {
  return <SeasoningArt k={k} className="season-icon" />
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
  /** each food's lots, as bought (game/lots): the card shows how many portions are at each freshness */
  lots?: Record<string, Lot[]>
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
  /** packs of receipt paper bought (game/receipts) */
  onBuyReceipts: (packs: number) => void
  /** the cleaning things (game/household) bought by the pack */
  onBuyHousehold: (id: Household, packs: number) => void
  /** packs of the washrooms' spares bought (game/washroom: toilet rolls, paper towels, hand soap refills) */
  onBuyWashroom: (id: string, packs: number) => void
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
    if (t === 'supplies') return ((p.stock[CHARCOAL] ?? 0) + CRATE.left <= 0 ? 1 : 0) + ((p.stock[RECEIPT] ?? 0) <= 0 && PRINTER.slips < ROLL_SLIPS / 5 ? 1 : 0)
      + WASHROOM_CARDS.filter((c) => (p.stock[c.id] ?? 0) <= 0 && c.low()).length
      + HOUSEHOLD.filter((id) => (p.stock[id] ?? 0) <= 0).length
    if (t === 'drinks' || t === 'tableware') return 0
    const zone = foods.filter((x) => storageOf(x.id) === t).filter((x) => (p.stock[x.id] ?? 0) <= 0 || freshGrade(p.fresh[x.id] ?? 100) === 'spoiled').length
    const seas = SEASONINGS.filter((k) => storageOf(seasonId(k)) === t && (p.stock[seasonId(k)] ?? 0) <= 0).length
    return zone + seas
  }
  // (slid off to the right by the handle on its left edge, all but the handle and its upright name, which bring it back (the owner's); opened
  // again, or sent to a tab or a thing by a click in the room, it's out)
  const [tucked, setTucked] = useState(false)
  useEffect(() => { setTucked(false) }, [tab, p.focus])
  usePanelSound(!tucked)
  // (to the freezer's tab: the soft breath of its seal and a tick of ice)
  const tabWas = useRef(tab)
  useEffect(() => { if (tab === 'frozen' && tabWas.current !== 'frozen') frostSound(); tabWas.current = tab }, [tab])
  const panel = useRef<HTMLElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  // (the handle at the middle of the panel's height, however tall its tab makes it)
  useLayoutEffect(() => {
    const el = panel.current, h = handle.current
    if (el && h) h.style.top = `${el.offsetTop + el.offsetHeight / 2}px`
  })
  const tuckLabel = tucked ? tl(lang, '展開庫存', '在庫を開く', 'Show stock') : tl(lang, '收起庫存', '在庫をしまう', 'Hide stock')
  return createPortal(
    <>
      <h2 className={`dock-title${tucked ? ' is-tucked' : ''}`} aria-hidden="true" onClick={tucked ? () => setTucked(false) : undefined}>
        {tl(lang, '庫存', '在庫', 'Stock')}<small lang="en">STOCK</small>
      </h2>
      <button ref={handle} type="button" className={`dock-handle stock-handle${tucked ? ' is-tucked' : ''}`} onClick={() => setTucked((v) => !v)}
        aria-expanded={!tucked} aria-label={tuckLabel} title={tuckLabel}>
        <svg viewBox="0 0 10 18" aria-hidden="true"><path d={tucked ? 'M7 3 L3 9 L7 15' : 'M3 3 L7 9 L3 15'} /></svg>
      </button>
      <section ref={panel} className={`drink-stock stock-panel${tucked ? ' is-tucked' : ''}${tab === 'frozen' ? ' is-frozen' : tab === 'chilled' || tab === 'drinks' ? ' is-cool' : ''}`} role="dialog" aria-label={tl(lang, '庫存', '在庫', 'Stock')} inert={tucked}>
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
        {tab === 'drinks' ? <DrinkStockBody lang={lang} /> : tab === 'supplies' ? <Supplies {...p} /> : tab === 'tableware' ? <Tableware lang={lang} /> : <Foods {...p} zone={tab} foods={foods} />}
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
    const name = stockNameOf(x.id, lang) ?? nameIn(lang, x)
    const cost = p.unitCost(x.id)
    const have = stock[x.id] ?? 0
    const out = have <= 0
    // (what's bought by the pack (the rice: a bag cooks a pot of ten portions) is ordered in whole bags, and doesn't go off)
    const pack = packOf(x.id)
    const par = Math.max(PAR, pack)
    const need = inPacks(x.id, par - have)
    // (no buying past the room there is (STOCK_CAP): a button's off once it's full; what's asked for past it isn't bought)
    const room = roomFor(x.id, have)
    const full = room <= 0
    const can = (k: number) => k > 0 && room > 0 && cash >= cost * Math.min(k, room)
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
          <FoodArt id={pack > 1 ? 'RiceBag' : x.id} store={storageOf(x.id)} band />
          <FitLine className="chiller-bin-name">{name}</FitLine>
          {n > 0 && <span key={n} className="chiller-taken" aria-hidden="true">{tl(lang, '試', '試', 'Try')}×{n}</span>}
        </span>
        {/* (its English under it, for the Chinese and Japanese: in English it'd only say the name again, so its line's left blank, the card
            as tall as the others) */}
        {x.en && <span className="chiller-bin-en" lang="en" aria-hidden={lang === 'en' || undefined}>{lang === 'en' ? ' ' : stockNameOf(x.id, 'en') ?? x.en}</span>}
        {/* (the bar is how full its room is, said over it (the owner's: a green bar with nothing to say what it was, taken for the freshness
            under it): its stock against STOCK_CAP, 滿載 once it's full; orange while it's under the usual stock (PAR)) */}
        <span className={`chiller-cap${full ? ' is-full' : ''}`} aria-hidden="true">
          <span className="chiller-cap-row">
            <span>{tl(lang, '庫存容量', '在庫容量', 'Room')}</span>
            <em>{full && <b>{tl(lang, '滿載', '満杯', 'Full')}</b>}{have}/{STOCK_CAP}</em>
          </span>
          <span className={`chiller-level${out ? ' is-zero' : have < par ? ' is-low' : ''}`}><i style={{ width: `${Math.min(100, (have / STOCK_CAP) * 100)}%` }} /></span>
        </span>
        <span className="chiller-bin-info" aria-hidden="true">
          <b className={out ? 'is-zero' : ''}>{tl(lang, '庫存', '在庫', 'Stock')} <em>{have}</em>{pack > 1 && tl(lang, '份', '人前', '')}</b>
          <small title={pack > 1 ? tl(lang, `一袋 ${pack} 份`, `1袋 ${pack}人前`, `${pack} a bag`) : undefined}>{tl(lang, '成本', '原価', 'Cost')} <em>{cost * pack}</em></small>
        </span>
        {!out && !keepsDry(x.id) && (
          <span className={`chiller-fresh is-${grade}`} aria-hidden="true" title={grade === 'spoiled'
            ? tl(lang, `鮮度 ${f}%：已經壞了，不可食用（做出來很難吃，客人吃了容易拉肚子）`, `鮮度 ${f}%：傷んでいて食べられない（まずく、客がお腹を壊しやすい）`, `Freshness ${f}%: spoiled, not fit to eat (it tastes bad, and may well upset a customer's stomach)`)
            : tl(lang, `鮮度 ${f}%：越不新鮮，做出來越不好吃`, `鮮度 ${f}%：鮮度が落ちると味も落ちる`, `Freshness ${f}%: the staler, the less tasty`)}>
            <svg viewBox="0 0 16 16"><path d="M13.5 2.5C7 2.5 3 5.5 3 10c0 1.3.4 2.4 1 3.2C5 9.5 7.5 7 11 5.5 8 7.5 6 10 5.2 13.6 6 14 7 14 8 14c4 0 5.5-4.5 5.5-11.5z" /></svg>
            <span className="chiller-fresh-bar"><i style={{ width: `${f}%` }} /></span>
            <em>{grade === 'spoiled' ? tl(lang, '不可食用', '食用不可', 'Spoiled') : `${f}%`}</em>
          </span>
        )}
        {!out && !keepsDry(x.id) && <LotStrip lang={lang} lots={p.lots?.[x.id]} />}
        <span className="chiller-buy">
          {pack > 1 ? <>
            <span role="button" tabIndex={-1} className={`chiller-btn${can(pack) ? '' : ' is-off'}`} title={tl(lang, `叫 1 袋（${pack} 份）`, `1袋仕入れる（${pack}人前）`, `Order a bag (${pack})`)} onClick={buy(pack)}>{tl(lang, '+1袋', '+1袋', '+1 bag')}</span>
            <span role="button" tabIndex={-1} className={`chiller-btn${can(2 * pack) ? '' : ' is-off'}`} title={tl(lang, `叫 2 袋（${2 * pack} 份）`, `2袋仕入れる`, `Order 2 bags`)} onClick={buy(2 * pack)}>{tl(lang, '+2袋', '+2袋', '+2')}</span>
          </> : <>
            <span role="button" tabIndex={-1} className={`chiller-btn${can(1) ? '' : ' is-off'}`}
              title={full ? tl(lang, `放滿了（最多 ${STOCK_CAP} 份）`, `満杯（最大 ${STOCK_CAP}）`, `Full (${STOCK_CAP} at most)`) : tl(lang, '叫 1 份', '1つ仕入れる', 'Order 1')} onClick={buy(1)}>+1</span>
            <span role="button" tabIndex={-1} className={`chiller-btn${can(10) ? '' : ' is-off'}`}
              title={full ? tl(lang, `放滿了（最多 ${STOCK_CAP} 份）`, `満杯（最大 ${STOCK_CAP}）`, `Full (${STOCK_CAP} at most)`)
                : room < 10 ? tl(lang, `只放得下 ${room} 份`, `あと ${room} しか入らない`, `Room for ${room} only`) : tl(lang, '叫 10 份', '10個仕入れる', 'Order 10')} onClick={buy(10)}>+10</span>
          </>}
          <span role="button" tabIndex={-1} className={`chiller-btn chiller-fill${can(need) ? '' : ' is-off'}`}
            title={need ? tl(lang, `補到 ${par} 份（${need} 份，NT$${cost * need}）`, `${par}まで補充（${need}）`, `Fill up to ${par} (${need}, NT$${cost * need})`) : tl(lang, '已經夠了', '十分あります', 'Enough already')}
            onClick={buy(need)}>{tl(lang, '補', '補', '+')}</span>
        </span>
      </div>
    )
  }
  /** the nori: by the sheet, one round every onigiri (game/supplies GARNISH), kept to its usual stock */
  const noriBin = () => {
    const have = stock[NORI] ?? 0
    const out = have <= 0
    const need = Math.max(0, NORI_PAR - have)
    const can = (n: number) => n > 0 && cash >= NORI_COST * n
    const buy = (n: number) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (can(n)) p.onBuy(NORI, n) }
    return (
      <div key={NORI} className={`chiller-bin season-bin is-still${out ? ' is-out' : ''}`} aria-label={`${supplyName(NORI, lang)}，${tl(lang, '庫存', '在庫', 'Stock')} ${have}`}>
        <span className="chiller-bin-head"><FoodArt id="Nori" store="ambient" band /><FitLine className="chiller-bin-name">{supplyName(NORI, lang)}</FitLine></span>
        <span className={`chiller-level${out ? ' is-zero' : have < NORI_PAR / 3 ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (have / NORI_PAR) * 100)}%` }} /></span>
        <span className="chiller-bin-info" aria-hidden="true">
          <b className={out ? 'is-zero' : ''}>{tl(lang, '剩', '残り', 'Left')} <em>{have}</em>{tl(lang, ' 片', '枚', '')}</b>
          <small>{tl(lang, '每片', '1枚', 'Each')} <em>{NORI_COST}</em></small>
        </span>
        <span className="chiller-buy season-buy">
          <span role="button" tabIndex={-1} className={`chiller-btn${can(10) ? '' : ' is-off'}`} title={tl(lang, '叫 10 片', '10枚仕入れる', 'Order 10')} onClick={buy(10)}>+10</span>
          <span role="button" tabIndex={-1} className={`chiller-btn chiller-fill${can(need) ? '' : ' is-off'}`}
            title={need ? tl(lang, `補到 ${NORI_PAR} 片（NT$${NORI_COST * need}）`, `${NORI_PAR}枚まで補充`, `Fill up to ${NORI_PAR} (NT$${NORI_COST * need})`) : tl(lang, '已經夠了', '十分あります', 'Enough already')}
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
        {zone === 'ambient' && (
          <section className={`chiller-zone is-${zone} is-seasonings`}>
            <h3 className="chiller-zone-head"><span>{tl(lang, '配料', '付け合わせ', 'Garnish')}</span><i aria-hidden="true">{tl(lang, '一個飯糰一片', 'おにぎり1個に1枚', 'a sheet an onigiri')}</i></h3>
            <div className="chiller-bins">{noriBin()}</div>
          </section>
        )}
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
        <ReceiptZone {...p} />
        <HouseholdZone {...p} />
      </div>
    </>
  )
}

/** the cleaning things (game/household, item 83): the dish soap by the sink and the toilet cleaner for the washrooms, bottles in stock, bought
 * by the pack */
function HouseholdZone(p: Props) {
  const { lang, stock, cash } = p
  return (
    <section className="chiller-zone is-supplies">
      <h3 className="chiller-zone-head"><span>{tl(lang, '清潔用品', '掃除用品', 'Cleaning')}</span><i aria-hidden="true">{tl(lang, '耗材', '消耗品', 'consumable')}</i></h3>
      <div className="chiller-bins">
        {HOUSEHOLD.map((id) => {
          const have = stock[id] ?? 0, pk = HOUSEHOLD_PACK[id], out = have <= 0
          return (
            <div key={id} className={`chiller-bin season-bin supply-bin is-still${out ? ' is-out' : ''}`}>
              <span className="chiller-bin-head"><BottleIcon kind={id} /><FitLine className="chiller-bin-name">{householdName(id, lang)}</FitLine></span>
              <FitLine className="drink-bin-sub" min={9}>{tl(lang, `一組 ${pk.bottles} 瓶・NT$${pk.cost}`, `1組 ${pk.bottles}本・NT$${pk.cost}`, `${pk.bottles} bottles, NT$${pk.cost}`)}</FitLine>
              <span className={`chiller-level${out ? ' is-zero' : have < pk.bottles ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (have / (2 * pk.bottles)) * 100)}%` }} /></span>
              <span className="chiller-bin-info" aria-hidden="true">
                <b className={out ? 'is-zero' : ''}>{tl(lang, '備品', '予備', 'Spare')} <em>{have}</em></b>
                <small>{tl(lang, '瓶', '本', 'bottles')}</small>
              </span>
              <span className="chiller-buy season-buy">
                <span role="button" tabIndex={0} className={`chiller-btn${cash >= pk.cost ? '' : ' is-off'}`} onClick={() => cash >= pk.cost && p.onBuyHousehold(id, 1)}
                  title={tl(lang, `訂一組（${pk.bottles} 瓶，NT$${pk.cost}）`, '1組注文', 'Order a pack')}>{tl(lang, '訂一組', '1組', '+1 pack')}</span>
                <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${cash >= 2 * pk.cost ? '' : ' is-off'}`} onClick={() => cash >= 2 * pk.cost && p.onBuyHousehold(id, 2)}
                  title={tl(lang, `訂兩組（NT$${2 * pk.cost}）`, '2組注文', 'Order two packs')}>{tl(lang, '兩組', '2組', '+2')}</span>
              </span>
            </div>
          )
        })}
      </div>
      <p className="stock-note">{tl(lang, '洗碗精放在水槽邊，廁所清潔劑給兩間廁所打掃用。', '食器用洗剤はシンク脇、トイレ用洗剤は2つのトイレの掃除に。', 'The dish soap stands by the sink; the toilet cleaner is for cleaning the two washrooms.')}</p>
    </section>
  )
}
/** a bottle's picture: the dish soap's pump bottle (green), the toilet cleaner's bent-necked one (blue) */
function BottleIcon({ kind }: { kind: Household }) {
  const soap = kind === HOUSEHOLD[0]
  return (
    <svg className="season-icon" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="29.2" rx="9" ry="1.5" fill="#1d2a36" opacity="0.2" />
      {soap ? <>
        <rect x="14.6" y="3" width="2.8" height="6" fill="#e8e8e8" stroke="#555" strokeWidth="0.6" />
        <path d="M13 3 h7 v2 h-7 z" fill="#f2f2f2" stroke="#555" strokeWidth="0.6" />
        <path d="M11 11 Q11 9 13 9 h6 Q21 9 21 11 L22 27 Q22 28.5 20.5 28.5 h-9 Q10 28.5 10 27 Z" fill="#7cc46a" stroke="#2f5a26" strokeWidth="1" />
        <rect x="12.5" y="15" width="7" height="7" rx="1" fill="#f6f3e6" stroke="#2f5a26" strokeWidth="0.5" />
      </> : <>
        <path d="M17 3 l5 3 -1.4 2.2 -4-2.2 Z" fill="#e94b3c" stroke="#7a1f16" strokeWidth="0.6" />
        <path d="M15 6 h4 v4 h-4 Z" fill="#dfe6ee" stroke="#4a5a6a" strokeWidth="0.6" />
        <path d="M11 12 Q11 10 13.5 10 h7 Q23 10 23 12 L23.5 27 Q23.5 28.5 22 28.5 h-10 Q10.5 28.5 10.5 27 Z" fill="#5aa2e0" stroke="#24507a" strokeWidth="1" />
        <rect x="13" y="16" width="8" height="7" rx="1" fill="#f3f7fb" stroke="#24507a" strokeWidth="0.5" />
      </>}
    </svg>
  )
}

/**
 * The tableware the shop owns (game/tableware's list, item 83): what it is, how many, where it's kept; the plates told over live, where
 * they are just now (on the racks, in the sink, the washer and the basket, out at the seats). Nothing here's bought or used up: it's the
 * shop's own.
 */
function Tableware({ lang }: { lang: Lang }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 500); return () => window.clearInterval(t) }, [])
  const L = lang === 'ja' ? 1 : lang === 'en' ? 2 : 0
  const c = PLATE_COUNT
  const live: [string, number][] = [
    [tl(lang, '架上', '棚', 'Racks'), c.rack + c.low], [tl(lang, '水槽', 'シンク', 'Sink'), c.sink], [tl(lang, '烘碗機', '乾燥機', 'Washer'), c.washer],
    [tl(lang, '瀝水籃', '水切り', 'Basket'), c.basket], [tl(lang, '使用中', '使用中', 'Out'), c.out],
  ]
  return (
    <div className="chiller-scroll">
      <section className="chiller-zone is-supplies">
        <h3 className="chiller-zone-head"><span>{tl(lang, '餐具', '食器', 'Tableware')}</span><i aria-hidden="true">{tl(lang, '店裡的', '店の備品', 'the shop’s own')}</i></h3>
        <div className="chiller-bins">
          {tablewareList(GRILL_SEATS.length).map((w) => (
            <div key={w.id} className="chiller-bin season-bin supply-bin is-still">
              <span className="chiller-bin-head"><WareIcon id={w.id} /><FitLine className="chiller-bin-name">{[w.zh, w.ja, w.en][L]}</FitLine></span>
              <FitLine className="drink-bin-sub" min={9}>{w.where[L]}</FitLine>
              <span className="chiller-bin-info" aria-hidden="true">
                <b>{tl(lang, '共', '計', 'In all')} <em>{w.n}</em>{w.unit[L]}</b>
              </span>
              {/* (where the plates are now, in two short lines that each shrink to fit: never broken inside a line) */}
              {w.id === 'plates' && <>
                <FitLine className="drink-bin-sub" min={8}>{[live[0], live[4]].map(([k, n]) => `${k} ${n}`).join('・')}</FitLine>
                <FitLine className="drink-bin-sub" min={8}>{live.slice(1, 4).map(([k, n]) => `${k} ${n}`).join('・')}</FitLine>
              </>}
            </div>
          ))}
        </div>
        <p className="stock-note">{tl(lang, '餐具是店裡自己的，不會用完；盤子的數字是現在各在哪裡。', '食器は店の備品で、なくならない。皿の数は今どこにあるか。', 'The tableware is the shop’s own and isn’t used up; the plates’ numbers say where they are just now.')}</p>
      </section>
    </div>
  )
}
/** each piece's little picture */
function WareIcon({ id }: { id: string }) {
  const s = { fill: '#f4f1ea', stroke: '#3b4a5c', strokeWidth: 1 }
  const blue = '#2f4f86'
  const cup = id === 'riceBowls' || id === 'soupBowls' || id === 'teacups' || id === 'sakeCups'
  const cupPath = id === 'teacups' ? 'M9 9 h14 l-1.5 16 q-0.2 2 -2 2 h-7 q-1.8 0 -2 -2 Z' : id === 'sakeCups' ? 'M10 14 h12 l-2 10 q-0.3 1.5 -2 1.5 h-4 q-1.7 0 -2 -1.5 Z' : 'M5 12 h22 q-1 13 -11 13 q-10 0 -11 -13 Z'
  return (
    <svg className="season-icon" viewBox="0 0 32 32" aria-hidden="true">
      {id === 'plates' && <><ellipse cx="16" cy="18" rx="13" ry="6" {...s} /><ellipse cx="16" cy="17" rx="8" ry="3.4" fill="none" stroke={blue} strokeWidth="1" /></>}
      {cup && <path d={cupPath} fill={id === 'soupBowls' ? '#2a1a16' : '#f4f1ea'} stroke={id === 'soupBowls' ? '#000' : '#3b4a5c'} strokeWidth="1" />}
      {id === 'soupBowls' && <path d="M6 12 h20" stroke="#b5372a" strokeWidth="2" />}
      {id === 'riceBowls' && <path d="M7 15 h18" stroke={blue} strokeWidth="1.4" />}
      {id === 'spoons' && <path d="M6 22 q0 -6 7 -6 q6 0 6 4 q0 3 -6 3 q-4 0 -7 -1 Z M18 19 L28 10" {...s} />}
      {id === 'chopsticks' && <><path d="M7 27 L22 4" stroke="#6b2a1e" strokeWidth="2" /><path d="M11 27 L25 5" stroke="#6b2a1e" strokeWidth="2" /></>}
      {id === 'rests' && <path d="M6 20 q5 -6 10 0 q5 -6 10 0 v3 h-20 Z" fill="#c9a26b" stroke="#5a3e22" strokeWidth="1" />}
      {id === 'soyDishes' && <><ellipse cx="16" cy="18" rx="10" ry="5" {...s} /><ellipse cx="16" cy="18" rx="6" ry="2.6" fill="#4a2410" /></>}
      {id === 'skewers' && [8, 13, 18, 23].map((x) => <g key={x}><path d={`M${x} 28 L${x + 2} 7`} stroke="#8a8f96" strokeWidth="1.4" /><circle cx={x + 2.2} cy="5.5" r="1.6" fill="none" stroke="#8a8f96" strokeWidth="1" /></g>)}
      {id === 'tokkuri' && <path d="M13 4 h6 v3 q-1 2 1 5 q5 6 3 12 q-1 4 -7 4 q-6 0 -7 -4 q-2 -6 3 -12 q2 -3 1 -5 Z" {...s} />}
      {id === 'trays' && <><rect x="4" y="14" width="24" height="8" rx="2" fill="#5a2a1a" stroke="#2a120a" strokeWidth="1" /><rect x="6" y="15.5" width="20" height="4" rx="1" fill="#7a3a24" /></>}
    </svg>
  )
}

/** the receipt paper (game/receipts, the owner's: a consumable): the roll in the register's printer (slips left on it), the spare rolls in
 * stock, and packs of ten to buy */
function ReceiptZone(p: Props) {
  const { lang, stock, cash } = p
  const spares = stock[RECEIPT] ?? 0
  const slips = useSyncExternalStore(onPrinter, () => PRINTER.slips, () => PRINTER.slips)
  const out = spares <= 0 && slips <= 0
  return (
    <section className="chiller-zone is-supplies">
      <h3 className="chiller-zone-head"><span>{tl(lang, '收銀', 'レジ', 'Till')}</span><i aria-hidden="true">{tl(lang, '耗材', '消耗品', 'consumable')}</i></h3>
      <div className="chiller-bins">
        <div className={`chiller-bin season-bin supply-bin is-still${out ? ' is-out' : ''}`}>
          <span className="chiller-bin-head"><Glyph id="receipt" size={18} className="tissue-icon" /><FitLine className="chiller-bin-name">{supplyName(RECEIPT, lang)}</FitLine></span>
          <FitLine className="drink-bin-sub" min={9}>{tl(lang, `57mm 感熱紙 × ${RECEIPT_PACK.rolls}捲・NT$${RECEIPT_PACK.cost}`, `57mm 感熱紙 × ${RECEIPT_PACK.rolls}巻・NT$${RECEIPT_PACK.cost}`, `57 mm thermal × ${RECEIPT_PACK.rolls}, NT$${RECEIPT_PACK.cost}`)}</FitLine>
          <span className={`chiller-level${slips <= 0 ? ' is-zero' : slips < ROLL_SLIPS / 5 ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (slips / ROLL_SLIPS) * 100)}%` }} /></span>
          <span className="chiller-bin-info" aria-hidden="true">
            <b className={spares <= 0 ? 'is-zero' : ''}>{tl(lang, '備品', '予備', 'Spare')} <em>{spares}</em></b>
            <small>{tl(lang, `印表機剩 ${slips} 張`, `プリンター残り ${slips} 枚`, `${slips} slips in the printer`)}</small>
          </span>
          <span className="chiller-buy season-buy">
            <span role="button" tabIndex={0} className={`chiller-btn${cash >= RECEIPT_PACK.cost ? '' : ' is-off'}`} onClick={() => cash >= RECEIPT_PACK.cost && p.onBuyReceipts(1)}
              title={tl(lang, `訂一組（${RECEIPT_PACK.rolls} 捲，NT$${RECEIPT_PACK.cost}）`, '1組注文', 'Order a pack')}>{tl(lang, '訂一組', '1組', '+1 pack')}</span>
            <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${cash >= 2 * RECEIPT_PACK.cost ? '' : ' is-off'}`} onClick={() => cash >= 2 * RECEIPT_PACK.cost && p.onBuyReceipts(2)}
              title={tl(lang, `訂兩組（NT$${2 * RECEIPT_PACK.cost}）`, '2組注文', 'Order two packs')}>{tl(lang, '兩組', '2組', '+2')}</span>
          </span>
        </div>
      </div>
      <p className="stock-note">{tl(lang, `每位客人結帳印一張發票（一捲 ${ROLL_SLIPS} 張）；印表機的紙用完，收銀員會換上一捲備品；沒有備品就開不出發票，客人會不滿（影響店家評價）。`,
        `お会計ごとにレシートを1枚（1巻 ${ROLL_SLIPS} 枚）。紙が切れるとレジ係が予備に交換。予備がないとレシートが出せず、お客さんの評価が下がる。`,
        `A receipt for every customer who pays (${ROLL_SLIPS} to a roll); when the printer runs out the cashier puts in a spare, and with none spare there's no receipt, which costs the shop its rating.`)}</p>
    </section>
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
        <span><Glyph id="bolt" size="1em" className="meter-bolt" />{m.kwh.toFixed(1)}</span>
        <span><Glyph id="drop" size="1em" className="meter-drop" />{(m.m3 * 1000).toFixed(0)}L</span>
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
          <span className="chiller-bin-head"><Glyph id="tissue" size={18} className="tissue-icon" /><FitLine className="chiller-bin-name">{supplyName(TISSUE, lang)}</FitLine></span>
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
        {WASHROOM_CARDS.map((c) => <WashroomCard key={c.id} {...p} card={c} />)}
      </div>
      <p className="stock-note">{tl(lang, '每個座位的抽屜一盒；客人吃完會抽幾張，盒子空了客人會不滿（影響店家評價）。開店前空的（或快空的）會用備品換新盒。洗手間的捲筒衛生紙、擦手紙（一盒 150 張）與洗手乳，倉儲巡到時用備品補，開店前快沒的擦手紙與洗手乳也會補滿。',
        '各席の引き出しに1箱。食べ終わると数枚使う。空だとお客さんの評価が下がる。開店前に空（残り少ない）箱を予備と交換。トイレのロール、ペーパータオル（1箱150枚）、ハンドソープは倉庫係が見回りで予備から補充し、開店前にも少ないタオルとソープを補充。',
        'A box in each place’s drawer; customers take a few as they finish, and an empty one costs the shop its rating. Before opening, empty (or nearly empty) boxes are swapped from the spares. The washrooms’ toilet rolls, paper towels (150 to a box) and hand soap are refilled from the spares by the stock keeper on his round, and low towels and soap topped up before opening.')}</p>
    </section>
  )
}

/** the washrooms' spares in the household zone (game/washroom; the owner's, 2026-11-10: with their counts, to be ordered): each its glyph,
 * how it's sold, how much is in use in the two washrooms (the men's and the women's) and how much that is of full, and whether it's running
 * out there */
const WASHROOM_CARDS = [
  { id: ROLL, glyph: 'tissue' as const, level: () => (TOILETS.m.room.paper + TOILETS.f.room.paper) / 2, low: () => TOILETS.m.room.paper < ROLL_LOW || TOILETS.f.room.paper < ROLL_LOW,
    sub: (lang: Lang) => tl(lang, `${WASHROOM_PACKS[ROLL].n} 捲一串・NT$${WASHROOM_PACKS[ROLL].cost}`, `${WASHROOM_PACKS[ROLL].n}ロール・NT$${WASHROOM_PACKS[ROLL].cost}`, `${WASHROOM_PACKS[ROLL].n} rolls, NT$${WASHROOM_PACKS[ROLL].cost}`),
    inUse: (lang: Lang) => tl(lang, `男廁 ${pctOf(TOILETS.m.room.paper)}・女廁 ${pctOf(TOILETS.f.room.paper)}`, `男 ${pctOf(TOILETS.m.room.paper)}・女 ${pctOf(TOILETS.f.room.paper)}`, `Men’s ${pctOf(TOILETS.m.room.paper)}, women’s ${pctOf(TOILETS.f.room.paper)}`) },
  { id: TOWEL, glyph: 'towel' as const, level: () => (TOILETS.m.towels + TOILETS.f.towels) / (2 * TOWEL_FULL), low: () => Math.min(TOILETS.m.towels, TOILETS.f.towels) < TOWEL_REFILL_AT,
    sub: (lang: Lang) => tl(lang, `${TOWEL_FULL}張 × ${WASHROOM_PACKS[TOWEL].n}包・NT$${WASHROOM_PACKS[TOWEL].cost}`, `${TOWEL_FULL}枚 × ${WASHROOM_PACKS[TOWEL].n}パック・NT$${WASHROOM_PACKS[TOWEL].cost}`, `${TOWEL_FULL} × ${WASHROOM_PACKS[TOWEL].n} packs, NT$${WASHROOM_PACKS[TOWEL].cost}`),
    inUse: (lang: Lang) => tl(lang, `盒內 男 ${TOILETS.m.towels}・女 ${TOILETS.f.towels}`, `箱内 男 ${TOILETS.m.towels}・女 ${TOILETS.f.towels}`, `In the boxes: ${TOILETS.m.towels} / ${TOILETS.f.towels}`) },
  { id: SOAP, glyph: 'soap' as const, level: () => (TOILETS.m.soap + TOILETS.f.soap) / (2 * SOAP_FULL), low: () => Math.min(TOILETS.m.soap, TOILETS.f.soap) < SOAP_REFILL_AT,
    sub: (lang: Lang) => tl(lang, `${WASHROOM_PACKS[SOAP].n} 包・NT$${WASHROOM_PACKS[SOAP].cost}`, `${WASHROOM_PACKS[SOAP].n}袋・NT$${WASHROOM_PACKS[SOAP].cost}`, `${WASHROOM_PACKS[SOAP].n} refills, NT$${WASHROOM_PACKS[SOAP].cost}`),
    inUse: (lang: Lang) => tl(lang, `瓶內 男 ${pctOf(TOILETS.m.soap / SOAP_FULL)}・女 ${pctOf(TOILETS.f.soap / SOAP_FULL)}`, `ボトル 男 ${pctOf(TOILETS.m.soap / SOAP_FULL)}・女 ${pctOf(TOILETS.f.soap / SOAP_FULL)}`, `Bottles: ${pctOf(TOILETS.m.soap / SOAP_FULL)} / ${pctOf(TOILETS.f.soap / SOAP_FULL)}`) },
]
const pctOf = (k: number) => `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`
function WashroomCard(p: Props & { card: (typeof WASHROOM_CARDS)[number] }) {
  const { lang, stock, cash, card } = p
  const spares = stock[card.id] ?? 0, pack = WASHROOM_PACKS[card.id], low = card.low()
  return (
    <div className={`chiller-bin season-bin supply-bin is-still${spares <= 0 && low ? ' is-out' : ''}`}>
      <span className="chiller-bin-head"><Glyph id={card.glyph} size={18} className="tissue-icon" /><FitLine className="chiller-bin-name">{supplyName(card.id, lang)}</FitLine></span>
      <FitLine className="drink-bin-sub" min={9}>{card.sub(lang)}</FitLine>
      <span className={`chiller-level${card.level() <= 0 ? ' is-zero' : low ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, card.level() * 100)}%` }} /></span>
      <span className="chiller-bin-info" aria-hidden="true">
        <b className={spares <= 0 ? 'is-zero' : ''}>{tl(lang, '備品', '予備', 'Spare')} <em>{spares}</em></b>
        <small>{card.inUse(lang)}</small>
      </span>
      <span className="chiller-buy season-buy">
        <span role="button" tabIndex={0} className={`chiller-btn${cash >= pack.cost ? '' : ' is-off'}`} onClick={() => cash >= pack.cost && p.onBuyWashroom(card.id, 1)}
          title={tl(lang, `訂一組（NT$${pack.cost}）`, '1組注文', 'Order a pack')}>{tl(lang, '訂一組', '1組', '+1 pack')}</span>
        <span role="button" tabIndex={0} className={`chiller-btn chiller-fill${cash >= 2 * pack.cost ? '' : ' is-off'}`} onClick={() => cash >= 2 * pack.cost && p.onBuyWashroom(card.id, 2)}
          title={tl(lang, `訂兩組（NT$${2 * pack.cost}）`, '2組注文', 'Order two packs')}>{tl(lang, '兩組', '2組', '+2')}</span>
      </span>
    </div>
  )
}

/** under a card's freshness (the stalest lot's: used first), how its portions stand when they're of more than one grade: a strip in the
 * grades' colours, as wide as their share, and how many of each (the owner's: 20 at their best, 10 to use up soon) */
function LotStrip({ lang, lots }: { lang: Lang; lots?: Lot[] }) {
  const g = lotGrades(lots)
  const all = g.fresh + g.good + g.tired + g.spoiled
  if (!all || [g.fresh, g.good, g.tired, g.spoiled].filter((n) => n > 0).length < 2) return null
  const word = { fresh: tl(lang, '極鮮', '極鮮', 'Prime'), good: tl(lang, '良好', '良好', 'Good'), tired: tl(lang, '即期', '要消費', 'Use soon'), spoiled: tl(lang, '壞了', '傷み', 'Spoiled') }
  const parts = (['fresh', 'good', 'tired', 'spoiled'] as const).filter((k) => g[k] > 0)
  return (
    <span className="chiller-lots" title={parts.map((k) => `${word[k]} ${g[k]}`).join('・')}>
      <span className="chiller-lots-bar">{parts.map((k) => <i key={k} className={`is-${k}`} style={{ width: `${(g[k] / all) * 100}%` }} />)}</span>
      <small>{parts.map((k) => <b key={k} className={`is-${k}`}>{g[k]}</b>)}</small>
    </span>
  )
}
