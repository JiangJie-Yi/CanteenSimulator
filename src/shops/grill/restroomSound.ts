// The toilets' sounds, and the room's fittings' (the taps, the light switch), made on the spot with WebAudio (no recordings), each as loud as
// the room is near the view (`near` 0..1): the flush (a rush of water that swells and drains away with a gurgle, then the cistern refilling),
// the brush scrubbing, a knock at a locked door, the paper holder's new roll, the Otohime (音姫): a babbling stream with birdsong, played for
// a while to cover what's done; a tap's handle turned, the light switch's tick, the cold cabinets' doors.

import { replaces } from '@/scene/hot'

let ac: AudioContext | null = null
function ctx() {
  if (ac) return ac.state === 'running' ? ac : null
  try { ac = new AudioContext() } catch { ac = null }
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
function out(a: AudioContext, gain: number) {
  const g = a.createGain()
  g.gain.value = gain
  g.connect(a.destination)
  return g
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
  if (!a || near < 0.02) return
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
  if (!a || near < 0.02) return
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
