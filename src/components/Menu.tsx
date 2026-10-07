import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { toChineseNumber, type Dish } from '../menu'
import { Icon } from './Icon'

type MenuProps = {
  dish: Dish
  baseId: string
  /** portions ordered per item */
  quantities: Record<string, number>
  onBase: (id: string) => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
}

/** Long names (鹽烤香魚套餐) get a smaller size so they fit the tag in one line instead of wrapping. */
const nameFit = (name: string): CSSProperties | undefined =>
  name.length > 4 ? { fontSize: `calc(1em * ${4.6 / name.length})` } : undefined

/**
 * Izakaya-style wall menu: vertical wooden tags, a red stamp marks what's been ordered.
 * Click a tag to add a portion, right-click (or press - / Delete on it) to take one away.
 */
export function Menu({ dish, baseId, quantities, onBase, onAdd, onRemove, onClear }: MenuProps) {
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

  return (
    <aside className="menu" aria-label={`${dish.name}菜單`}>
      <h2 className="menu-title">點菜</h2>

      <div className={`strips-frame${ends.overflow ? ' is-paged' : ''}`}>
      {ends.overflow && (
        <>
          <button type="button" className="strips-page strips-page-left" aria-label="往左看更多菜色"
            disabled={ends.atLeft} onClick={() => page(-1)}>‹</button>
          <button type="button" className="strips-page strips-page-right" aria-label="往右看更多菜色"
            disabled={ends.atRight} onClick={() => page(1)}>›</button>
        </>
      )}
      <div className="strips" ref={row}>
        {choosable ? (
          // pick one soup base; the dark strips act as a radio group
          <div className="base-group" role="radiogroup" aria-label="湯底">
            {dish.bases.map((b) => {
              const on = b.id === base.id
              return (
                <button key={b.id} type="button" role="radio" aria-checked={on}
                  aria-label={`${b.name}，${b.price} 元`} className="strip strip-base" onClick={() => onBase(b.id)}>
                  {/* the chosen base swaps its icon for a 選 stamp of the same size, so nothing shifts or overhangs */}
                  {on ? <span className="stamp stamp-base" aria-hidden="true">選</span> : <Icon name={dish.id} />}
                  <span className="strip-name"><span style={nameFit(b.name)}>{b.name}</span></span>
                  <span className="strip-price">{toChineseNumber(b.price)}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="strip strip-base strip-fixed">
            <Icon name={dish.id} />
            <span className="strip-name"><span style={nameFit(base.name)}>{base.name}</span></span>
            <span className="strip-price">{toChineseNumber(base.price)}</span>
          </div>
        )}
        {dish.items.map((item) => {
          const n = quantities[item.id] ?? 0
          return (
            <button key={item.id} type="button" className="strip" aria-pressed={n > 0}
              aria-label={`${item.name}，${item.price} 元${n ? `，已點 ${n} 份` : ''}`}
              onClick={() => onAdd(item.id)}
              onContextMenu={(e) => { e.preventDefault(); onRemove(item.id) }}
              onKeyDown={onKey(item.id)}>
              <Icon name={item.id} />
              <span className="strip-name"><span style={nameFit(item.name)}>{item.name}</span></span>
              <span className="strip-price">{toChineseNumber(item.price)}</span>
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
          {base.name}，加點 <strong>{count}</strong> 份，合計 <strong>{total}</strong> 元
        </p>
        <button type="button" className="clear" onClick={onClear} disabled={count === 0}>
          全部取消
        </button>
        <p className="tally-hint">點一下加一份，右鍵減一份</p>
      </footer>
    </aside>
  )
}
