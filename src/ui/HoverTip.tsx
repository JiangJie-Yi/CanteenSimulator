import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { TIP_AIM, useTip } from '@/scene/hoverTip'

/** how tall on screen a thing may be (px) for its tag to stand over its top; anything bigger, the tag stays by the pointer */
const ANCHOR_MAX = 220
/** the gap between a thing's top and its tag, and the room kept from the window's edges (px) */
const GAP = 12, EDGE = 8
/** how long a tag takes fading out once the pointer's left its thing (ms) */
const FADE_MS = 110

/**
 * The tag over whatever the pointer is on (see scene/hoverTip): the same paper tag as the charcoal's. Over a small thing (a bottle, a
 * switch, a cup) it stands just above that thing's top, kept inside the window (the owner's: by the pointer, among the fridge's bottles it lay
 * over the next ones); over a big one (a wall, the counter) it follows the pointer as before. It fades in.
 */
export function HoverTip({ hidden = false }: { hidden?: boolean }) {
  const live = useTip()
  // (the last tag kept a moment once the pointer's left it, fading out, not snapped away)
  const [tip, setShown] = useState(live)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (live) { setShown(live); setLeaving(false); return }
    setLeaving(true)
    const t = window.setTimeout(() => { setShown(null); setLeaving(false) }, FADE_MS)
    return () => window.clearTimeout(t)
  }, [live])
  const el = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  // (where its thing's top is, in the world, once per tag; null: by the pointer)
  const top = useRef<THREE.Vector3 | null>(null)
  const place = () => {
    const n = el.current
    if (!n) return
    const { camera, canvas } = TIP_AIM
    if (top.current && camera && canvas) {
      const r = canvas.getBoundingClientRect()
      const v = top.current.clone().project(camera)
      const tag = n.firstElementChild as HTMLElement | null
      const w = tag?.offsetWidth ?? 0, h = tag?.offsetHeight ?? 0
      const x = Math.min(window.innerWidth - EDGE - w / 2, Math.max(EDGE + w / 2, r.left + ((v.x + 1) / 2) * r.width))
      // (over its top; with no room above it, under the pointer's other side, below it)
      let y = r.top + ((1 - v.y) / 2) * r.height - GAP - h
      if (y < EDGE) y = pointer.current.y + GAP * 2
      n.classList.add('is-anchored')
      n.style.transform = `translate(${x - w / 2}px, ${y}px)`
    } else {
      n.classList.remove('is-anchored')
      n.style.transform = `translate(${pointer.current.x}px, ${pointer.current.y}px)`
    }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
      if (!top.current) place()
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  // (a new tag: what it's over measured once; small enough on screen, its tag over its top, followed as the camera moves)
  useLayoutEffect(() => {
    top.current = null
    const { obj, camera, canvas } = TIP_AIM
    if (tip && obj && camera && canvas) {
      const box = new THREE.Box3().setFromObject(obj)
      if (!box.isEmpty()) {
        const r = canvas.getBoundingClientRect()
        const hi = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2)
        const lo = hi.clone().setY(box.min.y)
        const a = hi.clone().project(camera), b = lo.clone().project(camera)
        const tall = (Math.abs(a.y - b.y) / 2) * r.height
        const wide = ((box.max.x - box.min.x) + (box.max.z - box.min.z)) > 0 ? Math.abs(new THREE.Vector3(box.max.x, hi.y, box.max.z).project(camera).x - new THREE.Vector3(box.min.x, hi.y, box.min.z).project(camera).x) / 2 * r.width : 0
        if (a.z < 1 && tall < ANCHOR_MAX && wide < ANCHOR_MAX * 1.5) top.current = hi
      }
    }
    place()
    if (!top.current) return
    let raf = 0
    const tick = () => { place(); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tip])
  if (!tip || hidden) return null
  return (
    <div ref={el} className={`hover-tip${leaving ? ' is-leaving' : ''}`} aria-hidden="true">
      {/* (the name on one line; what it says under it, and after a ｜ what to do, on a line of its own, smaller and fainter (the owner's: a
          long line ran out past the tag's edges)) */}
      <span className={`tool-tag${tip.warn ? ' is-warn' : ''}${tip.who ? ' is-who' : ''}`}>
        <b className="tip-title">{tip.title}</b>
        {tip.hint.split('｜').map((line, i) => line && <small key={i} className={i ? 'tip-act' : undefined}>{line}</small>)}
      </span>
    </div>
  )
}
