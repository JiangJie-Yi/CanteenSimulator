// The owner tasting: the crunch of each bite and the soft munching between, made on the spot with WebAudio (no recordings), each a little
// different from the last so a run of them doesn't drone.

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

function noise(a: AudioContext, seconds: number, shape: (t: number) => number, smooth: number) {
  const n = Math.max(1, Math.floor(a.sampleRate * seconds))
  const b = a.createBuffer(1, n, a.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) { last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth); d[i] = last * shape(i / n) }
  const s = a.createBufferSource()
  s.buffer = b
  return s
}

/** a bite: a short crackle (the crust giving) over a soft low knock (the jaw closing) */
export function biteSound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  // (the crackle: a burst of grains, uneven, bright)
  const n = noise(a, 0.12, (x) => (Math.random() < 0.35 ? 1 : 0.25) * Math.pow(1 - x, 1.6), 0.1)
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 900; f.Q.value = 0.9
  const g = a.createGain(); g.gain.value = 0.12
  n.connect(f).connect(g).connect(a.destination)
  n.start(t)
  // (the knock)
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(150 + Math.random() * 30, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.08)
  const k = a.createGain()
  k.gain.setValueAtTime(0, t); k.gain.linearRampToValueAtTime(0.09, t + 0.005); k.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(k).connect(a.destination)
  o.start(t); o.stop(t + 0.12)
}

/** a munch between bites: soft, wet, muffled */
export function chewSound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const n = noise(a, 0.09, (x) => Math.sin(Math.PI * x) ** 1.5, 0.75)
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + Math.random() * 400
  const g = a.createGain(); g.gain.value = 0.07
  n.connect(f).connect(g).connect(a.destination)
  n.start(t)
}
