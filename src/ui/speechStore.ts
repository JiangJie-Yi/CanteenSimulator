import { useSyncExternalStore } from 'react'

/**
 * What each customer is saying just now, over their head (App's talk puts it here, GuestBar3D's label over each customer reads its own).
 * Kept outside App's state (item 24, the stutter at closing time): each line said, and again as it ended, redrew the whole page, near once a
 * second while the shop was busy, the page's slowest redraw; now only the one label that shows it is drawn again.
 */
export type Said = { key: number; text: string; ms: number }
let said: Record<number, Said> = {}
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** a customer's line put up over them (it replaces what they were saying) */
export function sayOver(id: number, s: Said) {
  said = { ...said, [id]: s }
  emit()
}
/** that line taken down, if it's still the one up (a newer one stays) */
export function unsayOver(id: number, key: number) {
  if (said[id]?.key !== key) return
  const next = { ...said }
  delete next[id]
  said = next
  emit()
}
/** what the customer `id` is saying now, if anything: drawn again only when that changes */
export const useSaid = (id: number) => useSyncExternalStore(sub, () => said[id])
