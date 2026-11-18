// The little name tag that follows the pointer over anything in the room that can be used: what it is, and what pointing and clicking
// (or dragging) it does. Whoever's under the pointer sets it; HoverTip (ui) draws it.
import { useSyncExternalStore } from 'react'
import type * as THREE from 'three'
import { HOVER } from './hoverGlow'

/** `warn`: a no (no entry, can't be used): its hint in red; `who`: a person's name (dark glass, the name in the speakers' yellow) */
export type Tip = { title: string; hint: string; warn?: boolean; who?: boolean } | null
let tip: Tip = null
const subs = new Set<() => void>()
/**
 * What the tag is over, when it's known (the thing pointed at, the camera and the canvas, from the pointer's event): a small thing's tag
 * stands just over its top, not by the pointer, where among the drinks' bottles it lay over the next ones (the owner's); null, by the pointer
 */
export const TIP_AIM: { obj: THREE.Object3D | null; camera: THREE.Camera | null; canvas: HTMLElement | null } = { obj: null, camera: null, canvas: null }
/** note what the tag's for, from a pointer event over it */
export const aimTip = (e: { eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => {
  TIP_AIM.obj = e.eventObject ?? null
  TIP_AIM.camera = e.camera ?? null
  TIP_AIM.canvas = (e.nativeEvent?.target as HTMLElement | null) ?? null
}
export const setTip = (t: Tip) => {
  if (t && HOVER.paused) t = null
  if (!t) TIP_AIM.obj = null
  if (t?.title === tip?.title && t?.hint === tip?.hint && t?.warn === tip?.warn && t?.who === tip?.who) return
  tip = t
  subs.forEach((f) => f())
}
export const useTip = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => tip)
/**
 * A person under the pointer (scene/FigureHit): their name tag; the pointer left the plain arrow (the owner's, 2026-11-12: whatever can only
 * be pointed at, not done anything with, keeps the default cursor: the staff and the owner can't be clicked; a customer who can be moved
 * gets the open hand from FigureHit). The event's let through: what's behind them (the food on the fire behind the owner) still answers,
 * and its own tag, set after, wins; leaving, it takes down only a person's tag.
 */
export const whoOver = (title: () => string, hint: () => string = () => '') => ({
  onPointerOver: (e: { eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => {
    if (HOVER.paused) return
    aimTip(e)
    setTip({ title: title(), hint: hint(), who: true })
  },
  onPointerOut: (e: { nativeEvent?: Event }) => {
    if (HOVER.paused) return
    if (tip?.who) setTip(null)
    const el = e.nativeEvent?.target as HTMLElement | null
    if (el?.style && el.style.cursor === 'pointer') el.style.cursor = ''
  },
})
/** whether it and everything it hangs from is shown (R3F points at hidden meshes too) */
const shown = (o: THREE.Object3D | null | undefined) => { for (let q = o ?? null; q; q = q.parent) if (!q.visible) return false; return true }
/**
 * A thing only named when pointed at, as bar's nameOver, that may be hidden (item 279: the plates, in stacks drawn only while there are
 * any, hidden otherwise and still taking the pointer): its tag only over what's shown, over a hidden one the pointer goes on to what's
 * behind; leaving, it takes down only its own tag. `hint` may be asked as the pointer comes onto it (a plate's state as it is then).
 */
export const shownOver = (title: string, hint: string | (() => string)) => ({
  onPointerOver: (e: { stopPropagation: () => void; object?: THREE.Object3D; eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => {
    if (HOVER.paused || !shown(e.object)) return
    e.stopPropagation()
    aimTip(e)
    setTip({ title, hint: typeof hint === 'function' ? hint() : hint })
  },
  onPointerOut: () => { if (!HOVER.paused && tip?.title === title) setTip(null) },
})
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __tip?: typeof setTip }).__tip = setTip
