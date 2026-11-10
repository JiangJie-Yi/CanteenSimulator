// The toilets' sounds, and the room's fittings' (the taps, the light switch), made on the spot with WebAudio (no recordings), each as loud as
// the room is near the view (`near` 0..1): the flush (a rush of water that swells and drains away with a gurgle, then the cistern refilling),
// the brush scrubbing, a knock at a locked door, the paper holder's new roll, the Otohime (音姫): a babbling stream with birdsong, played for
// a while to cover what's done; a tap's handle turned, the light switch's tick, the cold cabinets' doors.

import * as THREE from 'three'
import { replaces } from '@/scene/hot'
import { gate, heard } from '@/scene/sfx'

let ac: AudioContext | null = null
function ctx() {
  if (ac) return ac.state === 'running' ? ac : null
  try { ac = new AudioContext({ latencyHint: 'playback' }) } catch { ac = null }
  if (ac?.state === 'suspended') void ac.resume()
  return ac?.state === 'running' ? ac : null
}
if (typeof window !== 'undefined') {
  const go = () => { const a = ac ?? ctx(); if (a?.state === 'suspended') void a.resume() }
  window.addEventListener('pointerdown', go)
  // (let go of, with its sound, when a hot update swaps this module for a new copy)
  replaces(import.meta.hot, () => { window.removeEventListener('pointerdown', go); void ac?.close() })
}

function noise(a: AudioContext, seconds: number, shape: (t: number) => number, smooth = 0.4) {
  const n = Math.max(1, Math.floor(a.sampleRate * seconds))
  const b = a.createBuffer(1, n, a.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) { last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth); d[i] = last * shape(i / n) }
  const s = a.createBufferSource()
  s.buffer = b
  return s
}
function out(a: AudioContext, gain: number, pan = 0) {
  const g = a.createGain()
  g.gain.value = gain
  if (pan) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(a.destination) } else g.connect(a.destination)
  return g
}
/** a short ring at a pitch, dying away (glass, a can, a plate, a latch) */
function ping(a: AudioContext, t: number, freq: number, gain: number, decay: number, to: AudioNode, type: OscillatorType = 'sine') {
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  o.connect(g).connect(to)
  o.start(t); o.stop(t + decay + 0.02)
}

/** the flush: a rush that swells and drains, its pitch falling as the bowl empties, a gurgle at the end, the tank refilling after */
export function flushSound(near: number) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  const rush = noise(a, 3.2, (x) => Math.min(1, x * 12) * Math.pow(1 - x, 1.6))
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3
  f.frequency.setValueAtTime(2600, t)
  f.frequency.exponentialRampToValueAtTime(380, t + 3)
  rush.connect(f).connect(out(a, 0.55 * near))
  rush.start(t)
  // (the gurgle as it drains: a few low bubbles)
  for (let k = 0; k < 6; k++) {
    const o = a.createOscillator()
    const g = a.createGain()
    const at = t + 2.1 + k * 0.13 + Math.random() * 0.05
    o.frequency.setValueAtTime(140 + Math.random() * 90, at)
    o.frequency.exponentialRampToValueAtTime(320 + Math.random() * 120, at + 0.08)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.12 * near, at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0005, at + 0.1)
    o.connect(g).connect(a.destination)
    o.start(at)
    o.stop(at + 0.12)
  }
  // (and the cistern refilling: a thin hiss, running into the basin on its lid)
  const fill = noise(a, 4.5, (x) => Math.min(1, x * 6) * (1 - x), 0.2)
  const ff = a.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 3200; ff.Q.value = 1.2
  fill.connect(ff).connect(out(a, 0.12 * near))
  fill.start(t + 2.6)
}

/** the brush, scrubbing: quick bristly strokes back and forth */
export function scrubSound(near: number) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  for (let k = 0; k < 8; k++) {
    const s = noise(a, 0.14, (x) => Math.sin(Math.PI * x), 0.1)
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200 + (k % 2) * 1400; f.Q.value = 0.8
    s.connect(f).connect(out(a, 0.25 * near))
    s.start(t + k * 0.16)
  }
}

/** the hand dryer: its fan spinning up, a soft breathy whir for `seconds` (air through its nozzle, a low hum of its motor under it), and
 * winding down: quiet (the owner's: a faint blow) */
export function dryerSound(near: number, seconds = 1.5) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  const air = noise(a, seconds + 0.3, (x) => Math.min(1, x * (seconds + 0.3) / 0.18) * Math.min(1, (1 - x) * (seconds + 0.3) / 0.3), 0.55)
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6
  air.connect(f).connect(out(a, 0.22 * near))
  air.start(t)
  const hum = a.createOscillator(); hum.type = 'triangle'
  hum.frequency.setValueAtTime(70, t); hum.frequency.linearRampToValueAtTime(118, t + 0.2); hum.frequency.setValueAtTime(118, t + seconds); hum.frequency.linearRampToValueAtTime(60, t + seconds + 0.3)
  const hg = out(a, 0)
  hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(0.04 * near, t + 0.2); hg.gain.setValueAtTime(0.04 * near, t + seconds); hg.gain.linearRampToValueAtTime(0, t + seconds + 0.3)
  hum.connect(hg)
  hum.start(t); hum.stop(t + seconds + 0.35)
}

/** a knock at a locked door (コンコン), and nobody coming out */
export function knockSound(near: number) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  for (const at of [0, 0.17]) {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(190, t + at)
    o.frequency.exponentialRampToValueAtTime(110, t + at + 0.08)
    g.gain.setValueAtTime(0.5 * near, t + at)
    g.gain.exponentialRampToValueAtTime(0.0005, t + at + 0.12)
    o.connect(g).connect(a.destination)
    o.start(t + at)
    o.stop(t + at + 0.14)
    const s = noise(a, 0.03, (x) => 1 - x, 0.3)
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5
    s.connect(f).connect(out(a, 0.35 * near))
    s.start(t + at)
  }
}

/**
 * A wooden sliding door (引き戸) run along its track (the owner's: every sliding door heard as it's opened and shut): the low rumble of its
 * runners, rising as it gets going and falling as it slows, a faint woody chatter over it, and at the end a soft knock as it meets its
 * post (a duller one shutting, a lighter tap opening). `seconds` how long it runs, `near` how loud (0..1) for how near the view is.
 */
export function slideDoorSound(opening: boolean, near = 1, seconds = 0.55) {
  const a = ctx()
  // (not twice within 0.3 s for one door: one caught on a walker going to and fro clattered)
  if (!a || near < 0.02 || !gate(`slide${opening}${near.toFixed(2)}`)) return
  const t = a.currentTime
  // (the runners: low noise through a low band, swelling and fading with the door's pace)
  const run = noise(a, seconds, (x) => Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 0.8, 0.86)
  const lo = a.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 230; lo.Q.value = 0.9
  run.connect(lo).connect(out(a, 0.55 * near))
  run.start(t)
  // (the wood on wood over it, a little higher and rough)
  const chat = noise(a, seconds, (x) => 0.5 * Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 60)), 0.5)
  const hi = a.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 1300; hi.Q.value = 1.2
  chat.connect(hi).connect(out(a, 0.12 * near))
  chat.start(t)
  // (and the knock as it comes to its post)
  const at = t + seconds * 0.95
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(opening ? 210 : 150, at)
  o.frequency.exponentialRampToValueAtTime(opening ? 140 : 90, at + 0.09)
  g.gain.setValueAtTime((opening ? 0.22 : 0.4) * near, at)
  g.gain.exponentialRampToValueAtTime(0.0005, at + 0.14)
  o.connect(g).connect(a.destination)
  o.start(at)
  o.stop(at + 0.16)
}

/** a new roll on the holder: a papery rustle and the bar's click */
export function rollSound(near: number) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  const s = noise(a, 0.45, (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.random()), 0.05)
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500
  s.connect(f).connect(out(a, 0.22 * near))
  s.start(t)
  const o = a.createOscillator()
  const g = a.createGain()
  o.frequency.value = 1800
  g.gain.setValueAtTime(0.15 * near, t + 0.42)
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.47)
  o.connect(g).connect(a.destination)
  o.start(t + 0.42)
  o.stop(t + 0.5)
}

/** taps left running or washing (the sink's, the toilets' washstands'): one splashing loop for them all, as loud as the nearest running one;
 * each tap says how near it's running each frame (0: shut) */
const taps = new Map<string, number>()
let run: { gain: GainNode } | null = null
export function tapRunning(id: string, level: number) {
  const prev = taps.get(id) ?? 0
  if (Math.abs(prev - level) < 0.02 && !(level === 0 && prev !== 0)) return
  taps.set(id, level)
  const a = ctx()
  if (!a) return
  const l = Math.max(0, ...taps.values())
  if (!run) {
    if (l <= 0) return
    // (water splashing into a basin: rough noise, a slow wobble in its band, looped)
    const n = Math.floor(a.sampleRate * 2)
    const b = a.createBuffer(1, n, a.sampleRate)
    const d = b.getChannelData(0)
    let last = 0
    for (let i = 0; i < n; i++) { last = last * 0.25 + (Math.random() * 2 - 1) * 0.75; d[i] = last * (0.8 + 0.2 * Math.sin((i / n) * Math.PI * 2 * 23)) }
    const src = a.createBufferSource()
    src.buffer = b
    src.loop = true
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.6
    const lfo = a.createOscillator(); lfo.frequency.value = 3.3
    const depth = a.createGain(); depth.gain.value = 300
    lfo.connect(depth).connect(f.frequency)
    const gain = a.createGain()
    gain.gain.value = 0
    src.connect(f).connect(gain).connect(a.destination)
    src.start()
    lfo.start()
    run = { gain }
  }
  run.gain.gain.setTargetAtTime(0.16 * l, a.currentTime, 0.12)
}

/** a tap's cross handle given its quarter turn (the owner's: turning it should be heard; light, not heavy or watery): the stem turning in its
 * packing, a short faint stick-slip squeak rising as it opens (falling as it shuts), a little ring of brass on brass at the end of the turn,
 * and, shutting, the washer seating with a small dull knock */
export function tapTurnSound(open: boolean, near = 1) {
  const a = ctx()
  if (!a || near < 0.02) return
  const t = a.currentTime
  const dur = 0.2
  const o = a.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(open ? 520 : 680, t)
  o.frequency.linearRampToValueAtTime(open ? 780 : 440, t + dur)
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.3
  // (the squeak in grains, the stem sticking and slipping some thirty times a second, loudest midway)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  for (let k = t; k < t + dur; ) {
    const step = 1 / 32 + Math.random() * 0.01
    const peak = 0.04 * near * Math.sin((Math.PI * (k - t)) / dur) + 0.0001
    g.gain.linearRampToValueAtTime(peak, k + step * 0.3)
    g.gain.linearRampToValueAtTime(0.0001, k + step)
    k += step
  }
  o.connect(bp).connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.03)
  // (brass on brass as the cross comes to its stop: two thin partials, dying away)
  const end = t + dur
  for (const [f, v] of [[2650, 0.028], [4180, 0.016]] as const) {
    const r = a.createOscillator(), rg = a.createGain()
    r.frequency.value = f
    rg.gain.setValueAtTime(v * near, end)
    rg.gain.exponentialRampToValueAtTime(0.0001, end + 0.22)
    r.connect(rg).connect(a.destination)
    r.start(end)
    r.stop(end + 0.24)
  }
  if (!open) {
    const th = noise(a, 0.035, (x) => (1 - x) ** 3, 0.55)
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4
    th.connect(lp).connect(out(a, 0.12 * near))
    th.start(end)
  }
}

/** the light switch (a wide rocker) pressed: two dry little ticks a hair apart, the rocker giving and then landing, bright and short with
 * nothing ringing after (the owner's: light; the first try was heavy and watery, a falling tone under a ringing band), a touch higher
 * switching on */
export function lightSwitchSound(on: boolean) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const tick = (at: number, gain: number, cut: number, ms: number) => {
    const s = noise(a, ms / 1000, (x) => (1 - x) ** 3, 0)
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = cut; f.Q.value = 0.5
    s.connect(f).connect(out(a, gain))
    s.start(at)
  }
  tick(t, 0.07, 4500, 3)
  tick(t + 0.012, on ? 0.2 : 0.17, on ? 2800 : 2400, 5)
}

/** a cold cabinet's door (the drinks fridges' glass doors, the ingredients freezer's lid: `chest`), as light as the switch: opening, its seal
 * let go, a short soft breath of air; shut, it meets the cabinet, a muffled knock with the seal's little tick on it */
export function coolerDoorSound(opening: boolean, near = 1, chest = false) {
  const a = ctx()
  if (!a || near < 0.02 || !gate(`cooler${opening}${chest}${near.toFixed(1)}`)) return
  const t = a.currentTime
  if (opening) {
    const s = noise(a, 0.09, (x) => Math.min(1, x * 8) * (1 - x) ** 2, 0.3)
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = chest ? 900 : 1300; bp.Q.value = 0.5
    s.connect(bp).connect(out(a, 0.15 * near))
    s.start(t)
    return
  }
  const s = noise(a, 0.05, (x) => (1 - x) ** 3, 0.6)
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = chest ? 420 : 600; lp.Q.value = 0.4
  s.connect(lp).connect(out(a, 0.28 * near))
  s.start(t)
  const k = noise(a, 0.004, (x) => 1 - x, 0)
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
  k.connect(hp).connect(out(a, 0.07 * near))
  k.start(t + 0.008)
}

/** the Otohime: a stream babbling over stones and a bird or two, for `seconds` (its volume follows the view each frame: see otohimeNear) */
let oto: { gain: GainNode; until: number } | null = null
export function otohimeSound(seconds: number) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (oto && oto.until > t) return
  const gain = a.createGain()
  gain.gain.value = 0
  gain.connect(a.destination)
  // (the water: noise through a moving band, a slow swell under quick babble)
  const w = noise(a, seconds, (x) => Math.min(1, x * 20, (1 - x) * 10) * (0.7 + 0.3 * Math.sin(x * seconds * 9) * Math.sin(x * seconds * 2.3)), 0.25)
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7
  const lfo = a.createOscillator(); lfo.frequency.value = 5.5
  const depth = a.createGain(); depth.gain.value = 500
  lfo.connect(depth).connect(f.frequency)
  w.connect(f).connect(gain)
  w.start(t)
  lfo.start(t)
  lfo.stop(t + seconds)
  // (a bird now and then: a quick rising chirp)
  for (let at = 1 + Math.random() * 2; at < seconds - 1; at += 2.5 + Math.random() * 3) {
    for (let k = 0; k < 3; k++) {
      const o = a.createOscillator()
      const g = a.createGain()
      const s = t + at + k * 0.11
      o.frequency.setValueAtTime(2600 + Math.random() * 400, s)
      o.frequency.exponentialRampToValueAtTime(4200 + Math.random() * 600, s + 0.07)
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.08, s + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0005, s + 0.08)
      o.connect(g).connect(gain)
      o.start(s)
      o.stop(s + 0.09)
    }
  }
  oto = { gain, until: t + seconds }
}
/** how near the Otohime's room is to the view just now */
export function otohimeNear(near: number) {
  if (!ac || !oto) return
  oto.gain.gain.setTargetAtTime(0.5 * near, ac.currentTime, 0.2)
  if (oto.until < ac.currentTime) oto = null
}

/**
 * A drink taken out of (or put back in) a fridge, heard at `at` (world): a glass bottle's bright clink against its neighbour (two quick high
 * pings and a tick), a can's hollow aluminium tonk (two lower knocks, a little out of tune with each other)
 */
export function bottleClink(can: boolean, at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('clink', 120)) return
  const t = a.currentTime, o = out(a, 0.22 * near, pan)
  if (can) {
    ping(a, t, 880 + Math.random() * 60, 0.5, 0.09, o, 'triangle')
    ping(a, t + 0.004, 1330 + Math.random() * 80, 0.3, 0.06, o, 'triangle')
    ping(a, t + 0.09, 960, 0.22, 0.06, o, 'triangle')
  } else {
    ping(a, t, 2650 + Math.random() * 200, 0.5, 0.16, o)
    ping(a, t + 0.002, 3420 + Math.random() * 200, 0.3, 0.1, o)
    ping(a, t + 0.075, 2900, 0.25, 0.12, o)
  }
  const k = noise(a, 0.006, (x) => 1 - x, 0)
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000
  k.connect(hp).connect(o); k.start(t)
}

/**
 * A glass bottle broken on the floor (game/spills), heard at `at`: the hard crack of it hitting the boards, a bright scatter of shards ringing
 * and tinkling as they skitter and settle (a dozen little pings, high, each its own pitch, over half a second), and the drink's splash under it
 */
export function glassShatter(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('shatter', 150)) return
  const t = a.currentTime, o = out(a, 0.34 * near, pan)
  // (the crack: a burst of noise, bright, gone in a few hundredths)
  const crack = noise(a, 0.09, (x) => (1 - x) ** 3, 0)
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
  crack.connect(hp).connect(o); crack.start(t)
  const thud = noise(a, 0.07, (x) => (1 - x) ** 2, 0.6)
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420
  const tg = a.createGain(); tg.gain.value = 0.8
  thud.connect(lp).connect(tg).connect(o); thud.start(t)
  // (the shards: high pings, each a little later and quieter, skittering)
  for (let k = 0; k < 14; k++) {
    const dt = 0.01 + Math.random() ** 1.6 * 0.55, f = 2600 + Math.random() * 4200
    ping(a, t + dt, f, 0.32 * (1 - dt * 1.2), 0.05 + Math.random() * 0.09, o)
    if (k % 3 === 0) ping(a, t + dt + 0.002, f * 1.48, 0.14 * (1 - dt), 0.04, o)
  }
  // (and the drink out of it: a short wet splash)
  const wet = noise(a, 0.3, (x) => Math.min(1, x * 25) * (1 - x) ** 2.2, 0.2)
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8
  const wg = a.createGain(); wg.gain.value = 0.55
  wet.connect(bp).connect(wg).connect(o); wet.start(t + 0.012)
}

/**
 * A can knocked to the floor (game/spills), heard at `at`: its hollow clank on the boards (a can's ring, two or three partials), a second
 * smaller one as it bounces, then the rattle of it rolling away, slowing
 */
export function canClatter(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('clatter', 150)) return
  const t = a.currentTime, o = out(a, 0.26 * near, pan)
  for (const [dt, g] of [[0, 1], [0.16, 0.45]] as const) {
    ping(a, t + dt, 640 + Math.random() * 40, 0.55 * g, 0.16, o, 'triangle')
    ping(a, t + dt + 0.003, 1490 + Math.random() * 60, 0.32 * g, 0.11, o, 'triangle')
    ping(a, t + dt + 0.005, 2730 + Math.random() * 90, 0.16 * g, 0.07, o)
    const k = noise(a, 0.02, (x) => 1 - x, 0)
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500
    const kg = a.createGain(); kg.gain.value = g
    k.connect(hp).connect(kg).connect(o); k.start(t + dt)
  }
  // (rolling: a low rumble ticking over the boards' joins, slowing and fading over a second)
  const roll = noise(a, 1.1, (x) => (x < 0.04 ? x / 0.04 : 1) * (1 - x) ** 1.5 * (0.6 + 0.4 * Math.max(0, Math.sin(x * 70 * (1 - x * 0.6)))), 0.5)
  const rb = a.createBiquadFilter(); rb.type = 'bandpass'; rb.frequency.value = 1300; rb.Q.value = 1.4
  const rg = a.createGain(); rg.gain.value = 0.5
  roll.connect(rb).connect(rg).connect(o); roll.start(t + 0.22)
}

/** a toilet's door latched behind someone, heard at `at`: a little brass bolt slid home, a click and its small ring, a softer click after */
export function latchSound(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate(`latch${at.x.toFixed(1)}`)) return
  const t = a.currentTime, o = out(a, 0.2 * near, pan)
  for (const [dt, g] of [[0, 1], [0.045, 0.5]] as const) {
    const k = noise(a, 0.007, (x) => 1 - x, 0.1)
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2
    const kg = a.createGain(); kg.gain.value = g
    k.connect(bp).connect(kg).connect(o); k.start(t + dt)
  }
  ping(a, t, 1900, 0.18, 0.07, o)
}

/** a glaze brushed or salt thrown on what's over the coals: a burst of sizzle (white noise, high, crackling), swelling and dying away */
export function sizzleBurst(at: THREE.Vector3, level = 1) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('sizzle', 250)) return
  const t = a.currentTime, o = out(a, 0.16 * near * level, pan)
  const s = noise(a, 0.7, (x) => Math.min(1, x * 12) * (1 - x) ** 1.6 * (0.55 + 0.45 * Math.random() ** 6), 0.05)
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600
  s.connect(hp).connect(o); s.start(t)
}

/** a plate scrubbed in the sink: a splash and a scrub of the brush in soapy water, a bubble or two */
export function washSplash(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('wash', 280)) return
  const t = a.currentTime, o = out(a, 0.17 * near, pan)
  const s = noise(a, 0.38, (x) => Math.min(1, x * 6) * (1 - x) * (0.6 + 0.4 * Math.sin(x * 60)), 0.5)
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7
  s.connect(bp).connect(o); s.start(t)
  for (let k = 0; k < 2; k++) {
    const b = a.createOscillator(), g = a.createGain(), at0 = t + 0.08 + k * 0.11 + Math.random() * 0.05
    b.frequency.setValueAtTime(520 + Math.random() * 200, at0); b.frequency.exponentialRampToValueAtTime(1300, at0 + 0.05)
    g.gain.setValueAtTime(0.0001, at0); g.gain.exponentialRampToValueAtTime(0.12, at0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at0 + 0.06)
    b.connect(g).connect(o); b.start(at0); b.stop(at0 + 0.08)
  }
}

/** a plate set down on another: a short ceramic clink */
export function plateClink(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('plate', 90)) return
  const t = a.currentTime, o = out(a, 0.16 * near, pan)
  ping(a, t, 2080 + Math.random() * 120, 0.45, 0.09, o)
  ping(a, t + 0.002, 3350 + Math.random() * 160, 0.25, 0.06, o)
  const k = noise(a, 0.01, (x) => 1 - x, 0.2)
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500
  k.connect(hp).connect(o); k.start(t)
}

/** the bar's swing door: pushed open, a short dry creak of its hinges and a soft knock of the hand on the wood (`push`); swung back shut
 * past its frame, a light wooden tap (`tap`) */
export function gateSound(at: THREE.Vector3, kind: 'push' | 'tap') {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate(`swing${kind}${at.x.toFixed(1)}`)) return
  const t = a.currentTime, o = out(a, (kind === 'push' ? 0.16 : 0.12) * near, pan)
  if (kind === 'push') {
    // (the hinge: a little rasp drawn up in pitch as it turns)
    const r = noise(a, 0.16, (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 60)), 0.2)
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6
    bp.frequency.setValueAtTime(620, t); bp.frequency.linearRampToValueAtTime(980, t + 0.16)
    const rg = a.createGain(); rg.gain.value = 0.7
    r.connect(bp).connect(rg).connect(o); r.start(t)
  }
  // (the knock: wood, hollow and low)
  const k = noise(a, 0.03, (x) => (1 - x) ** 2, 0.15)
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'push' ? 900 : 1300
  k.connect(lp).connect(o); k.start(t)
  ping(a, t, kind === 'push' ? 180 : 240, 0.25, 0.08, o)
}

/** a bar stool pulled out over the boards: a short wooden scrape, low, its feet's rub dying away */
export function stoolSound(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate(`stool${at.x.toFixed(1)}${at.z.toFixed(1)}`)) return
  const t = a.currentTime, o = out(a, 0.14 * near, pan)
  const r = noise(a, 0.22, (x) => Math.sin(Math.PI * Math.min(1, x * 1.6)) * (1 - x) * (0.7 + 0.3 * Math.sin(x * 90)), 0.25)
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5
  bp.frequency.setValueAtTime(420, t); bp.frequency.linearRampToValueAtTime(300, t + 0.22)
  r.connect(bp).connect(o); r.start(t)
  ping(a, t + 0.2, 140, 0.15, 0.06, o)
}

/** the dish washer done (the owner's: a clear chime as it finishes): two soft bell tones, the second a fourth up, each with a quiet octave over */
export function washerChime(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('washer-chime', 600)) return
  const t = a.currentTime, o = out(a, 0.2 * near, pan)
  for (const [k, f] of [[0, 1046.5], [1, 1396.9]] as const) {
    ping(a, t + k * 0.22, f, 0.4, 0.9, o)
    ping(a, t + k * 0.22, f * 2, 0.08, 0.5, o)
  }
}
/** its door tried while it's washing: a short low double beep, it won't open */
export function washerBeep(at: THREE.Vector3) {
  const a = ctx()
  const { near, pan } = heard(at)
  if (!a || near < 0.02 || !gate('washer-beep', 300)) return
  const t = a.currentTime, o = out(a, 0.12 * near, pan)
  ping(a, t, 520, 0.35, 0.09, o, 'square')
  ping(a, t + 0.13, 520, 0.35, 0.09, o, 'square')
}
