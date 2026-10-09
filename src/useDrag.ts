import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Lets a little window be dragged about by any part of it that isn't a button: returns the props to spread on it.
 * Where it was left is remembered (per key) for next time; a double click puts it back.
 */
export function useDrag(key: string) {
  const store = `canteen-pos-${key}`
  const [at, setAt] = useState<{ x: number; y: number }>(() => {
    try {
      void store
      return { x: 0, y: 0 }       // (not remembered between visits)
    } catch {
      return { x: 0, y: 0 }
    }
  })
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const save = (p: { x: number; y: number }) => {
    try {
      void p
    } catch {
      // storage blocked
    }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button, input, a')) return
    start.current = { px: e.clientX, py: e.clientY, x: at.x, y: at.y }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    el.classList.add('is-dragging')
    const move = (ev: PointerEvent) => {
      const s = start.current
      if (!s) return
      // kept on screen
      const x = Math.max(-window.innerWidth + 80, Math.min(window.innerWidth - 80, s.x + ev.clientX - s.px))
      const y = Math.max(-40, Math.min(window.innerHeight - 60, s.y + ev.clientY - s.py))
      setAt({ x, y })
    }
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.classList.remove('is-dragging')
      const s = start.current
      start.current = null
      if (s) save({ x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py })
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
  const onDoubleClick = () => {
    setAt({ x: 0, y: 0 })
    save({ x: 0, y: 0 })
  }
  // (the separate translate property, so it adds to whatever transform the window already has)
  const move: CSSProperties = { translate: `${at.x}px ${at.y}px` }
  const style: CSSProperties = { ...move, touchAction: 'none' }
  // spread on the whole (small) window: drag it by any bare part
  // or, for a window whose body scrolls, put move on the window and handle on its title bar
  return { style, onPointerDown, onDoubleClick, move, handle: { onPointerDown, onDoubleClick, style: { touchAction: 'none', cursor: 'grab' } as CSSProperties } }
}
