// A tissue pulled from its box: a soft papery whisk, synthesised as it's heard (no sound files)
let audio: AudioContext | null = null

/** the sheet drawn up out of the slot: a short breath of filtered noise rising in pitch, and the faint snap as it comes free */
export function tissuePull() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const len = 0.32
    const buf = audio.createBuffer(1, Math.round(audio.sampleRate * len), audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length
      // (swelling in and dying away, a little crinkle through it)
      d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.25)), 1.5) * (0.75 + 0.25 * Math.sin(x * 140))
    }
    const n = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain()
    n.buffer = buf
    f.type = 'bandpass'
    f.Q.value = 0.9
    f.frequency.setValueAtTime(1400, t)
    f.frequency.exponentialRampToValueAtTime(5200, t + len * 0.85)
    g.gain.value = 0.11
    n.connect(f).connect(g).connect(audio.destination)
    n.start(t)
    // (the snap as it comes free of the slot)
    const s = audio.createBufferSource(), sf = audio.createBiquadFilter(), sg = audio.createGain()
    const sb = audio.createBuffer(1, Math.round(audio.sampleRate * 0.03), audio.sampleRate)
    const sd = sb.getChannelData(0)
    for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (1 - i / sd.length)
    s.buffer = sb
    sf.type = 'highpass'
    sf.frequency.value = 2500
    sg.gain.value = 0.06
    s.connect(sf).connect(sg).connect(audio.destination)
    s.start(t + len * 0.8)
  } catch { /* (no sound to be had) */ }
}
