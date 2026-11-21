// How far the page has been pulled down by a finger from the top half of the 3D view (0..1; let go at 1, it reloads): set by the touch
// gestures (App), drawn by ui/PullRefresh. Kept here and not in the page's state (the owner's rules for effects, CLAUDE.md: what changes
// many times a second isn't the page's state): it changes with every move of the finger, and each of those drew the whole page again.
import { useSyncExternalStore } from 'react'

let pull = 0
const subs = new Set<() => void>()
export const pullNow = () => pull
export const setPull = (v: number) => {
  if (v === pull) return
  pull = v
  subs.forEach((f) => f())
}
export const usePull = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, pullNow)
