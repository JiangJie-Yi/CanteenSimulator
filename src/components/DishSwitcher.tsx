import { nameIn, type Lang } from '../i18n'
import type { Dish } from '../menu'

type DishSwitcherProps = {
  dishes: Dish[]
  index: number
  onChange: (index: number) => void
  lang: Lang
}

/** Carousel controls under the 3D stage: previous / next, the dish name, and one dot per dish. */
export function DishSwitcher({ dishes, index, onChange, lang }: DishSwitcherProps) {
  const n = dishes.length
  const prev = (index - 1 + n) % n
  const next = (index + 1) % n

  return (
    <nav className="switcher" aria-label="切換料理">
      <button type="button" className="switcher-arrow" onClick={() => onChange(prev)}
        aria-label={`上一道：${nameIn(lang, dishes[prev])}`}>
        ‹
      </button>
      <div className="switcher-center">
        <h2 className="dish-name" aria-live="polite">{nameIn(lang, dishes[index])}</h2>
        <div className="dots">
          {dishes.map((d, i) => (
            <button key={d.id} type="button" className="dot" aria-label={nameIn(lang, d)}
              aria-current={i === index ? 'true' : undefined} onClick={() => onChange(i)} />
          ))}
        </div>
      </div>
      <button type="button" className="switcher-arrow" onClick={() => onChange(next)}
        aria-label={`下一道：${nameIn(lang, dishes[next])}`}>
        ›
      </button>
    </nav>
  )
}
