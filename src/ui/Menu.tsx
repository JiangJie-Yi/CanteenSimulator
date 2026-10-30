import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent,
  type PointerEvent as ReactPointerEvent } from 'react'
import { nameIn, UI, type Lang } from '@/data/i18n'
import { toChineseNumber, type Dish } from '@/data/menu'
import { PAR } from '@/game/economy'
import { STORAGES, storageName, storageOf } from '@/data/storage'
import { Icon, iconFor } from './Icon'
import { tl } from '@/data/i18n'
import { freshGrade } from '@/game/freshness'
import { FoodArt } from './FoodArt'

export type Restock = 'avg' | 'each' | 'full'

type MenuProps = {
  dish: Dish
  lang: Lang
  /** how fresh each food in the pantry is (0..100, game/freshness) */
  fresh?: Record<string, number>
  /** portions ordered per item, and per base (soup, bowl, set meal) */
  quantities: Record<string, number>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  /** customers' orders just in: their tags light up with the guest's number, and the order is written out */
  feed?: { key: number; id: string; guest: number }[]
  /** shop open: the customers order, not you (the tags only show what's been ordered) */
  locked?: boolean
  /** the shop is open: the board is titled 菜單 (closed and not researching, it is an untitled preview) */
  open?: boolean
  /** portions in stock (a tag with none left is marked 缺) */
  stock?: Record<string, number>
  /** (shop closed) the board is the shop's foods to try out, not a menu: there's no menu until dishes are worked out.
   * Each tag shows what the food costs and how much is in, and it's bought in right there */
  research?: boolean
  unitCost?: (id: string) => number
  onBuy?: (id: string, n: number) => void
  /** the three ways to restock everything at once (補到平均, 各補 5, 補滿), and what each costs (0: nothing to buy) */
  onRestock?: (how: Restock) => void
  restockCost?: Record<Restock, number>
  /** the shop's diary: which day of business, and how many customers today and all told */
  days?: { day: number; today: number; total: number }
  /** (the menu, open) size its tags as the board of the shop's foods is sized: this many tags, this many sets */
  layoutLike?: { tags: number; bases: number }
  cash?: number
}

/**
 * Keep everything on a tag inside the tag: add up how tall its contents run (in tag-ems, matching the CSS:
 * the tag is 15.5em tall with 0.7em padding top and bottom), and shrink the whole tag's type if it would
 * overflow. Long Japanese names (焼きおにぎり) and set names (秋刀魚定食) come out smaller instead of spilling.
 */
function tagFit(name: string, en: string | undefined, price: string, stamp: boolean, stocked = false, twoCol = false): number {
  // (a dish's long name may go down the tag in two columns, its English in two as well)
  const rows = twoCol && name.length > TWO_COL_FROM ? Math.ceil(name.length / 2) : name.length
  const enLen = en ? (twoCol && en.length > 18 ? Math.ceil(en.length / 2) + 2 : en.length) : 0
  const parts = [
    1.4,                                  // icon (or the 選 stamp in its place)
    rows * 1.3 * 1.12,                    // name: 1.3em glyphs + 0.12em letter-spacing
    enLen * 0.56 * 0.6,                   // English, set sideways: ~0.6em per Latin letter at 0.56em
    price.length * 0.82 * 1.12,           // price in kanji numerals
    stamp ? 2 : 0,                        // the 點 / 含 stamp
    stocked ? 5.4 : 0,                    // the test board's cost, stock and +10, in a column at the foot
  ].filter((h) => h > 0)
  const total = parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * 0.35
  const room = 15.5 - 1.4
  return total > room ? room / total : 1
}

/** a dish name longer than this goes on in a second column */
const TWO_COL_FROM = 5
/** the smallest the menu tags are drawn (px of their font): smaller and the names are hard to read */
const MIN_TAG_FONT = 18
/** the size the foods' board last came out at, so the open menu's tags can be the very same size */
let foodsFont: { font: number; rows: number } | null = null

/**
 * Izakaya-style wall menu: vertical wooden tags, a red stamp marks what's been ordered.
 * Click a tag to add a portion, right-click (or press - / Delete on it) to take one away.
 */
/** (a dish on the menu is drawn with the icon of the food it's made from) */
const iconOf = (x: object) => (x as { icon?: string }).icon


export function Menu({ fresh, dish, lang, quantities, onAdd, onRemove, onClear, feed = [], locked = false, open = false, stock, research = false, unitCost, onBuy, onRestock, restockCost, days, layoutLike,
  cash = Infinity }: MenuProps) {
  const t = UI[lang]
  const ordered = dish.bases.filter((b) => (quantities[b.id] ?? 0) > 0)
  const count = [...dish.bases, ...dish.items].reduce((n, x) => n + (quantities[x.id] ?? 0), 0)
  const total = [...dish.bases, ...dish.items].reduce((sum, x) => sum + x.price * (quantities[x.id] ?? 0), 0)
  // what a set brings along shows only while you point at that set: its foods' tags darken and get a 含 stamp
  const [peek, setPeek] = useState<string | null>(null)
  const peeked = dish.bases.find((b) => b.id === peek)
  const included = new Set(Object.keys(peeked?.includes ?? {}))

  // the row is right-to-left, so in Chrome/Firefox scrollLeft runs from 0 (rightmost) to negative.
  const row = useRef<HTMLDivElement>(null)

  // hold the left button and drag to slide the tags sideways; a drag isn't a click, so it doesn't order anything
  const grab = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  /** when a drag of the row last ended (the click that ends it isn't an order; one long after it is) */
  const dragged = useRef(0)
  const onGrab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === 'touch' || !row.current) return
    grab.current = { x: e.clientX, left: row.current.scrollLeft, moved: false }
    dragged.current = 0
  }
  const onDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current
    const el = row.current
    if (!g || !el || !(e.buttons & 1)) return
    const dx = e.clientX - g.x
    if (!g.moved && Math.abs(dx) > 5) {
      g.moved = true
      el.classList.add('is-dragging')
    }
    if (g.moved) el.scrollLeft = g.left - dx
  }
  const onLetGo = () => {
    if (grab.current?.moved) dragged.current = performance.now()
    grab.current = null
    row.current?.classList.remove('is-dragging')
  }

  // on a phone there's no right button: a long press on a tag takes a portion off instead (and the tap that ends
  // it doesn't add one back)
  const press = useRef<{ timer: number; fired: boolean; x: number; y: number } | null>(null)
  // (an empty bin clicked: it shakes and its order buttons light up, so it's clear there's none to take until some's bought)
  const [nudge, setNudge] = useState<{ id: string; k: number } | null>(null)
  const pressStart = (id: string) => (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    const p = { timer: 0, fired: false, x: e.clientX, y: e.clientY }
    p.timer = window.setTimeout(() => {
      p.fired = true
      if (locked) return
      onRemove(id)
      navigator.vibrate?.(15)
    }, 480)
    press.current = p
  }
  const pressMove = (e: ReactPointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) window.clearTimeout(p.timer)
  }
  const pressEnd = () => {
    const p = press.current
    if (p) window.clearTimeout(p.timer)
  }
  const touchOnly = useMemo(() => window.matchMedia('(hover: none)').matches, [])

  // a new order in: bring its tag into view (unless the row is being dragged)
  const lastFeed = feed[feed.length - 1]
  useEffect(() => {
    if (!lastFeed || grab.current) return
    const el = row.current?.querySelector<HTMLElement>(`[data-id="${lastFeed.id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [lastFeed])
  const all = [...dish.bases, ...dish.items]

  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (locked) return
    if (e.key === '-' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(id)
    }
  }

  // every tag on the board is lettered the same size: the size the longest one needs (with room for its stamp)
  const priceText = (x: { price: number }) => (research ? '' : toChineseNumber(x.price))
  const boardFit = Math.min(1, ...all.map((x) => tagFit(nameIn(lang, x), x.en, priceText(x), true, research && !!onBuy, !!layoutLike)))
  const fitStyle = { '--fit': boardFit.toFixed(3) } as CSSProperties

  const baseName = ordered.length ? ordered.map((b) => nameIn(lang, b)).join('、') : null
  const [beforeCount, n1, beforeTotal, n2, after] = t.tally(baseName, count, total, locked)

  /** one wooden tag: click to order a portion, right-click (or - / Delete) to take one off */
  const tag = (x: { id: string; name: string; ja?: string; en?: string; price: number }, icon: string, base: boolean) => {
    const n = quantities[x.id] ?? 0
    const incl = !base && included.has(x.id)
    const name = nameIn(lang, x)
    // (the test kitchen's board shows what it costs)
    const cost = research && unitCost ? unitCost(x.id) : 0
    const price = research ? `${cost}` : toChineseNumber(x.price)
    const hasSet = base && !!(x as { includes?: object }).includes
    const filling = feed.filter((f) => f.id === x.id)
    const parts = (x as { includes?: Record<string, number> }).includes ?? { [x.id]: 1 }
    const out = !!stock && Object.entries(parts).some(([k, q]) => (stock[k] ?? 0) < q)
    return (
      <button key={x.id} type="button" aria-pressed={n > 0} data-id={x.id}
        className={`strip${research ? ' is-research' : ''}${base ? ' strip-base' : ''}${incl ? ' is-included' : ''}${filling.length ? ' is-filling' : ''}${out ? ' is-out' : ''}`}
        aria-label={`${name} ${x.en ?? ''}，${x.price}${n ? `，${t.ordered(n)}` : ''}`}
        style={layoutLike ? { ...fitStyle, '--two-col-rows': name.length > TWO_COL_FROM ? Math.ceil(name.length / 2) : name.length } as CSSProperties : fitStyle}
        onClick={() => {
          const fired = press.current?.fired
          press.current = null
          if (!fired && !locked) onAdd(x.id)
        }}
        onPointerDown={pressStart(x.id)}
        onPointerMove={pressMove}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onContextMenu={(e) => {
          e.preventDefault()
          // (a long press on a phone already took one off)
          if (!press.current && !locked) onRemove(x.id)
        }}
        onKeyDown={onKey(x.id)}
        // (not from a finger: a tap that changes the page on hover would need a second tap to order, on iOS)
        onPointerEnter={hasSet ? (e) => { if (e.pointerType !== 'touch') setPeek(x.id) } : undefined}
        onPointerLeave={hasSet ? () => setPeek(null) : undefined}
        onFocus={hasSet ? () => setPeek(x.id) : undefined}
        onBlur={hasSet ? () => setPeek(null) : undefined}>
        <Icon name={icon} />
        <span className="strip-name">{name}</span>
        {x.en && <span className="strip-en" lang="en">{x.en}</span>}
        {!research && <span className="strip-price">{price}</span>}
        {research && onBuy && (
          // (stocked right here: it isn't the tag itself, which takes one to try)
          <span className="strip-stock" aria-hidden="true">
            {/* (label over number, so a four-figure cost still fits a narrow tag) */}
            <small>{tl(lang, '成本', '原価', 'Cost')}<em>{cost}</em></small>
            <b>{tl(lang, '庫存', '在庫', 'Stock')}<em>{stock?.[x.id] ?? 0}</em></b>
            <span role="button" tabIndex={-1} className={`strip-buy${cash < cost * 10 ? ' is-off' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (cash >= cost * 10) onBuy(x.id, 10) }}>+10</span>
          </span>
        )}
        {incl && <span className="stamp stamp-incl" aria-hidden="true">{t.included}</span>}
        {/* (on the test board the stock line already shows it, in red) */}
        {out && <span className="out-tag" aria-hidden="true">{tl(lang, '缺', '切', 'Out')}</span>}
        {filling.map((f) => <span key={f.key} className="fill-guest" aria-hidden="true">#{f.guest}</span>)}
        {n > 0 && (
          <span key={n} className="stamp" aria-hidden="true">
            點{n > 1 && <span className="stamp-count">×{n}</span>}
          </span>
        )}
      </button>
    )
  }

  /**
   * One compartment of the stock fridge (the shop's closed: the board is the kitchen's chiller, not a menu): a glass-fronted bin with the food, its
   * frozen packs stacked as high as the stock, what it costs, and the buttons to bring more in: +1, +10, and 補 to top it back up to the usual stock.
   * The bin itself is what's clicked to take one out to try (right-click, or - / Delete, to put it back), as the tags were.
   */
  const bin = (x: { id: string; name: string; ja?: string; en?: string; price: number }, _icon: string) => {
    const n = quantities[x.id] ?? 0
    const name = nameIn(lang, x)
    const cost = unitCost ? unitCost(x.id) : 0
    const have = stock?.[x.id] ?? 0
    const out = have <= 0
    const need = Math.max(0, PAR - have)
    const can = (k: number) => !!onBuy && k > 0 && cash >= cost * k
    const buy = (k: number) => (e: { stopPropagation: () => void; preventDefault: () => void }) => { e.stopPropagation(); e.preventDefault(); if (onBuy && can(k)) onBuy(x.id, k) }
    return (
      <div key={x.id} role="button" tabIndex={0} aria-pressed={n > 0} data-id={x.id}
        className={`chiller-bin${out ? ' is-out' : ''}${n > 0 ? ' is-taken' : ''}${nudge?.id === x.id ? ' is-nudged' : ''}`}
        aria-label={`${name} ${x.en ?? ''}，${tl(lang, '庫存', '在庫', 'Stock')} ${have}${n ? `，${t.ordered(n)}` : ''}`}
        onClick={() => { const fired = press.current?.fired; press.current = null; if (fired || locked) return; if (out) setNudge({ id: x.id, k: Date.now() }); else onAdd(x.id) }}
        onAnimationEnd={(e) => { if (e.animationName === 'bin-nudge') setNudge(null) }}
        onPointerDown={pressStart(x.id)} onPointerMove={pressMove} onPointerUp={pressEnd} onPointerCancel={pressEnd}
        onContextMenu={(e) => { e.preventDefault(); if (!press.current && !locked) onRemove(x.id) }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!locked) onAdd(x.id) } else onKey(x.id)(e) }}>
        <span className="chiller-bin-head">
          <FoodArt id={x.id} store={storageOf(x.id)} band />
          <span className="chiller-bin-name">{name}</span>
          {n > 0 && <span key={n} className="chiller-taken" aria-hidden="true">{tl(lang, '試', '試', 'Try')}×{n}</span>}
        </span>
        {x.en && <span className="chiller-bin-en" lang="en">{x.en}</span>}
        {/* (how well stocked: a bar against the par level, full at PAR and over; red when it's out) */}
        <span className={`chiller-level${out ? ' is-zero' : have < PAR ? ' is-low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (have / PAR) * 100)}%` }} /></span>
        <span className="chiller-bin-info" aria-hidden="true">
          <b className={out ? 'is-zero' : ''}>{tl(lang, '庫存', '在庫', 'Stock')} <em>{have}</em></b>
          <small>{tl(lang, '成本', '原価', 'Cost')} <em>{cost}</em></small>
        </span>
        {/* (how fresh what's in stock is: a leaf and a bar, green fresh, amber going, red tired; nothing to show with none in) */}
        {!out && (() => {
          const f = Math.round(fresh?.[x.id] ?? 100)
          const grade = freshGrade(f)
          return (
            <span className={`chiller-fresh is-${grade}`} aria-hidden="true" title={tl(lang, `鮮度 ${f}%：越不新鮮，做出來越不好吃`, `鮮度 ${f}%：鮮度が落ちると味も落ちる`, `Freshness ${f}%: the staler, the less tasty`)}>
              <svg viewBox="0 0 16 16"><path d="M13.5 2.5C7 2.5 3 5.5 3 10c0 1.3.4 2.4 1 3.2C5 9.5 7.5 7 11 5.5 8 7.5 6 10 5.2 13.6 6 14 7 14 8 14c4 0 5.5-4.5 5.5-11.5z" /></svg>
              <span className="chiller-fresh-bar"><i style={{ width: `${f}%` }} /></span>
              <em>{f}%</em>
            </span>
          )
        })()}
        {onBuy && (
          <span className="chiller-buy">
            <span role="button" tabIndex={-1} className={`chiller-btn${can(1) ? '' : ' is-off'}`} title={tl(lang, '叫 1 份', '1つ仕入れる', 'Order 1')}
              onPointerDown={(e) => e.stopPropagation()} onClick={buy(1)}>+1</span>
            <span role="button" tabIndex={-1} className={`chiller-btn${can(10) ? '' : ' is-off'}`} title={tl(lang, '叫 10 份', '10個仕入れる', 'Order 10')}
              onPointerDown={(e) => e.stopPropagation()} onClick={buy(10)}>+10</span>
            <span role="button" tabIndex={-1} className={`chiller-btn chiller-fill${can(need) ? '' : ' is-off'}`}
              title={need ? tl(lang, `補到 ${PAR} 份（${need} 份，NT$${cost * need}）`, `${PAR}まで補充（${need}）`, `Fill up to ${PAR} (${need}, NT$${cost * need})`) : (tl(lang, '已經夠了', '十分あります', 'Enough already'))}
              onPointerDown={(e) => e.stopPropagation()} onClick={buy(need)}>{tl(lang, '補', '補', '+')}</span>
          </span>
        )}
      </div>
    )
  }

  // side by side (desktop, tablets), the tags are sized and stacked to fill the space they have: as many rows as
  // gives the biggest tags (a short menu of 9 dishes in 3 rows of 3, not 2 rows with a hole and room to spare). Too
  // many to fit even small, they go back to two rows that slide sideways.
  const aside = useRef<HTMLElement>(null)
  const [fit, setFit] = useState<{ font: number; rows: number } | null>(null)
  const tagCount = dish.bases.length + dish.items.length
  const baseCount = dish.bases.length
  const likeTags = layoutLike?.tags ?? 0, likeBases = layoutLike?.bases ?? 0
  useLayoutEffect(() => {
    const menu = aside.current, strips = row.current
    if (!menu || !strips) return
    const wide = window.matchMedia('(min-width: 901px) and (min-height: 521px)')
    const px = (v: string) => parseFloat(v) || 0
    const measure = () => {
      if (!wide.matches) {
        setFit(null)
        return
      }
      const cs = getComputedStyle(menu), ss = getComputedStyle(strips)
      const title = menu.querySelector<HTMLElement>('.menu-title'), tally = menu.querySelector<HTMLElement>('.tally')
      const w = menu.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight) - (title?.offsetWidth ?? 0) - px(cs.columnGap)
        - px(ss.paddingLeft) - px(ss.paddingRight)
      const h = menu.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - (tally?.offsetHeight ?? 0) - px(cs.rowGap)
        - px(ss.paddingTop) - px(ss.paddingBottom)
      const gx = px(ss.columnGap), gy = px(ss.rowGap)
      // (the open menu is sized as the foods' board would be, so its tags are the same size as theirs)
      const sizeTags = likeTags || tagCount, sizeBases = likeTags ? likeBases : baseCount
      let best = { font: 0, rows: 2, empty: Infinity }
      for (let r = 1; r <= 4; r++) {
        // (the sets all go along the top row)
        const cols = Math.max(Math.ceil(sizeTags / r), r > 1 ? sizeBases : 0)
        const font = Math.min(22, (h - (r - 1) * gy) / (r * 15.5), (w - (cols - 1) * gx) / (cols * 2.7))
        const empty = cols * r - sizeTags
        if (font > best.font + 0.5 || (Math.abs(font - best.font) <= 0.5 && empty < best.empty)) best = { font, rows: r, empty }
      }
      if (likeTags) {
        // at that size (the foods' board's own, as it last came out, if it has been up), as few rows of the menu's
        // own tags as fit across
        if (foodsFont) best = { ...best, font: foodsFont.font }
        const font = best.font
        for (let r = 1; r <= 4; r++) {
          const cols = Math.max(Math.ceil(tagCount / r), r > 1 ? baseCount : 0)
          if ((w - (cols - 1) * gx) / (cols * 2.7) >= font - 0.01 && (h - (r - 1) * gy) / (r * 15.5) >= font - 0.01) {
            best = { ...best, rows: r }
            break
          }
        }
      }
      // (never so small they're hard to read: past that, as many rows as fit at a readable size, and the rest scroll
      // sideways)
      if (best.font < MIN_TAG_FONT) {
        for (let r = 4; r >= 1; r--) {
          const font = Math.min(22, (h - (r - 1) * gy) / (r * 15.5))
          if (font >= MIN_TAG_FONT || r === 1) {
            best = { ...best, font: Math.max(best.font, font), rows: r }
            break
          }
        }
      }
      // (and never more rows than go down the space: fewer, scrolling sideways, or smaller ones if even one won't)
      const tall = (r: number) => (h - (r - 1) * gy) / (r * 15.5)
      while (best.rows > 1 && tall(best.rows) < best.font - 0.01) best = { ...best, rows: best.rows - 1 }
      if (tall(best.rows) < best.font) best = { ...best, font: tall(best.rows) }
      // (one row only: what doesn't fit across slides sideways, by drag or wheel)
      best = { ...best, rows: 1, font: Math.min(16, tall(1)) }
      const next = best.font >= 10 ? { font: Math.floor(best.font * 10) / 10, rows: best.rows }
        : { font: Math.max(10, Math.min(16, h / 15.5)), rows: 1 }
      if (research) foodsFont = next
      setFit((cur) => (cur && cur.font === next.font && cur.rows === next.rows ? cur : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(menu)
    wide.addEventListener('change', measure)
    return () => {
      ro.disconnect()
      wide.removeEventListener('change', measure)
    }
  }, [tagCount, baseCount, likeTags, likeBases, research])

  return (
    <aside ref={aside} style={fit ? ({ '--tag-font': `${fit.font}px`, '--tag-rows': fit.rows } as CSSProperties) : undefined}
      className={`menu${research ? ' is-research' : ''}${locked ? ' is-locked' : ''}${layoutLike ? ' menu-two-col' : ''}${research || open ? '' : ' no-title'}`} aria-label={`${nameIn(lang, dish)} ${t.menuTitle}`} lang={tl(lang, 'zh-Hant', 'ja', 'en')}>
      {/* (the board's name only where it's the shop's own: the foods' fridge, or the menu once the shop's open; closed, it's a plain preview) */}
      {(research || open) && <h2 className="menu-title">{research ? t.researchTitle : t.menuTitle}<span className="menu-title-en" lang="en">{research ? 'INGREDIENTS' : 'MENU'}</span></h2>}

      {research && onBuy ? (
        <div className="strips-frame">
          <div className="chiller" role="group" aria-label={tl(lang, '食材櫃', '食材庫', 'Pantry')}>
            {/* (in three: the freezer, the fridge, and the larder at room temperature) */}
            <div className="chiller-scroll">
              {STORAGES.map((st) => {
                const goods = [...dish.bases.filter((b) => !b.includes), ...dish.items].filter((x) => storageOf(x.id) === st.id)
                if (!goods.length) return null
                return (
                  <section key={st.id} className={`chiller-zone is-${st.id}`}>
                    <h3 className="chiller-zone-head"><span>{storageName(st, lang)}</span><i aria-hidden="true">{st.temp}</i></h3>
                    <div className="chiller-bins">{goods.map((x) => bin(x, iconFor(dish.id, { ...x, icon: iconOf(x) }, false)))}</div>
                  </section>
                )
              })}
            </div>
            <div className="chiller-foot" aria-hidden="true" />
          </div>
        </div>
      ) : (
      <div className="strips-frame">
        <div className="strips" ref={row} onWheel={(e) => { if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) row.current.scrollLeft -= e.deltaY }} onPointerDown={onGrab} onPointerMove={onDrag} onPointerUp={onLetGo}
          onPointerLeave={onLetGo}
          onClickCapture={(e) => {
            // the click that ends a drag doesn't order the tag it was released on
            // (a drag that ended by the pointer leaving the row, then a click later on, is a real click)
            if (dragged.current && performance.now() - dragged.current < 250) {
              e.stopPropagation()
              e.preventDefault()
            }
            dragged.current = 0
          }}>
          {/* bases (the dark walnut tags) are ordered the same way as everything else */}
          {dish.bases.map((b) => tag(b, iconFor(dish.id, { ...b, icon: iconOf(b) }, true), true))}
          {dish.items.map((item) => tag(item, iconFor(dish.id, { ...item, icon: iconOf(item) }, false), false))}
        </div>
      </div>
      )}

      {research && onBuy ? (
        // (the test kitchen's foot: what's out on the board to try, a way to put it all back, and the three ways to restock)
        <footer className="tally tally-research">
          <p className="tally-trying">
            {count > 0
              ? (lang === 'ja' ? <>試作中 <strong>{count}</strong> 品</> : lang === 'en' ? <>Trying <strong>{count}</strong></> : <>試做中 <strong>{count}</strong> 份</>)
              : (tl(lang, '點食材拿一份到砧板試做（右鍵放回）', '食材をクリックで一つ取り出して試作（右クリックで戻す）', 'Click an ingredient to put one on the board to try (right-click to put back)'))}
          </p>
          {count > 0 && (
            <button type="button" className="clear" onClick={onClear}>{tl(lang, '全部放回', '全部戻す', 'Put all back')}</button>
          )}
          {onRestock && restockCost && (
            <span className="tally-buy">
              {([['avg', tl(lang, '補到平均', '平均まで補充', 'Up to average'), tl(lang, '低於平均的食材補到平均', '平均より少ないものを平均まで', 'Bring anything below average up to average')],
                ['each', tl(lang, '各補 5', '各 +5', '+5 each'), tl(lang, '每樣多 5 份', 'すべて5つずつ', '5 more of each')],
                ['full', tl(lang, '補滿', '満タン', 'Fill up'), tl(lang, `每樣補到 ${PAR} 份`, `すべて${PAR}まで`, `Everything up to ${PAR}`)]] as [Restock, string, string][]).map(([k, label, title]) => (
                <button key={k} type="button" className={`tally-restock is-${k}`} disabled={!restockCost[k] || cash < restockCost[k]} onClick={() => onRestock(k)} title={title}>
                  {label}{restockCost[k] > 0 && <small className="money">NT${restockCost[k].toLocaleString()}</small>}
                </button>
              ))}
            </span>
          )}
        </footer>
      ) : (
      <footer className="tally">
        {/* the shop's diary: which day it is, and how many have come in */}
        {days && days.day > 0 && (
          <p className="tally-day">
            {lang === 'ja' ? <>営業 <strong>{days.day}</strong> 日目・本日の来客 <strong>{days.today}</strong> 名・累計 <strong>{days.total}</strong> 名</>
              : lang === 'en' ? <>Day <strong>{days.day}</strong> · today <strong>{days.today}</strong> guests · <strong>{days.total}</strong> in all</>
              : <>第 <strong>{days.day}</strong> 天・今日來客 <strong>{days.today}</strong> 位・累計 <strong>{days.total}</strong> 位</>}
          </p>
        )}
        <p>
          {beforeCount}{n1 !== null && <strong>{n1}</strong>}{beforeTotal}{n2 !== null && <strong className="money">{n2}</strong>}{after}
        </p>
        {/* (open, the customers order: there's nothing of yours to take back) */}
        {!locked && (
          <button type="button" className="clear" onClick={onClear} disabled={count === 0}>
            {t.clear}
          </button>
        )}
        <p className="tally-hint">{locked ? t.lockedHint : touchOnly ? t.hintTouch : t.hint}
</p>
      </footer>
      )}
    </aside>
  )
}
