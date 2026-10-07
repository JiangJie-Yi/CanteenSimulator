import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent,
  type PointerEvent as ReactPointerEvent } from 'react'
import { nameIn, UI, type Lang } from '../i18n'
import { toChineseNumber, type Dish } from '../menu'
import { Icon } from './Icon'

type MenuProps = {
  dish: Dish
  lang: Lang
  /** portions ordered per item, and per base (soup, bowl, set meal) */
  quantities: Record<string, number>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
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
export function Menu({ dish, lang, quantities, onAdd, onRemove, onClear }: MenuProps) {
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

  const onKey = (id: string) => (e: KeyboardEvent) => {
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
    const price = toChineseNumber(x.price)
    const hasSet = base && !!(x as { includes?: object }).includes
    return (
      <button key={x.id} type="button" aria-pressed={n > 0}
        className={`strip${base ? ' strip-base' : ''}${incl ? ' is-included' : ''}`}
        aria-label={`${name} ${x.en ?? ''}，${x.price}${n ? `，${t.ordered(n)}` : ''}`}
        style={tagFit(name, x.en, price, n > 0)}
        onClick={() => onAdd(x.id)}
        onContextMenu={(e) => { e.preventDefault(); onRemove(x.id) }}
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
        {n > 0 && (
          <span key={n} className="stamp" aria-hidden="true">
            點{n > 1 && <span className="stamp-count">×{n}</span>}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="menu" aria-label={`${nameIn(lang, dish)} ${t.menuTitle}`} lang={lang === 'ja' ? 'ja' : 'zh-Hant'}>
      <h2 className="menu-title">{t.menuTitle}<span className="menu-title-en" lang="en">MENU</span></h2>

      <div className={`strips-frame${ends.overflow ? ' is-paged' : ''}`}>
        {ends.overflow && (
          <>
            <button type="button" className="strips-page strips-page-left" aria-label="‹"
              disabled={ends.atLeft} onClick={() => page(-1)}>
              <svg viewBox="0 0 16 26" aria-hidden="true"><path d="M12 3 4 13l8 10" /></svg>
            </button>
            <button type="button" className="strips-page strips-page-right" aria-label="›"
              disabled={ends.atRight} onClick={() => page(1)}>
              <svg viewBox="0 0 16 26" aria-hidden="true"><path d="m4 3 8 10-8 10" /></svg>
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
          {dish.bases.map((b) => tag(b, dish.id, true))}
          {dish.items.map((item) => tag(item, item.id, false))}
        </div>
      </div>

      <footer className="tally">
        <p>
          {beforeCount}<strong>{n1}</strong>{beforeTotal}<strong>{n2}</strong>{after}
        </p>
        <button type="button" className="clear" onClick={onClear} disabled={count === 0}>
          {t.clear}
        </button>
        <p className="tally-hint">{t.hint}</p>
      </footer>
    </aside>
  )
}
