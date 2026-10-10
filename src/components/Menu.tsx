import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent,
  type PointerEvent as ReactPointerEvent } from 'react'
import { nameIn, UI, type Lang } from '../i18n'
import { toChineseNumber, type Dish } from '../menu'
import { hasIcon, Icon } from './Icon'
import { guestLabel } from '../guests'

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
  /** (shop closed) the board is the shop's foods to try out, not a menu: there's no menu until dishes are worked out */
  research?: boolean
}

/**
 * Keep everything on a tag inside the tag: add up how tall its contents run (in tag-ems, matching the CSS:
 * the tag is 15.5em tall with 0.7em padding top and bottom), and shrink the whole tag's type if it would
 * overflow. Long Japanese names (焼きおにぎり) and set names (秋刀魚定食) come out smaller instead of spilling.
 */
function tagFit(name: string, en: string | undefined, price: string, stamp: boolean): CSSProperties | undefined {
  const parts = [
    1.4,                                  // icon (or the 選 stamp in its place)
    name.length * 1.3 * 1.12,             // name: 1.3em glyphs + 0.12em letter-spacing
    en ? en.length * 0.56 * 0.6 : 0,      // English, set sideways: ~0.6em per Latin letter at 0.56em
    price.length * 0.82 * 1.12,           // price in kanji numerals
    stamp ? 2 : 0,                        // the 點 / 含 stamp
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

export function Menu({ dish, lang, quantities, onAdd, onRemove, onClear, feed = [], locked = false, stock, research = false }: MenuProps) {
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
  const dragged = useRef(false)
  const onGrab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === 'touch' || !row.current) return
    grab.current = { x: e.clientX, left: row.current.scrollLeft, moved: false }
    dragged.current = false
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
    if (grab.current?.moved) dragged.current = true
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
    // (a Taiwanese menu prints its prices in plain figures, in red)
    const price = taiwan ? String(x.price) : toChineseNumber(x.price)
    const hasSet = base && !!(x as { includes?: object }).includes
    const filling = feed.filter((f) => f.id === x.id)
    const parts = (x as { includes?: Record<string, number> }).includes ?? { [x.id]: 1 }
    const out = !!stock && Object.entries(parts).some(([k, q]) => (stock[k] ?? 0) < q)
    return (
      <button key={x.id} type="button" aria-pressed={n > 0} data-id={x.id}
        className={`strip${base ? ' strip-base' : ''}${incl ? ' is-included' : ''}${filling.length ? ' is-filling' : ''}${out ? ' is-out' : ''}`}
        aria-label={`${name} ${x.en ?? ''}，${x.price}${n ? `，${t.ordered(n)}` : ''}`}
        style={tagFit(name, x.en, price, n > 0)}
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
        onPointerEnter={hasSet ? () => setPeek(x.id) : undefined}
        onPointerLeave={hasSet ? () => setPeek(null) : undefined}
        onFocus={hasSet ? () => setPeek(x.id) : undefined}
        onBlur={hasSet ? () => setPeek(null) : undefined}>
        <Icon name={icon} />
        <span className="strip-name">{name}</span>
        {x.en && <span className="strip-en" lang="en">{x.en}</span>}
        <span className="strip-price">{price}</span>
        {incl && <span className="stamp stamp-incl" aria-hidden="true">{t.included}</span>}
        {out && <span className="out-tag" aria-hidden="true">{lang === 'ja' ? '切' : '缺'}</span>}
        {filling.map((f) => <span key={f.key} className="fill-guest" aria-hidden="true">#{f.guest}</span>)}
        {n > 0 && (
          <span key={n} className="stamp" aria-hidden="true">
            點{n > 1 && <span className="stamp-count">×{n}</span>}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className={`menu${locked ? ' is-locked' : ''}${taiwan ? ' menu-taiwan' : ''}`} aria-label={`${nameIn(lang, dish)} ${t.menuTitle}`} lang={lang === 'ja' ? 'ja' : 'zh-Hant'}>
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
            if (dragged.current) {
              e.stopPropagation()
              e.preventDefault()
              dragged.current = false
            }
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
          {beforeCount}<strong>{n1}</strong>{beforeTotal}<strong>{n2}</strong>{after}
        </p>
        <button type="button" className="clear" onClick={onClear} disabled={count === 0 || locked}>
          {t.clear}
        </button>
        <p className="tally-hint">{locked ? t.lockedHint : touchOnly ? t.hintTouch : t.hint}</p>
      </footer>
    </aside>
  )
}
