// Every sound effect through one switch (the owner's: a master volume, the effects muted on their own from the top right; the music has its
// speaker on the wall). The game's sounds are made on the spot in a dozen modules, each with its own AudioContext, each connecting straight to
// its context's speakers; here that one connection is turned, for every context, through a gain of its own (made the first time it's asked
// for), so all of them are muted or let sound together. The music (ui/Bgm) is an <audio> element, not in any of them.
// Also: `gate` (one sound not started twice within 0.3 s: a walker caught on a door's edge used to set it clattering) and `panOf` (left or
// right by where it is on screen).
import * as THREE from 'three'
import { useSyncExternalStore } from 'react'
import { replaces } from './hot'

const KEY = 'jgs-sfx-muted-1'
let muted = false
try { muted = localStorage.getItem(KEY) === '1' } catch { /* (no storage: sound on) */ }
const masters = new Map<BaseAudioContext, GainNode>()
const plainConnect = AudioNode.prototype.connect
function masterOf(ctx: BaseAudioContext) {
  let g = masters.get(ctx)
  if (!g) {
    g = ctx.createGain()
    g.gain.value = muted ? 0 : 1
    ;(plainConnect as (d: AudioNode) => AudioNode).call(g, ctx.destination)
    masters.set(ctx, g)
  }
  return g
}
if (typeof AudioNode !== 'undefined') {
  const turned = function (this: AudioNode, dest: AudioNode | AudioParam, ...rest: number[]) {
    if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode && this !== masters.get(this.context)) {
      return (plainConnect as (d: AudioNode, ...r: number[]) => AudioNode).call(this, masterOf(this.context), ...rest)
    }
    return (plainConnect as (d: AudioNode | AudioParam, ...r: number[]) => AudioNode | void).call(this, dest, ...rest)
  } as typeof AudioNode.prototype.connect
  AudioNode.prototype.connect = turned
  // (put back when a hot update runs a fresh copy of this module: it turns it again)
  replaces(import.meta.hot, () => { AudioNode.prototype.connect = plainConnect })
}

const listeners = new Set<() => void>()
export const sfxMuted = () => muted
/** mute or let sound every effect (remembered) */
export function setSfxMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* (not remembered) */ }
  for (const [ctx, g] of masters) {
    // (closed contexts (an old copy's, after a hot update) let go)
    if ((ctx as AudioContext).state === 'closed') { masters.delete(ctx); continue }
    // (set outright: a context with nothing sounding doesn't move a ramp along)
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.value = m ? 0 : 1
  }
  for (const f of listeners) f()
}
export function useSfxMuted() {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, sfxMuted)
}

const last = new Map<string, number>()
/** whether a sound under this name may start now: not if it did within `ms` (0.3 s) */
export function gate(key: string, ms = 300) {
  const now = performance.now()
  if (now - (last.get(key) ?? -1e9) < ms) return false
  last.set(key, now)
  if (import.meta.env?.DEV) { const k = key.replace(/[-\d.]+$/, ''); played[k] = (played[k] ?? 0) + 1 }
  return true
}
// (in development, `__sfx`: how many times each sound has played, the contexts and whether they're muted)
const played: Record<string, number> = {}
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __sfx: { played, masters, muted: () => muted } })

const at = new THREE.Vector3()
/** how far left (−1) or right (1) a point is on screen, a little less than all the way (a sound off to one side, not in one ear) */
export function panOf(p: THREE.Vector3, camera: THREE.Camera) {
  at.copy(p).project(camera)
  return Math.max(-1, Math.min(1, at.x)) * 0.6
}

/** the camera heard from (App's SfxEar sets it): how near a sound is, and which side */
let ear: THREE.Camera | null = null
export const setEar = (c: THREE.Camera) => { ear = c }
const earAt = new THREE.Vector3()
/** how loud (0..1, nothing past `reach`) and how far left or right a sound at `p` (world) is heard from the view (`reach` 22: from the
 * overview, some 16 away, the room's sounds were past 12 and not heard at all) */
export const EAR_REACH = 22
export function heard(p: THREE.Vector3, reach = EAR_REACH) {
  if (!ear) return { near: 0.6, pan: 0 }
  ear.getWorldPosition(earAt)
  return { near: Math.max(0, 1 - p.distanceTo(earAt) / reach), pan: panOf(p, ear) }
}
