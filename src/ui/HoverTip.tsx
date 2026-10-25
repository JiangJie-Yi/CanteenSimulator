import { useEffect, useRef } from 'react'
import { useTip } from '@/scene/hoverTip'

/** the tag over whatever the pointer is on (see scene/hoverTip): the same paper tag as the charcoal's, following the pointer */
export function HoverTip({ hidden = false }: { hidden?: boolean }) {
  const tip = useTip()
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const n = el.current
      if (n) n.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  if (!tip || hidden) return null
  return (
    <div ref={el} className="hover-tip" aria-hidden="true">
      <span className="tool-tag">{tip.title}<small>{tip.hint}</small></span>
    </div>
  )
}
