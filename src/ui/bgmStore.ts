// The shop's background music settings, shared by the music button, the speaker on the wall and the little panel that opens from either:
// whether it's on, how loud, and whether the panel is open. Kept in the browser, so the choice is there next time.
import { useSyncExternalStore } from 'react'

const KEY_OFF = 'jgs-bgm-off'
const KEY_VOL = 'jgs-bgm-vol'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private window */ } }

export type BgmState = { off: boolean; volume: number; panel: boolean; seen: boolean }
let state: BgmState = { off: read(KEY_OFF) === '1', volume: Math.min(1, Math.max(0, Number(read(KEY_VOL) ?? 0.35))), panel: false, seen: false }
const subs = new Set<() => void>()
const set = (next: Partial<BgmState>) => { state = { ...state, ...next }; subs.forEach((f) => f()) }

export const getBgm = () => state
export const useBgm = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)
export const setBgmOff = (off: boolean) => { write(KEY_OFF, off ? '1' : '0'); set({ off }) }
export const setBgmVolume = (volume: number) => { const v = Math.min(1, Math.max(0, volume)); write(KEY_VOL, String(v)); set({ volume: v }) }
export const toggleBgmPanel = (open = !state.panel) => set({ panel: open })
/** whether the speaker on the wall is on the screen just now (when it isn't, the music button is there to reach the panel by) */
export const setBgmSeen = (seen: boolean) => { if (state.seen !== seen) set({ seen }) }
