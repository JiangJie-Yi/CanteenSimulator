// Soft background music, made in the browser (no audio files): a slow, quiet piece in a Japanese-ish pentatonic
// scale — a warm low drone that breathes, and koto-like plucked notes now and then, drifting through a long soft
// reverb, like a little shop late in the evening. It starts on the first tap or click (browsers won't play sound
// before that) unless it was muted; the mute choice is remembered.

const KEY = 'canteen-bgm-muted'
// D, E, F#, A, B in a few octaves (a major pentatonic: gentle, never dissonant)
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33]

let ctx: AudioContext | null = null
let master: GainNode | null = null
let timer = 0
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<(m: boolean) => void>()

function reverb(c: AudioContext) {
  // a long, dark tail from shaped noise
  const len = c.sampleRate * 3.5
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  const conv = c.createConvolver()
  conv.buffer = buf
  return conv
}

function pluck(c: AudioContext, out: AudioNode, freq: number, when: number, vel: number) {
  // a plucked string: a bright attack that dulls and fades, with a quieter octave above
  for (const [mult, amp] of [[1, 1], [2, 0.25], [3, 0.08]] as const) {
    const o = c.createOscillator()
    o.type = mult === 1 ? 'triangle' : 'sine'
    o.frequency.value = freq * mult
    const g = c.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(0.16 * vel * amp, when + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.6 / mult)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, when)
    lp.frequency.exponentialRampToValueAtTime(600, when + 1.2)
    o.connect(lp).connect(g).connect(out)
    o.start(when)
    o.stop(when + 3)
  }
}

function start() {
  if (ctx || muted) return
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4)
  const wet = reverb(ctx)
  const wetGain = ctx.createGain()
  wetGain.gain.value = 0.55
  wet.connect(wetGain).connect(master)
  master.connect(ctx.destination)
  const bus = ctx.createGain()
  bus.gain.value = 0.6
  bus.connect(master)
  bus.connect(wet)
  // the drone: two low sines a fifth apart, swelling slowly
  for (const f of [73.42, 110]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = 0.035
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05 + Math.random() * 0.04
    const depth = ctx.createGain()
    depth.gain.value = 0.02
    lfo.connect(depth).connect(g.gain)
    o.connect(g).connect(bus)
    o.start()
    lfo.start()
  }
  // the melody: a phrase of a few notes walking up or down the scale, then a rest
  let idx = 4
  const phrase = () => {
    if (!ctx) return
    const t0 = ctx.currentTime + 0.05
    const notes = 2 + Math.floor(Math.random() * 4)
    let t = t0
    for (let n = 0; n < notes; n++) {
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]))
      pluck(ctx, bus, SCALE[idx], t, 0.6 + Math.random() * 0.4)
      if (Math.random() < 0.25) pluck(ctx, bus, SCALE[Math.max(0, idx - 3)], t + 0.02, 0.4)
      t += [0.45, 0.6, 0.9][Math.floor(Math.random() * 3)]
    }
    timer = window.setTimeout(phrase, (t - t0) * 1000 + 1800 + Math.random() * 3200)
  }
  phrase()
}

function stop() {
  window.clearTimeout(timer)
  const c = ctx
  if (c && master) {
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setValueAtTime(master.gain.value, c.currentTime)
    master.gain.linearRampToValueAtTime(0, c.currentTime + 0.6)
    window.setTimeout(() => c.close(), 700)
  }
  ctx = null
  master = null
}

export function isMuted() {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '1' : '0')
  } catch {
    // storage blocked
  }
  if (m) stop()
  else start()
  listeners.forEach((f) => f(m))
}

export function onMuteChange(f: (m: boolean) => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

// begin on the first gesture
if (typeof window !== 'undefined') {
  const first = () => {
    window.removeEventListener('pointerdown', first)
    window.removeEventListener('keydown', first)
    start()
  }
  window.addEventListener('pointerdown', first)
  window.addEventListener('keydown', first)
}
