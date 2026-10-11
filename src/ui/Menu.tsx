import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent,
  type PointerEvent as ReactPointerEvent } from 'react'
import { nameIn, UI, type Lang } from '@/data/i18n'
import { toChineseNumber, type Dish } from '@/data/menu'
import { hasIcon, Icon } from './Icon'
import { guestLabel } from '@/data/guests'

type MenuProps = {
  dish: Dish
  lang: Lang
  /** portions ordered per item, and per base (soup, bowl, set meal) */
  quantities: Record<string, number>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  /** customers' orders just in: their tags light up with the guest's number, and the order is written out */
  feed?: { key: number; id: string; guest: number }[]
  /** shop open: the customers order, not you (the tags only show what's been ordered) */
  locked?: boolean
  /** portions in stock (a tag with none left is marked 缺) */
  stock?: Record<string, number>
  /** (shop closed) the board is the shop's foods to try out, not a menu: there's no menu until dishes are worked out.
   * Each tag shows what the food costs and how much is in, and it's bought in right there */
  research?: boolean
  unitCost?: (id: string) => number
  onBuy?: (id: string, n: number) => void
  /** buy n of everything on the board */
  onBuyAll?: (n: number) => void
  /** 一鍵補貨: top everything up to 10, and what that costs (0: nothing's short) */
  onTopUp?: () => void
  topUpCost?: number
  cash?: number
}

/**
 * Keep everything on a tag inside the tag: add up how tall its contents run (in tag-ems, matching the CSS:
 * the tag is 15.5em tall with 0.7em padding top and bottom), and shrink the whole tag's type if it would
 * overflow. Long Japanese names (焼きおにぎり) and set names (秋刀魚定食) come out smaller instead of spilling.
 */
function tagFit(name: string, en: string | undefined, price: string, stamp: boolean, stocked = false): CSSProperties | undefined {
  const parts = [
    1.4,                                  // icon (or the 選 stamp in its place)
    name.length * 1.3 * 1.12,             // name: 1.3em glyphs + 0.12em letter-spacing
    en ? en.length * 0.56 * 0.6 : 0,      // English, set sideways: ~0.6em per Latin letter at 0.56em
    price.length * 0.82 * 1.12,           // price in kanji numerals
    stamp ? 2 : 0,                        // the 點 / 含 stamp
    stocked ? 5.4 : 0,                    // the test board's cost, stock and +10, in a column at the foot
  ].filter((h) => h > 0)
  const total = parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * 0.35
  const room = 15.5 - 1.4
  return total > room ? ({ '--fit': (room / total).toFixed(3) } as CSSProperties) : undefined
}

/**
 * Izakaya-style wall menu: vertical wooden tags, a red stamp marks what's been ordered.
 * Click a tag to add a portion, right-click (or press - / Delete on it) to take one away.
 */
/** (a dish on the menu is drawn with the icon of the food it's made from) */
const iconOf = (x: object) => (x as { icon?: string }).icon

const CAT_NAMES: Record<string, Record<Lang, string>> = {
  noodleSoup: { zh: '湯麵類', ja: '汁そば' }, extra: { zh: '加點', ja: 'トッピング' }, quick: { zh: '快餐', ja: '定食' },
  friedRice: { zh: '炒飯類', ja: '炒飯' }, friedNoodles: { zh: '炒麵類', ja: '焼きそば' }, vermicelli: { zh: '炒米粉類', ja: '焼きビーフン' },
  saucyRice: { zh: '燴飯類', ja: 'あんかけご飯' }, dumplings: { zh: '水餃類', ja: '水餃子' }, soupDumplings: { zh: '湯餃類', ja: 'スープ餃子' },
  xiaolongbao: { zh: '點心', ja: '点心' }, soup: { zh: '湯類', ja: 'スープ' },
}

export function Menu({ dish, lang, quantities, onAdd, onRemove, onClear, feed = [], locked = false, stock, research = false, unitCost, onBuy, onBuyAll, onTopUp, topUpCost = 0,
  cash = Infinity }: MenuProps) {
  const t = UI[lang]
  const ordered = dish.bases.filter((b) => (quantities[b.id] ?? 0) > 0)
  const count = [...dish.bases, ...dish.items].reduce((n, x) => n + (quantities[x.id] ?? 0), 0)
  const total = [...dish.bases, ...dish.items].reduce((sum, x) => sum + x.price * (quantities[x.id] ?? 0), 0)
  // what a set brings along shows only while you point at that set: its foods' tags darken and get a 含 stamp
  const [peek, setPeek] = useState<string | null>(null)
  const peeked = dish.bases.find((b) => b.id === peek)
  const included = new Set(Object.keys(peeked?.includes ?? {}))

  // when the tags don't fit across (phones, short windows), page through them with ‹ › instead of a scrollbar.
  // The row is right-to-left, so in Chrome/Firefox scrollLeft runs from 0 (rightmost) to negative.
  const row = useRef<HTMLDivElement>(null)
  const [ends, setEnds] = useState({ overflow: false, atLeft: true, atRight: true })
  useEffect(() => {
    const el = row.current
    if (!el) return
    const update = () => {
      // only rows that actually scroll sideways (the narrow layouts) get paging buttons
      const scrolls = getComputedStyle(el).overflowX !== 'visible'
      const max = el.scrollWidth - el.clientWidth
      const pos = Math.abs(el.scrollLeft)
      setEnds({ overflow: scrolls && max > 2, atRight: pos < 2, atLeft: pos > max - 2 })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])
  const page = (dir: -1 | 1) => {
    const el = row.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

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
  // the 台式小吃 menu: things grouped under 湯麵類, 快餐, 炒飯類… as on a Taiwanese menu board
  const taiwan = dish.items.some((x) => x.table)
  const groups = useMemo(() => {
    if (!taiwan) return []
    const order = ['noodleSoup', 'extra', 'quick', 'friedRice', 'friedNoodles', 'vermicelli', 'saucyRice', 'dumplings',
      'soupDumplings', 'xiaolongbao', 'soup']
    const out = new Map<string, { x: (typeof all)[number]; base: boolean }[]>()
    for (const b of dish.bases) out.set('noodleSoup', [...(out.get('noodleSoup') ?? []), { x: b, base: true }])
    for (const it of dish.items) {
      const cat = it.table ?? 'extra'
      out.set(cat, [...(out.get(cat) ?? []), { x: it, base: false }])
    }
    return order.filter((c) => out.has(c)).map((cat) => ({ cat, list: out.get(cat)! }))
  }, [dish, taiwan])

  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (locked) return
    if (e.key === '-' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(id)
    }
  }

  const baseName = ordered.length ? ordered.map((b) => nameIn(lang, b)).join('、') : t.nothingYet
  const [beforeCount, n1, beforeTotal, n2, after] = t.tally(baseName, count, total)

  /** one wooden tag: click to order a portion, right-click (or - / Delete) to take one off */
  const tag = (x: { id: string; name: string; ja?: string; en?: string; price: number }, icon: string, base: boolean) => {
    const n = quantities[x.id] ?? 0
    const incl = !base && included.has(x.id)
    const name = nameIn(lang, x)
    // (a Taiwanese menu prints its prices in plain figures, in red; the test kitchen's board shows what it costs)
    const cost = research && unitCost ? unitCost(x.id) : 0
    const price = research ? `${cost}` : taiwan ? String(x.price) : toChineseNumber(x.price)
    const hasSet = base && !!(x as { includes?: object }).includes
    const filling = feed.filter((f) => f.id === x.id)
    const parts = (x as { includes?: Record<string, number> }).includes ?? { [x.id]: 1 }
    const out = !!stock && Object.entries(parts).some(([k, q]) => (stock[k] ?? 0) < q)
    return (
      <button key={x.id} type="button" aria-pressed={n > 0} data-id={x.id}
        className={`strip${research ? ' is-research' : ''}${base ? ' strip-base' : ''}${incl ? ' is-included' : ''}${filling.length ? ' is-filling' : ''}${out ? ' is-out' : ''}`}
        aria-label={`${name} ${x.en ?? ''}，${x.price}${n ? `，${t.ordered(n)}` : ''}`}
        style={tagFit(name, x.en, research ? '' : price, n > 0, research && !!onBuy)}
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
            <small>{lang === 'ja' ? '原価' : '成本'}<em>{cost}</em></small>
            <b>{lang === 'ja' ? '在庫' : '庫存'}<em>{stock?.[x.id] ?? 0}</em></b>
            <span role="button" tabIndex={-1} className={`strip-buy${cash < cost * 10 ? ' is-off' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (cash >= cost * 10) onBuy(x.id, 10) }}>+10</span>
          </span>
        )}
        {incl && <span className="stamp stamp-incl" aria-hidden="true">{t.included}</span>}
        {/* (on the test board the stock line already shows it, in red) */}
        {out && !research && <span className="out-tag" aria-hidden="true">{lang === 'ja' ? '切' : '缺'}</span>}
        {filling.map((f) => <span key={f.key} className="fill-guest" aria-hidden="true">#{f.guest}</span>)}
        {n > 0 && (
          <span key={n} className="stamp" aria-hidden="true">
            點{n > 1 && <span className="stamp-count">×{n}</span>}
          </span>
        )}
      </button>
    )
  }

  // side by side (desktop, tablets), the tags are sized and stacked to fill the space they have: as many rows as
  // gives the biggest tags (a short menu of 9 dishes in 3 rows of 3, not 2 rows with a hole and room to spare). Too
  // many to fit even small, they go back to two rows that slide sideways.
  const aside = useRef<HTMLElement>(null)
  const [fit, setFit] = useState<{ font: number; rows: number } | null>(null)
  const tagCount = dish.bases.length + dish.items.length
  const baseCount = dish.bases.length
  useLayoutEffect(() => {
    const menu = aside.current, strips = row.current
    if (!menu || !strips || taiwan) return
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
      let best = { font: 0, rows: 2, empty: Infinity }
      for (let r = 1; r <= 4; r++) {
        // (the sets all go along the top row)
        const cols = Math.max(Math.ceil(tagCount / r), r > 1 ? baseCount : 0)
        const font = Math.min(22, (h - (r - 1) * gy) / (r * 15.5), (w - (cols - 1) * gx) / (cols * 2.7))
        const empty = cols * r - tagCount
        if (font > best.font + 0.5 || (Math.abs(font - best.font) <= 0.5 && empty < best.empty)) best = { font, rows: r, empty }
      }
      const next = best.font >= 10 ? { font: Math.floor(best.font * 10) / 10, rows: best.rows }
        : { font: Math.max(10, Math.min(16, (h - gy) / 31)), rows: 2 }
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
  }, [tagCount, baseCount, taiwan])

  return (
    <aside ref={aside} style={fit ? ({ '--tag-font': `${fit.font}px`, '--tag-rows': fit.rows } as CSSProperties) : undefined}
      className={`menu${locked ? ' is-locked' : ''}${taiwan ? ' menu-taiwan' : ''}`} aria-label={`${nameIn(lang, dish)} ${t.menuTitle}`} lang={lang === 'ja' ? 'ja' : 'zh-Hant'}>
      <h2 className="menu-title">{research ? t.researchTitle : t.menuTitle}<span className="menu-title-en" lang="en">{research ? 'TEST KITCHEN' : 'MENU'}</span></h2>

      <div className={`strips-frame${ends.overflow ? ' is-paged' : ''}`}>
        {ends.overflow && (
          <>
            <button type="button" className="strips-page strips-page-left" aria-label="‹"
              disabled={ends.atLeft} onClick={() => page(-1)}>
              <svg viewBox="0 0 22 44" aria-hidden="true"><path d="M17 3C12 11 7 17 3 22c4 5 9 11 14 19-3-8-6-14-8-19 2-5 5-11 8-19z" fill="currentColor" /><circle cx="19" cy="22" r="2.2" fill="#d9503c" /></svg>
            </button>
            <button type="button" className="strips-page strips-page-right" aria-label="›"
              disabled={ends.atRight} onClick={() => page(1)}>
              <svg viewBox="0 0 22 44" aria-hidden="true"><path d="M5 3c5 8 10 14 14 19-4 5-9 11-14 19 3-8 6-14 8-19-2-5-5-11-8-19z" fill="currentColor" /><circle cx="3" cy="22" r="2.2" fill="#d9503c" /></svg>
            </button>
          </>
        )}
        <div className="strips" ref={row} onPointerDown={onGrab} onPointerMove={onDrag} onPointerUp={onLetGo}
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
          {taiwan ? (
            // grouped the way a Taiwanese 小吃 menu board is, each group under its magenta header
            groups.map((grp) => [
              <div key={`cat-${grp.cat}`} className="strip-cat" aria-hidden="true"><b>{CAT_NAMES[grp.cat][lang]}</b></div>,
              ...grp.list.map(({ x, base }) => tag(x, iconOf(x) ?? (base ? dish.id : x.id), base)),
            ])
          ) : (
            <>
              {dish.bases.map((b) => tag(b, iconOf(b) ?? (hasIcon(`set-${b.id}`) ? `set-${b.id}` : dish.id), true))}
              {dish.items.map((item) => tag(item, iconOf(item) ?? item.id, false))}
            </>
          )}
        </div>
      </div>

      <footer className="tally">
        {/* the order slip: what came in, written out stroke by stroke */}
        {feed.length > 0 && (
          <ul className="order-slip" aria-live="polite">
            {feed.map((f) => {
              const it = all.find((x) => x.id === f.id)
              return <li key={f.key}><span>✎</span><em>{t.wrote(guestLabel(f.guest, lang), it ? nameIn(lang, it) : f.id)}</em></li>
            })}
          </ul>
        )}
        <p>
          {beforeCount}<strong>{n1}</strong>{beforeTotal}<strong className="money">{n2}</strong>{after}
        </p>
        <button type="button" className="clear" onClick={onClear} disabled={count === 0 || locked}>
          {t.clear}
        </button>
        <p className="tally-hint">{locked ? t.lockedHint : touchOnly ? t.hintTouch : t.hint}
          {research && onBuyAll && unitCost && (() => {
            // (stock everything on the board at once)
            const all = [...dish.bases.filter((b) => !b.includes), ...dish.items].reduce((n, x) => n + unitCost(x.id) * 10, 0)
            return (
              <span className="tally-buy">
                {onTopUp && (
                  <button type="button" className="tally-topup" disabled={!topUpCost || cash < topUpCost} onClick={onTopUp}
                    title={lang === 'ja' ? '足りない分を各10まで補充' : '不足的食材全部補到各 10 份'}>
                    {topUpCost ? (lang === 'ja' ? '一括補充' : '一鍵補貨') : (lang === 'ja' ? '在庫十分' : '庫存都滿了')}
                    {topUpCost > 0 && <small className="money">NT${topUpCost.toLocaleString()}</small>}
                  </button>
                )}
                <button type="button" className="tally-buyall" disabled={cash < all} onClick={() => onBuyAll(10)}>
                  {lang === 'ja' ? '全部 +10' : '全部各 +10'} <small className="money">NT${all.toLocaleString()}</small>
                </button>
              </span>
            )
          })()}</p>
      </footer>
    </aside>
  )
}
