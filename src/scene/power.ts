// Whether the machine's running on its battery (the owner's: a laptop unplugged froze, its sound stuck): the 3D view drawn at no more than
// one pixel per screen pixel then. From the browser's battery (where it has one), and `?power=low` in the address to ask for it anyway.
import { useSyncExternalStore } from 'react'

let low = typeof location !== 'undefined' && new URLSearchParams(location.search).get('power') === 'low'
const subs = new Set<() => void>()
const set = (v: boolean) => { if (v === low) return; low = v; subs.forEach((f) => f()) }

type Battery = EventTarget & { charging: boolean }
if (typeof navigator !== 'undefined' && !low) {
  const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> }
  nav.getBattery?.().then((b) => {
    const read = () => set(!b.charging)
    read()
    b.addEventListener('chargingchange', read)
  }).catch(() => { /* (no battery to ask) */ })
}

/** whether to draw lightly: on the battery, or asked for */
export const lowPower = () => low
export const useLowPower = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => low, () => false)
