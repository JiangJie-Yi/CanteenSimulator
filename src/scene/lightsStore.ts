import { useSyncExternalStore } from 'react'
import { LIGHTS_DEFAULT, readLights, switchLights, writeLights, type RoomLights } from '@/game/roomLights'

/** the shop's lights (the wall switch by the door), kept in the browser: whoever draws a lamp or the room's light follows it */
const KEY = 'jgs-lights-1'
let state: RoomLights = (() => { try { return readLights(localStorage.getItem(KEY)) } catch { return { ...LIGHTS_DEFAULT } } })()
const subs = new Set<() => void>()
export const getLights = () => state
export function pressLightSwitch() {
  state = switchLights(state)
  try { localStorage.setItem(KEY, writeLights(state)) } catch { /* (not kept) */ }
  subs.forEach((f) => f())
}
export const onLights = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useLights = () => useSyncExternalStore(onLights, getLights)
