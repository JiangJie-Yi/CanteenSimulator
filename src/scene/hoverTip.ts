// The little name tag that follows the pointer over anything in the room that can be used: what it is, and what pointing and clicking
// (or dragging) it does. Whoever's under the pointer sets it; HoverTip (ui) draws it.
import { useSyncExternalStore } from 'react'
import { HOVER } from './hoverGlow'

/** `warn`: a no (no entry, can't be used): its hint in red */
export type Tip = { title: string; hint: string; warn?: boolean } | null
let tip: Tip = null
const subs = new Set<() => void>()
export const setTip = (t: Tip) => { if (t && HOVER.paused) t = null; if (t?.title === tip?.title && t?.hint === tip?.hint) return; tip = t; subs.forEach((f) => f()) }
export const useTip = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => tip)
