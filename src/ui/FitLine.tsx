import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * A bit of text that never breaks onto a second line (the owner's: nothing in the interface on two lines): it keeps to one, and where its
 * box is too narrow for it, it's set a little smaller, down to `min` px, till it fits (a long name in a narrow card: スポーツドリンク,
 * peanut powder). Laid out again whenever its box changes size.
 */
export function FitLine({ children, className, min = 10 }: { children: ReactNode; className?: string; min?: number }) {
  const el = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const e = el.current
    if (!e) return
    const fit = () => {
      e.style.fontSize = ''
      if (e.scrollWidth <= e.clientWidth + 0.5) return
      const base = parseFloat(getComputedStyle(e).fontSize)
      // (the text's width goes as its size: straight to about the right size, then down a half pixel at a time for the rounding)
      let size = Math.max(min, Math.floor(base * (e.clientWidth / e.scrollWidth) * 2) / 2)
      e.style.fontSize = `${size}px`
      while (e.scrollWidth > e.clientWidth + 0.5 && size > min) { size -= 0.5; e.style.fontSize = `${size}px` }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(e)
    return () => ro.disconnect()
  }, [children, min])
  return <span ref={el} className={`fit-line${className ? ` ${className}` : ''}`}>{children}</span>
}
