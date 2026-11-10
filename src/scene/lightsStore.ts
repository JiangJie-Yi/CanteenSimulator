import { useSyncExternalStore } from 'react'
import { LIGHTS_DEFAULT, lightOn, readLights, switchLights, writeLights, type Circuit, type RoomLights } from '@/game/roomLights'

/** the shop's lights (its wall switches: the room's and the door lanterns' by the way in, each toilet's by its door), kept in the browser:
 * whoever draws a lamp or the room's light follows them */
const KEY = 'jgs-lights-1'
let state: RoomLights = (() => { try { return readLights(localStorage.getItem(KEY)) } catch { return { ...LIGHTS_DEFAULT, wc: { ...LIGHTS_DEFAULT.wc } } } })()
const subs = new Set<() => void>()
export const getLights = () => state
export function pressLightSwitch(c: Circuit = 'room') {
  state = switchLights(state, c)
  try { localStorage.setItem(KEY, writeLights(state)) } catch { /* (not kept) */ }
  subs.forEach((f) => f())
}
/** a switch set on or off by the shop itself (the door's lanterns lit at opening, put out at its last order): as pressed, if it isn't already */
export function setLightSwitch(c: Circuit, on: boolean) {
  if (lightOn(state, c) !== on) pressLightSwitch(c)
}
export const onLights = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useLights = () => useSyncExternalStore(onLights, getLights)
// (in development, to be pressed from the console or a test: the app's own copy of the switch)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __lights?: unknown }).__lights = { get: getLights, press: pressLightSwitch }
