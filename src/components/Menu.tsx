import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { nameIn, UI, type Lang } from '../i18n'
import { toChineseNumber, type Dish } from '../menu'
import { Icon } from './Icon'

type MenuProps = {
  dish: Dish
  baseId: string
  lang: Lang
  /** portions ordered per item */
  quantities: Record<string, number>
  onBase: (id: string) => void
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
export function Menu({ dish, baseId, lang, quantities, onBase, onAdd, onRemove, onClear }: MenuProps) {
  const t = UI[lang]
  const base = dish.bases.find((b) => b.id === baseId) ?? dish.bases[0]
  const count = dish.items.reduce((n, item) => n + (quantities[item.id] ?? 0), 0)
  const total = base.price + dish.items.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 0), 0)
  const choosable = dish.bases.length > 1

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

  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === '-' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(id)
    }
  }

  const baseName = nameIn(lang, base)
  const [beforeCount, n1, beforeTotal, n2, after] = t.tally(baseName, count, total)

  return (
    <aside className="menu" aria-label={`${nameIn(lang, dish)} ${t.menuTitle}`} lang={lang === 'ja' ? 'ja' : 'zh-Hant'}>
      <h2 className="menu-title">{t.menuTitle}<span className="menu-title-en" lang="en">MENU</span></h2>

      <div className={`strips-frame${ends.overflow ? ' is-paged' : ''}`}>
        {ends.overflow && (
          <>
            <button type="button" className="strips-page strips-page-left" aria-label="‹"
              disabled={ends.atLeft} onClick={() => page(-1)}>‹</button>
            <button type="button" className="strips-page strips-page-right" aria-label="›"
              disabled={ends.atRight} onClick={() => page(1)}>›</button>
          </>
        )}
        <div className="strips" ref={row}>
          {choosable ? (
            // pick one base (soup or set meal); the dark strips act as a radio group
            <div className="base-group" role="radiogroup" aria-label={t.menuTitle}>
              {dish.bases.map((b) => {
                const on = b.id === base.id
                const name = nameIn(lang, b)
                const price = toChineseNumber(b.price)
                return (
                  <button key={b.id} type="button" role="radio" aria-checked={on}
                    aria-label={`${name} ${b.en ?? ''}，${b.price}`} className="strip strip-base"
                    style={tagFit(name, b.en, price, false)} onClick={() => onBase(b.id)}>
                    {/* the chosen base swaps its icon for a 選 stamp of the same size, so nothing shifts or overhangs */}
                    {on ? <span className="stamp stamp-base" aria-hidden="true">選</span> : <Icon name={dish.id} />}
                    <span className="strip-name">{name}</span>
                    {b.en && <span className="strip-en" lang="en">{b.en}</span>}
                    <span className="strip-price">{price}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="strip strip-base strip-fixed"
              style={tagFit(baseName, base.en, toChineseNumber(base.price), false)}>
              <Icon name={dish.id} />
              <span className="strip-name">{baseName}</span>
              {base.en && <span className="strip-en" lang="en">{base.en}</span>}
              <span className="strip-price">{toChineseNumber(base.price)}</span>
            </div>
          )}
          {dish.items.map((item) => {
            const n = quantities[item.id] ?? 0
            const included = n === 0 && !!base.includes?.[item.id]
            const name = nameIn(lang, item)
            const price = toChineseNumber(item.price)
            return (
              <button key={item.id} type="button" className="strip" aria-pressed={n > 0}
                aria-label={`${name} ${item.en ?? ''}，${item.price}${n ? `，${t.ordered(n)}` : ''}`}
                style={tagFit(name, item.en, price, n > 0 || included)}
                onClick={() => onAdd(item.id)}
                onContextMenu={(e) => { e.preventDefault(); onRemove(item.id) }}
                onKeyDown={onKey(item.id)}>
                <Icon name={item.id} />
                <span className="strip-name">{name}</span>
                {item.en && <span className="strip-en" lang="en">{item.en}</span>}
                <span className="strip-price">{price}</span>
                {included && <span className="stamp stamp-incl" aria-hidden="true">{t.included}</span>}
                {n > 0 && (
                  <span key={n} className="stamp" aria-hidden="true">
                    點{n > 1 && <span className="stamp-count">×{n}</span>}
                  </span>
                )}
              </button>
            )
          })}
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
