// The shrine's sounds, made on the spot with WebAudio (no recordings): the blessing coming down as the offering's taken (a temple bowl's long
// ring under a fall of small bright bells and a breath of air), and the shrine's little doors (the latch, their wooden pins turning with a
// soft dry brush and a few faint ticks through a hinoki panel's resonances, a knock as they stop or meet).

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

/** the doors' wooden pins turning in their sockets: a soft dry brush of noise, darker as the swing slows (`pitch` a little higher, closing) */
function rub(a: AudioContext, out: AudioNode, t: number, len: number, gain: number, pitch: number) {
  const n = noise(a, len, (x) => Math.sin(Math.PI * Math.min(1, x * 1.3)) ** 1.5 * (0.75 + 0.25 * Math.random()))
  const bp = a.createBiquadFilter(), lp = a.createBiquadFilter(), g = a.createGain()
  bp.type = 'bandpass'
  bp.Q.value = 1.1
  bp.frequency.setValueAtTime(1300 * pitch, t)
  bp.frequency.linearRampToValueAtTime(850 * pitch, t + len)
  lp.type = 'lowpass'
  lp.frequency.value = 3200
  g.gain.value = gain
  n.connect(bp).connect(lp).connect(g).connect(out)
  n.start(t)
}

/**
 * The shrine's little double doors (観音開き) on their wooden pins, as small light doors sound (the owner found the old creak odd: a long
 * buzzing squeak, a hundred and fifty slips a second through the panel). Opening: the latch lets go, the pins turn with a soft dry brush and
 * a few faint ticks of the wood, and the leaves come gently to their stops, one a moment after the other. Closing: the brush, a little
 * higher and quicker, the two leaves meeting with a soft knock, and the latch catching.
 */
export function shrineDoor(open: boolean) {
  try {
    const a = ctx()
    const t = a.currentTime + 0.01
    const out = a.createGain()
    out.gain.value = 0.6
    out.connect(a.destination)
    const panel = woodPanel(a, out, 2.4, 1.4)
    if (open) {
      latch(a, out, t, 0.32)
      rub(a, out, t + 0.03, 0.26, 0.11, 1)
      // (a few faint ticks of the pins as they give: friction's slips, slow and soft, not a creak)
      const ticks = stickSlip(a, 0.24, (x) => 0.16 * Math.sin(Math.PI * x))
      ticks.connect(panel)
      ticks.start(t + 0.05)
      knock(a, out, t + 0.31, 0.82, 0.16)
      knock(a, out, t + 0.355, 0.88, 0.1)
    } else {
      rub(a, out, t, 0.2, 0.1, 1.15)
      knock(a, out, t + 0.21, 1.05, 0.3)
      knock(a, out, t + 0.24, 1.12, 0.2)
      latch(a, out, t + 0.28, 0.42)
    }
  } catch {
    // (no audio: silent)
  }
}

/**
 * Sake poured from the flask into one of the little cups (the owner's): a thin stream's trickle, its note rising as the cup fills (a small
 * cup's ring going up as the space in it shrinks), a few soft glugs from the flask's neck; `len` how long this cup's pour lasts (s), `level`
 * how loud for how near the camera is (0..1), `pan` where it is across the picture (-1 left .. 1 right)
 */
export function pourSake(len: number, level: number, pan: number) {
  try {
    const a = ctx()
    const t = a.currentTime + 0.01
    const out = a.createGain()
    out.gain.value = 0.32 * Math.max(0, Math.min(1, level))
    const p = a.createStereoPanner()
    p.pan.value = Math.max(-0.8, Math.min(0.8, pan))
    out.connect(p).connect(a.destination)
    // (the stream: noise through a narrow band whose middle climbs as the cup fills, its loudness easing in and away)
    const stream = noise(a, len + 0.1, (x) => Math.min(1, x * 12) * Math.min(1, (1 - x) * 6) * (0.75 + 0.25 * Math.sin(x * 70)))
    const band = a.createBiquadFilter(), band2 = a.createBiquadFilter(), sg = a.createGain()
    band.type = 'bandpass'; band.Q.value = 6
    band.frequency.setValueAtTime(900, t)
    band.frequency.exponentialRampToValueAtTime(2300, t + len)
    band2.type = 'highpass'; band2.frequency.value = 500
    sg.gain.value = 0.9
    stream.connect(band).connect(band2).connect(sg).connect(out)
    stream.start(t)
    // (the cup's own ring under it, rising with it)
    const o = a.createOscillator(), og = a.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(620, t)
    o.frequency.exponentialRampToValueAtTime(1250, t + len)
    og.gain.setValueAtTime(0, t)
    og.gain.linearRampToValueAtTime(0.035, t + 0.08)
    og.gain.setValueAtTime(0.035, t + len - 0.1)
    og.gain.linearRampToValueAtTime(0, t + len)
    o.connect(og).connect(out)
    o.start(t)
    o.stop(t + len + 0.05)
    // (a few glugs from the flask's neck: short falling blips, each a little higher than the last)
    const glugs = 2 + Math.floor(Math.random() * 2)
    for (let k = 0; k < glugs; k++) {
      const tk = t + 0.12 + (k + Math.random() * 0.4) * (len - 0.2) / glugs
      const g = a.createOscillator(), gg = a.createGain()
      const f0 = 260 + k * 60 + Math.random() * 30
      g.type = 'sine'
      g.frequency.setValueAtTime(f0 * 1.6, tk)
      g.frequency.exponentialRampToValueAtTime(f0, tk + 0.05)
      gg.gain.setValueAtTime(0, tk)
      gg.gain.linearRampToValueAtTime(0.09, tk + 0.008)
      gg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.09)
      g.connect(gg).connect(out)
      g.start(tk)
      g.stop(tk + 0.12)
    }
  } catch {
    // (no audio: silent)
  }
}
