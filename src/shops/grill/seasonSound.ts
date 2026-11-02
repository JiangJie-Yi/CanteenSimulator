// The seasonings' little sounds as they go on, made on the spot with WebAudio (no recordings): a soft hiss of grains for the powders (salt,
// peanut, shichimi), a wet dab for the pastes and sauces, a squeeze for the lemon; each pitched a little differently from the last, so a run
// of them doesn't drone; and while a powder's sprinkled, a faint patter of grains between the dabs.

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

function noise(a: AudioContext, seconds: number, shape: (t: number) => number, smooth = 0.3) {
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
const POWDERS = new Set(['salt', 'peanut', 'shichimi'])

/** a dab of a seasoning landing on the food */
export function seasonSound(kind: string) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (POWDERS.has(kind)) {
    // (a soft, bright hiss: grains falling on a hot surface)
    const n = noise(a, 0.26, (x) => Math.min(1, x * 16) * Math.pow(1 - x, 2.2), 0.05)
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4800 + Math.random() * 1800; f.Q.value = 0.8
    n.connect(f).connect(out(a, 0.09))
    n.start(t)
    return
  }
  if (kind === 'lemon') {
    // (a squeeze: a wet crackle, its pitch dropping as the juice runs)
    const n = noise(a, 0.3, (x) => Math.min(1, x * 10) * Math.pow(1 - x, 1.4), 0.55)
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.3)
    n.connect(f).connect(out(a, 0.1))
    n.start(t)
    return
  }
  // (a paste or a sauce: a soft low tap, and the wet smack of it)
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(300 + Math.random() * 80, t)
  o.frequency.exponentialRampToValueAtTime(130, t + 0.1)
  const g = out(a, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.1, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.15)
  const n = noise(a, 0.09, (x) => Math.pow(1 - x, 3), 0.65)
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200
  n.connect(f).connect(out(a, 0.06))
  n.start(t)
}

/** while a powder is being sprinkled: the faint patter of its grains (call it every so often; it's quiet and short) */
export function sprinkleTick(kind: string) {
  if (!POWDERS.has(kind)) return
  const a = ctx()
  if (!a) return
  const n = noise(a, 0.07, (x) => Math.pow(1 - x, 2.5), 0.02)
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5500 + Math.random() * 2000
  n.connect(f).connect(out(a, 0.025))
  n.start(a.currentTime)
}
