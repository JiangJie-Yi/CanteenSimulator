import { useEffect, useRef } from 'react'
import { replaces } from '@/scene/hot'

// The interface's own sounds, made on the spot with WebAudio (no recordings; the owner's: every panel heard as it opens and as it shuts): a
// soft papery swish, a band of noise sweeping up as the panel comes out and down as it goes back, and a light wooden tick as it settles.

let ac: AudioContext | null = null
function ctx() {
  if (!ac) { try { ac = new AudioContext() } catch { ac = null } }
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
