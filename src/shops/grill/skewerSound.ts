// The iron skewers' sounds, synthesised as they're heard (no sound files): one pushed through the food on the board, one laid in the used
// skewers' tray, a handful dropped back into the holder
let audio: AudioContext | null = null

function noise(len: number, shape: (x: number) => number) {
  const buf = audio!.createBuffer(1, Math.max(1, Math.round(audio!.sampleRate * len)), audio!.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * shape(i / d.length)
  return buf
}

/** a metal ring (a few partials), struck at `at`, `gain` loud */
function ring(at: number, freq: number, gain: number, decay: number) {
  for (const [k, a] of [[1, 1], [2.76, 0.45], [5.4, 0.2]] as const) {
    const o = audio!.createOscillator(), g = audio!.createGain()
    o.frequency.value = freq * k
    g.gain.setValueAtTime(gain * a, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay / k)
    o.connect(g).connect(audio!.destination)
    o.start(at)
    o.stop(at + decay / k + 0.02)
  }
}

/** drawn from the holder, a bright metal shing (the steel sliding out past the others, a high ring), then pushed through the food: two or
 * three short firm scrapes, a little crisp at the end */
export function pierceSound() {
  try {
    audio ??= new AudioContext({ latencyHint: 'playback' })
    const t0 = audio.currentTime
    {
      const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain()
      s.buffer = noise(0.13, (x) => Math.sin(Math.PI * x) ** 0.6)
      f.type = 'bandpass'
      f.frequency.setValueAtTime(4800, t0)
      f.frequency.linearRampToValueAtTime(7200, t0 + 0.13)
      f.Q.value = 3
      g.gain.value = 0.045
      s.connect(f).connect(g).connect(audio.destination)
      s.start(t0)
      ring(t0 + 0.12, 3600, 0.01, 0.25)
    }
    const t = t0 + 0.16
    for (let k = 0; k < 3; k++) {
      const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain()
      s.buffer = noise(0.07, (x) => Math.sin(Math.PI * x))
      f.type = 'bandpass'
      f.frequency.value = 2200 + k * 500
      f.Q.value = 1.4
      g.gain.value = 0.05
      s.connect(f).connect(g).connect(audio.destination)
      s.start(t + k * 0.16)
    }
    ring(t + 0.46, 2400, 0.012, 0.18)
  } catch { /* (no sound to be had) */ }
}

/** laid in the used skewers' tray: a bright clink */
export function clinkSound() {
  try {
    audio ??= new AudioContext({ latencyHint: 'playback' })
    ring(audio.currentTime, 1850 + Math.random() * 300, 0.03, 0.35)
  } catch { /* (no sound to be had) */ }
}

/** a handful dropped back in the holder: a short rattle of clinks */
export function rattleSound() {
  try {
    audio ??= new AudioContext({ latencyHint: 'playback' })
    const t = audio.currentTime
    for (let k = 0; k < 6; k++) ring(t + k * 0.035 + Math.random() * 0.02, 1500 + Math.random() * 900, 0.014, 0.25)
  } catch { /* (no sound to be had) */ }
}
