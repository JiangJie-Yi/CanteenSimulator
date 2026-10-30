// The fire's own sound, made on the spot with WebAudio (no recordings), its loudness set each frame by game/fireSound: the charcoal's
// crackle (now and then a sharp pop, between them a soft hiss of embers) and, with food over it, the sizzle of fat dripping onto the coals
// (a bed of bright, busy noise, little spits flaring out of it). It starts with the first sound the player allows (a click), and quietens
// while the view is somewhere else in the shop (`near` 0..1).

let ac: AudioContext | null = null
let out: GainNode | null = null
let hiss: GainNode | null = null
let sizzle: GainNode | null = null
let popAt = 0
let spitAt = 0
const level = { crackle: 0, sizzle: 0, near: 1 }

function noiseLoop(a: AudioContext, seconds: number, shape: (i: number, n: number) => number) {
  const n = Math.floor(a.sampleRate * seconds)
  const b = a.createBuffer(1, n, a.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) { last = last * 0.4 + (Math.random() * 2 - 1) * 0.6; d[i] = last * shape(i, n) }
  const s = a.createBufferSource()
  s.buffer = b
  s.loop = true
  return s
}

function start() {
  if (ac) return
  try {
    ac = new AudioContext()
    out = ac.createGain()
    out.gain.value = 0
    out.connect(ac.destination)
    // (the embers' hiss: soft, low)
    const h = noiseLoop(ac, 2.3, () => 1)
    const hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1400
    hiss = ac.createGain(); hiss.gain.value = 0
    h.connect(hf).connect(hiss).connect(out)
    h.start()
    // (the sizzle: bright, busy, swelling and falling a little as fat drips)
    const z = noiseLoop(ac, 3.1, (i, n) => 0.75 + 0.25 * Math.sin((i / n) * Math.PI * 2 * 7) * Math.sin((i / n) * Math.PI * 2 * 3.3))
    const zf = ac.createBiquadFilter(); zf.type = 'highpass'; zf.frequency.value = 3200
    const zp = ac.createBiquadFilter(); zp.type = 'peaking'; zp.frequency.value = 6500; zp.gain.value = 6
    sizzle = ac.createGain(); sizzle.gain.value = 0
    z.connect(zf).connect(zp).connect(sizzle).connect(out)
    z.start()
  } catch {
    ac = null
  }
}
// (the browser lets sound start only after the player does something)
if (typeof window !== 'undefined') {
  const go = () => { start(); if (ac?.state === 'suspended') void ac.resume() }
  window.addEventListener('pointerdown', go)
  window.addEventListener('keydown', go)
}

/** a sharp little sound: a charcoal pop (low, woody) or a spit of fat (high, quick) */
function burst(freq: number, q: number, len: number, gain: number) {
  if (!ac || !out) return
  const n = Math.floor(ac.sampleRate * len)
  const b = ac.createBuffer(1, n, ac.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.15))
  const s = ac.createBufferSource()
  s.buffer = b
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q
  const g = ac.createGain(); g.gain.value = gain
  s.connect(f).connect(g).connect(out)
  s.start()
}

/** set the fire's sound this frame (crackle and sizzle 0..1 from game/fireSound; `near`: how much of it carries to where the view is) */
export function fireAmbience(crackle: number, sizz: number, near: number, dt: number) {
  level.crackle = crackle
  level.sizzle = sizz
  level.near = near
  if (!ac || !out || !hiss || !sizzle || ac.state !== 'running') return
  const t = ac.currentTime
  out.gain.setTargetAtTime(0.5 * near, t, 0.3)
  hiss.gain.setTargetAtTime(0.06 * crackle, t, 0.4)
  sizzle.gain.setTargetAtTime(0.05 * sizz, t, 0.25)
  // (pops: more often the hotter it burns)
  popAt -= dt
  if (crackle > 0 && popAt <= 0) {
    burst(700 + Math.random() * 1600, 2.5, 0.025 + Math.random() * 0.03, 0.25 + Math.random() * 0.35 * crackle)
    popAt = (0.25 + Math.random() * 1.6) / (0.3 + crackle)
  }
  // (spits of fat, with food on)
  spitAt -= dt
  if (sizz > 0.02 && spitAt <= 0) {
    burst(4000 + Math.random() * 4000, 3, 0.012 + Math.random() * 0.02, 0.08 + 0.12 * sizz)
    spitAt = (0.05 + Math.random() * 0.4) / (0.2 + sizz)
  }
}
