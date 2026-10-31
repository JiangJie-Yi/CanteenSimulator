// The toilets' sounds, made on the spot with WebAudio (no recordings), each as loud as the room is near the view (`near` 0..1): the
// flush (a rush of water that swells and drains away with a gurgle, then the cistern refilling), the brush scrubbing, a knock at a locked
// door, the paper holder's new roll, and the Otohime (音姫): a babbling stream with birdsong, played for a while to cover what's done.

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
