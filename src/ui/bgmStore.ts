// Whether the shop's background music is playing: shared by the speaker on the wall (which turns it on and off) and the player (ui/Bgm). It
// always begins off.
import { useSyncExternalStore } from 'react'

let off = true
const subs = new Set<() => void>()

export const getBgmOff = () => off
export const useBgmOff = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => off)
export const setBgmOff = (v: boolean) => { if (v !== off) { off = v; subs.forEach((f) => f()) } }
