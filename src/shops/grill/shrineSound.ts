// The shrine's sounds, made on the spot with WebAudio (no recordings): the blessing coming down as the offering's taken (a temple bowl's long
// ring under a fall of small bright bells and a breath of air), and the shrine's little doors (a dry wooden creak, a soft knock as they stop).

let audio: AudioContext | null = null
const ctx = () => (audio ??= new AudioContext())

function noise(a: AudioContext, len: number, shape: (x: number) => number) {
  const b = a.createBuffer(1, Math.round(a.sampleRate * len), a.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * shape(i / d.length)
  const n = a.createBufferSource()
  n.buffer = b
  return n
}
/** a struck partial: a sine at `f`, up at once, ringing away over `len` seconds */
function ring(a: AudioContext, out: AudioNode, t: number, f: number, g: number, len: number, detune = 0) {
  const o = a.createOscillator(), v = a.createGain()
  o.type = 'sine'
  o.frequency.value = f
  o.detune.value = detune
  v.gain.setValueAtTime(0, t)
  v.gain.linearRampToValueAtTime(g, t + 0.006)
  v.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.connect(v).connect(out)
  o.start(t)
  o.stop(t + len + 0.05)
}

/** the blessing: a temple bowl (りん) struck once, its partials beating as they ring, and a cascade of little bells over it, a soft rush of air */
export function blessingChime() {
  try {
    const a = ctx()
    const t = a.currentTime + 0.02
    const out = a.createGain()
    out.gain.value = 0.55
    out.connect(a.destination)
    // (the bowl: its inharmonic partials, each a pair a hair apart so they beat)
    for (const [f, g, len] of [[523, 0.22, 4.5], [1408, 0.1, 3.2], [2650, 0.05, 2.2], [4230, 0.025, 1.4]] as [number, number, number][]) {
      ring(a, out, t, f, g, len)
      ring(a, out, t, f * 1.004, g * 0.7, len * 0.9)
    }
    // (the small bells: a quick fall down a pentatonic run, each a bright partial pair)
    const notes = [2637, 2349, 1976, 1760, 1568, 1319, 1175]
    notes.forEach((f, k) => {
      const tk = t + 0.35 + k * 0.09 + Math.random() * 0.02
      ring(a, out, tk, f, 0.05, 1.4)
      ring(a, out, tk, f * 2.76, 0.015, 0.6)
    })
    // (a breath of air rising under it all)
    const air = noise(a, 2.2, (x) => Math.sin(Math.PI * x) ** 2)
    const af = a.createBiquadFilter(), ag = a.createGain()
    af.type = 'bandpass'
    af.frequency.setValueAtTime(600, t)
    af.frequency.exponentialRampToValueAtTime(4200, t + 2)
    af.Q.value = 0.7
    ag.gain.value = 0.06
    air.connect(af).connect(ag).connect(out)
    air.start(t)
  } catch {
    // (no audio: silent)
  }
}

/** the shrine's doors swinging: a dry creak of the wooden pins, and as they stop, a soft knock (opening) or a closing clack */
export function shrineDoor(open: boolean) {
  try {
    const a = ctx()
    const t = a.currentTime + 0.01
    const out = a.createGain()
    out.gain.value = 0.5
    out.connect(a.destination)
    // (the creak: a narrow band of rough noise, its pitch sliding as the door turns)
    const cr = noise(a, 0.45, (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 90)))
    const cf = a.createBiquadFilter(), cg = a.createGain()
    cf.type = 'bandpass'
    cf.Q.value = 9
    cf.frequency.setValueAtTime(open ? 700 : 1100, t)
    cf.frequency.linearRampToValueAtTime(open ? 1100 : 650, t + 0.45)
    cg.gain.value = 0.5
    cr.connect(cf).connect(cg).connect(out)
    cr.start(t)
    // (the stop: a hollow wooden knock, lower and softer for opening, sharper for the doors meeting)
    const tk = t + 0.42
    const kn = noise(a, 0.08, (x) => (1 - x) ** 5)
    const kf = a.createBiquadFilter(), kg = a.createGain()
    kf.type = 'bandpass'
    kf.frequency.value = open ? 420 : 900
    kf.Q.value = 2
    kg.gain.value = open ? 0.5 : 0.8
    kn.connect(kf).connect(kg).connect(out)
    kn.start(tk)
    ring(a, out, tk, open ? 210 : 320, 0.12, 0.18)
  } catch {
    // (no audio: silent)
  }
}
