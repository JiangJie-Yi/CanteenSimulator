// The shrine's sounds, made on the spot with WebAudio (no recordings): the blessing coming down as the offering's taken (a temple bowl's long
// ring under a fall of small bright bells and a breath of air), and the shrine's little doors (their pins creaking by stick-slip friction
// through a hinoki panel's resonances, the latch, a knock as they stop or meet).

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

/**
 * A creak, made as friction makes it (after the stick-slip door in "Designing Sound", Farnell, as worked in SuperCollider): the pin
 * sticks till the force on it builds enough to slip, slips with a click as loud as the force that built, and sticks again; the harder
 * it's pushed the quicker the slips come (1 to ~330 a second), their timing a little unsteady. `force` (0..1) along the sound's length.
 */
function stickSlip(a: AudioContext, len: number, force: (x: number) => number) {
  const sr = a.sampleRate
  const b = a.createBuffer(1, Math.round(sr * len), sr)
  const d = b.getChannelData(0)
  let phase = 0, build = 0, env = 0, fall = 0, jit = 0, jitTo = 0
  for (let i = 0; i < d.length; i++) {
    const f = force(i / d.length)
    // (the unsteadiness: a slow wander of the slip rate, from half to twice)
    if (i % Math.round(sr / 50) === 0) jitTo = Math.random() * 2 - 1
    jit += (jitTo - jit) * (50 / sr) * 3
    build = Math.min(1, build + 10 / sr)
    if (f > 0.1) {
      phase += ((1 + ((f - 0.1) / 0.9) * 332) * 2 ** (jit * jit * Math.sign(jit))) / sr
      if (phase >= 1) {
        phase -= 1
        env = Math.sqrt(build) * Math.min(1, f * 1.6)
        fall = Math.exp(-1 / (Math.sqrt(env + 1e-4) * 0.01 * sr))
        build = 0
      }
    }
    d[i] = env * (0.75 + 0.25 * Math.random())
    env *= fall
  }
  const n = a.createBufferSource()
  n.buffer = b
  return n
}

/** what a small panel of hinoki does to a sound in it: the wood's own formants (a bank of band-passes), then the panel's quick echoes */
function woodPanel(a: AudioContext, out: AudioNode, k: number, gain: number) {
  const inp = a.createGain()
  const body = a.createGain()
  const dry = a.createGain()
  dry.gain.value = 0.2
  inp.connect(dry).connect(body)
  ;[62.5, 125, 250, 395, 560, 790].forEach((f, i) => {
    const bp = a.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f * k
    bp.Q.value = [1, 1, 2, 2, 3, 3][i]
    inp.connect(bp).connect(body)
  })
  const mix = a.createGain()
  mix.gain.value = 1 / 8
  for (const ms of [4.52, 5.06, 6.27, 8, 5.48, 7.14, 10.12, 16]) {
    const dl = a.createDelay(0.05)
    dl.delayTime.value = (ms / 1000) / k
    body.connect(dl).connect(mix)
  }
  const hp = a.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 125 * k
  const g = a.createGain()
  g.gain.value = gain
  mix.connect(hp).connect(g).connect(out)
  return inp
}

/** a knock of hinoki on hinoki: a tick of noise ringing the wood's few modes, short and dry */
function knock(a: AudioContext, out: AudioNode, t: number, pitch: number, gain: number) {
  const tick = noise(a, 0.012, (x) => (1 - x) ** 3)
  const g = a.createGain()
  g.gain.value = gain
  g.connect(out)
  ;[[480, 8, 1], [1150, 10, 0.7], [2100, 12, 0.45], [3300, 14, 0.25]].forEach(([f, q, v]) => {
    const bp = a.createBiquadFilter(), bg = a.createGain()
    bp.type = 'bandpass'
    bp.frequency.value = f * pitch
    bp.Q.value = q
    bg.gain.value = v * 3
    tick.connect(bp).connect(bg).connect(g)
  })
  tick.start(t)
}

/** a little click of the doors' brass latch catching or letting go */
function latch(a: AudioContext, out: AudioNode, t: number, gain: number) {
  const c = noise(a, 0.006, (x) => (1 - x) ** 2)
  const hp = a.createBiquadFilter(), g = a.createGain()
  hp.type = 'highpass'
  hp.frequency.value = 3500
  g.gain.value = gain
  c.connect(hp).connect(g).connect(out)
  c.start(t)
  ring(a, out, t, 4700, gain * 0.05, 0.08)
  ring(a, out, t, 6900, gain * 0.03, 0.06)
}

/**
 * The shrine's little double doors (観音開き) swinging on their wooden pins. Opening: the latch lets go, the pins creak as the doors swing
 * out, slowing, and they knock softly against their stops. Closing: a quicker, higher creak as they're swung to, and the two leaves
 * meeting, one a moment after the other, the latch catching.
 */
export function shrineDoor(open: boolean) {
  try {
    const a = ctx()
    const t = a.currentTime + 0.01
    const out = a.createGain()
    out.gain.value = 0.7
    out.connect(a.destination)
    const panel = woodPanel(a, out, 2.4, 3.2)
    if (open) {
      latch(a, out, t, 0.5)
      // (the swing: the push builds, wavers, and eases off as the doors slow)
      const cr = stickSlip(a, 0.7, (x) => (x < 0.15 ? x / 0.15 : 1) * (1 - x) ** 0.6 * (0.5 + 0.06 * Math.sin(x * 23)))
      cr.connect(panel)
      cr.start(t + 0.04)
      knock(a, out, t + 0.76, 0.85, 0.35)
      knock(a, out, t + 0.8, 0.9, 0.12)
    } else {
      const cr = stickSlip(a, 0.42, (x) => Math.sin(Math.PI * Math.min(1, x * 1.2)) * (0.62 + 0.05 * Math.sin(x * 31)))
      cr.connect(panel)
      cr.start(t)
      knock(a, out, t + 0.44, 1.1, 0.7)
      knock(a, out, t + 0.475, 1.18, 0.5)
      latch(a, out, t + 0.5, 0.7)
    }
  } catch {
    // (no audio: silent)
  }
}
