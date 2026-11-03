// The little name tag that follows the pointer over anything in the room that can be used: what it is, and what pointing and clicking
// (or dragging) it does. Whoever's under the pointer sets it; HoverTip (ui) draws it.
import { useSyncExternalStore } from 'react'
import type * as THREE from 'three'
import { HOVER } from './hoverGlow'

/** `warn`: a no (no entry, can't be used): its hint in red */
export type Tip = { title: string; hint: string; warn?: boolean } | null
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
  if (t?.title === tip?.title && t?.hint === tip?.hint && t?.warn === tip?.warn) return
  tip = t
  subs.forEach((f) => f())
}
export const useTip = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => tip)
