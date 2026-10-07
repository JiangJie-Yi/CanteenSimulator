// Chewing sound, synthesised on the fly with Web Audio so there's no audio file to ship: a run of short crunchy
// bursts (band-passed noise) over a soft low thump for each bite, slightly different every time.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Play `bites` chews spaced over about `seconds`. Safe to call from a click handler (unlocks audio). */
export function playChew(bites = 4, seconds = 1.2) {
  const ac = audio()
  if (!ac || !noise) return
  const start = ac.currentTime + 0.02
  for (let i = 0; i < bites; i++) {
    const t = start + (i / bites) * seconds + Math.random() * 0.05
    // crunch: two or three quick noise grains per bite
    const grains = 2 + Math.floor(Math.random() * 2)
    for (let g = 0; g < grains; g++) {
      const tg = t + g * (0.03 + Math.random() * 0.03)
      const src = ac.createBufferSource()
      src.buffer = noise
      src.playbackRate.value = 0.8 + Math.random() * 0.5
      const band = ac.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 900 + Math.random() * 1400
      band.Q.value = 0.9
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, tg)
      gain.gain.linearRampToValueAtTime(0.35 + Math.random() * 0.2, tg + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.001, tg + 0.07 + Math.random() * 0.05)
      src.connect(band).connect(gain).connect(ac.destination)
      src.start(tg, Math.random() * 0.1, 0.15)
    }
    // jaw closing: a short low thump
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08)
    const thump = ac.createGain()
    thump.gain.setValueAtTime(0, t)
    thump.gain.linearRampToValueAtTime(0.18, t + 0.01)
    thump.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(thump).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.12)
  }
}
