// A press heard (item 320, the owner's, 2026-11-18: 「整體的回饋感需要提升」): a soft wooden tick under the finger, for a button pressed
// (ui/pressFeel) and for something in the shop clicked (scene/hoverGlow). Short and quiet, felt more than heard; never two within 60 ms (a
// press that opens a panel has the panel's own sound too). Made on the spot with WebAudio, through the effects' one switch (scene/sfx).
import { replaces } from './hot'

let ac: AudioContext | null = null
function ctx() {
  if (!ac) { try { ac = new AudioContext({ latencyHint: 'interactive' }) } catch { ac = null } }
  if (ac?.state === 'suspended') void ac.resume()
  return ac && ac.state !== 'closed' ? ac : null
}
replaces(import.meta.hot, () => { void ac?.close() })

let lastAt = -1
/** the tick: a little higher and brighter for a button (`kind` 'ui'), a little lower and woodier for a thing in the shop ('thing') */
export function tapSound(kind: 'ui' | 'thing' = 'ui') {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  if (t - lastAt < 0.06) return
  lastAt = t
  const o = a.createOscillator(), g = a.createGain()
  o.type = 'triangle'
  const f0 = kind === 'ui' ? 1500 : 1100
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.035)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(kind === 'ui' ? 0.04 : 0.05, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 0.07)
}
