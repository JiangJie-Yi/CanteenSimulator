import { useEffect, useRef } from 'react'
import { replaces } from '@/scene/hot'

// The interface's own sounds, made on the spot with WebAudio (no recordings; the owner's: every panel heard as it opens and as it shuts): a
// soft papery swish, a band of noise sweeping up as the panel comes out and down as it goes back, and a light wooden tick as it settles.

let ac: AudioContext | null = null
function ctx() {
  if (!ac) { try { ac = new AudioContext({ latencyHint: 'playback' }) } catch { ac = null } }
  // (still waking (the click that opened the panel is what wakes it): what's set going now is heard as soon as it's up)
  if (ac?.state === 'suspended') void ac.resume()
  return ac && ac.state !== 'closed' ? ac : null
}
if (typeof window !== 'undefined') {
  const go = () => { const a = ac ?? ctx(); if (a?.state === 'suspended') void a.resume() }
  window.addEventListener('pointerdown', go)
  // (let go of, with its sound, when a hot update swaps this module for a new copy)
  replaces(import.meta.hot, () => { window.removeEventListener('pointerdown', go); void ac?.close() })
}

/** when one was last heard: a panel opened shuts another (the office opened, the stock put away), and one swish is heard for the two */
let lastAt = -1
/** a panel coming out (`open`) or going back */
export function panelSound(open: boolean) {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (t - lastAt < 0.15) return
  lastAt = t
  const dur = 0.24
  // (the swish: soft noise, swelling and falling away, through a band that sweeps up opening, down shutting)
  const n = Math.max(1, Math.floor(a.sampleRate * dur))
  const buf = a.createBuffer(1, n, a.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    const x = i / n
    last = last * 0.35 + (Math.random() * 2 - 1) * 0.65
    d[i] = last * Math.sin(Math.PI * Math.min(1, x * 1.08)) ** 1.6
  }
  const s = a.createBufferSource()
  s.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(open ? 800 : 2800, t)
  f.frequency.exponentialRampToValueAtTime(open ? 2800 : 800, t + dur)
  const g = a.createGain()
  g.gain.value = 0.15
  s.connect(f).connect(g).connect(a.destination)
  s.start(t)
  // (the tick as it comes to rest: a little higher opening, a little duller shutting)
  const at = t + dur * 0.9
  const o = a.createOscillator()
  const og = a.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(open ? 1500 : 1050, at)
  o.frequency.exponentialRampToValueAtTime(open ? 900 : 620, at + 0.05)
  og.gain.setValueAtTime(0.0001, at)
  og.gain.linearRampToValueAtTime(open ? 0.06 : 0.08, at + 0.004)
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
  o.connect(og).connect(a.destination)
  o.start(at)
  o.stop(at + 0.08)
}

/** heard as `open` changes (not when it's first shown) */
export function usePanelSound(open: boolean) {
  const was = useRef(open)
  useEffect(() => {
    if (was.current === open) return
    was.current = open
    panelSound(open)
  }, [open])
}

/** the freezer's tab chosen (the owner's): a short soft hiss of its seal, and a light tick of ice over it */
export function frostSound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const n = Math.max(1, Math.floor(a.sampleRate * 0.22))
  const buf = a.createBuffer(1, n, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) { const x = i / n; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * x) ** 2 * (1 - x) }
  const src = a.createBufferSource(); src.buffer = buf
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500
  const g = a.createGain(); g.gain.value = 0.05
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
  for (const [dt, hz] of [[0.04, 3100], [0.11, 4200]] as const) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = hz
    const k = a.createGain()
    k.gain.setValueAtTime(0, t + dt); k.gain.linearRampToValueAtTime(0.035, t + dt + 0.003); k.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.09)
    o.connect(k).connect(a.destination); o.start(t + dt); o.stop(t + dt + 0.1)
  }
}

// ---- item 209 (the owner's, 2026-11-16: 「我要讓這遊戲看起來覺得好玩」): the good moments heard

/** one bell-like note: a sine and its octave, struck and dying away */
function bell(a: AudioContext, at: number, hz: number, vol: number, len: number) {
  for (const [mul, k] of [[1, 1], [2.01, 0.35], [3.02, 0.12]] as const) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = hz * mul
    const g = a.createGain()
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol * k, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(a.destination); o.start(at); o.stop(at + len + 0.02)
  }
}
/** a customer who loved it: two bright notes, rising (a little bell's 'ding-ling'); not more than one in a breath, however many at once */
let joyAt = -1
export function joySound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (t - joyAt < 0.35) return
  joyAt = t
  bell(a, t, 1318.5, 0.045, 0.5)
  bell(a, t + 0.09, 1760, 0.04, 0.7)
}
/** money in: a coin's light double ping */
let coinAt = -1
export function coinSound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (t - coinAt < 0.12) return
  coinAt = t
  bell(a, t, 2349, 0.022, 0.18)
  bell(a, t + 0.055, 3136, 0.02, 0.25)
}
/** the full house's stamp: a soft drum's thump as it comes down, the stamp's knock on the paper, then a little bell */
export function stampSound() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const o = a.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.28)
  const g = a.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45)
  const n = Math.max(1, Math.floor(a.sampleRate * 0.05))
  const buf = a.createBuffer(1, n, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3
  const src = a.createBufferSource(); src.buffer = buf
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8
  const k = a.createGain(); k.gain.value = 0.12
  src.connect(f).connect(k).connect(a.destination); src.start(t + 0.02)
  bell(a, t + 0.3, 1046.5, 0.035, 0.9)
  bell(a, t + 0.42, 1568, 0.03, 1.1)
}
