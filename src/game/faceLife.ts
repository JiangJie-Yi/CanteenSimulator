/**
 * A face's life between its expressions (item 368, the owner's, 2026-11-19: 「人物表情實在很僵硬」: a face was one of eight pictures, swapped
 * in a frame; a blink every 3.4 s on the dot, one frame shut; the eyes never anywhere but straight ahead): what the eyes and the mouth are
 * doing at a moment, for any figure (the owner, the staff, the customers), each its own by its seed.
 *  - a blink closes and opens: half shut, shut, half shut, open (0.17 s in all), at no fixed beat (2 to 6 s apart), now and then twice;
 *  - a new face comes through a blink: the eyes close on the old one and open on the new (an animator's way of hiding the swap), never cut;
 *  - the eyes glance aside now and then while the figure's at ease, and go first where the head's turning;
 *  - a word said: the mouth in syllables, shut, a little open, wide, about six and a half to the second, with a beat's pause now and then.
 * Pure (no three, no React): the figures map what it says onto their pictures (scene/faceSheet's frames).
 */

/** a blink's parts (s): down to half, shut, up to half */
export const BLINK_HALF = 0.045
export const BLINK_SHUT = 0.08
export const BLINK_LEN = BLINK_HALF * 2 + BLINK_SHUT
/** between blinks (s), and how often one's a double */
export const BLINK_GAP: [number, number] = [2, 6]
export const DOUBLE_BLINK = 0.22
/** a glance aside: how long it's held, how long between (s) */
export const GLANCE_HOLD: [number, number] = [0.5, 1.4]
export const GLANCE_GAP: [number, number] = [2.5, 7.5]
/** the head turning faster than this (rad/s): the eyes look that way */
export const TURN_LOOK = 0.12
/** a syllable (s) */
export const SYLLABLE = 0.155

export type FaceLife = {
  seed: number
  /** a counter for the draws */
  n: number
  /** the blink under way since (s; -1 none), the next due at, one more to follow right after */
  blinkAt: number
  nextBlink: number
  again: boolean
  /** a glance aside: which way (-1, 0, 1), till when, the next at */
  look: -1 | 0 | 1
  lookUntil: number
  nextLook: number
  /** the way the last glance went (the next likelier the other way, as eyes come back across) */
  lastLook: -1 | 1
  /** the face shown, and the one wanted (shown once a blink's shut over the change) */
  shown: string
  want: string
}
/** a draw in 0..1 from the seed and the counter: the same figure, the same draws */
export const draw = (seed: number, n: number) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
const span = (r: [number, number], u: number) => r[0] + (r[1] - r[0]) * u

export function newFaceLife(seed: number, face = 'idle', t = 0): FaceLife {
  return { seed, n: 1, blinkAt: -1, nextBlink: t + span(BLINK_GAP, draw(seed, 0)), again: false, look: 0, lookUntil: 0, nextLook: t + span(GLANCE_GAP, draw(seed, 0.5)), lastLook: draw(seed, 0.25) < 0.5 ? -1 : 1, shown: face, want: face }
}

export type FaceMoment = {
  /** the face to show (a change waits for the eyes to close) */
  face: string
  /** where the eyelids are */
  blink: 'open' | 'half' | 'shut'
  /** a glance aside: -1 one way, 1 the other, 0 ahead */
  look: -1 | 0 | 1
  /** the mouth in a word: 0 shut, 1 a little open, 2 wide; 0 not talking */
  mouth: 0 | 1 | 2
}

/**
 * The face's moment at `t` s (moving `s` on): `want` the face the figure means (its mood, its work); `free` whether its eyes may wander (at
 * ease, not at a task, not talking); `turn` how fast its head's turning (rad/s, + one way); `talk` whether a word of its is up
 */
export function faceNow(s: FaceLife, t: number, want: string, o: { free?: boolean; turn?: number; talk?: boolean } = {}): FaceMoment {
  // ---- a change of face: a blink set off now (if none's under way that hasn't yet shut), the new face shown from its shut
  if (want !== s.want) {
    s.want = want
    if (s.blinkAt < 0 || t - s.blinkAt > BLINK_HALF) { s.blinkAt = t; s.again = false }
  }
  // ---- blinking at no fixed beat
  if (s.blinkAt < 0 && t >= s.nextBlink) {
    s.blinkAt = t
    s.again = draw(s.seed, s.n++) < DOUBLE_BLINK
  }
  let blink: FaceMoment['blink'] = 'open'
  if (s.blinkAt >= 0) {
    const u = t - s.blinkAt
    if (u >= BLINK_HALF && s.shown !== s.want) s.shown = s.want
    if (u < BLINK_HALF) blink = 'half'
    else if (u < BLINK_HALF + BLINK_SHUT) blink = 'shut'
    else if (u < BLINK_LEN) blink = 'half'
    else {
      // (over: a second straight after it, or the next a while off)
      s.nextBlink = s.again ? s.blinkAt + BLINK_LEN + 0.07 : t + span(BLINK_GAP, draw(s.seed, s.n++))
      s.again = false
      s.blinkAt = -1
    }
  }
  // ---- the eyes: first where the head's turning; at ease, a glance aside now and then
  let look: FaceMoment['look'] = 0
  if (o.talk || !o.free) { s.look = 0; s.nextLook = Math.max(s.nextLook, t + 1) }
  else if (Math.abs(o.turn ?? 0) > TURN_LOOK) look = (o.turn ?? 0) > 0 ? 1 : -1
  else {
    if (s.look !== 0 && t >= s.lookUntil) { s.look = 0; s.nextLook = t + span(GLANCE_GAP, draw(s.seed, s.n++)) }
    if (s.look === 0 && t >= s.nextLook) {
      s.look = draw(s.seed, s.n++) < 0.7 ? (-s.lastLook as -1 | 1) : s.lastLook
      s.lastLook = s.look
      s.lookUntil = t + span(GLANCE_HOLD, draw(s.seed, s.n++))
    }
    look = s.look
  }
  // ---- the mouth in a word: each syllable open in its middle, wide or a little by the draw, a beat's pause now and then
  let mouth: FaceMoment['mouth'] = 0
  if (o.talk) {
    const k = t / SYLLABLE + s.seed * 3.1, i = Math.floor(k), u = k - i, r = draw(s.seed + 7, i)
    if (r >= 0.12 && u > 0.15 && u < 0.8) mouth = r > 0.58 ? 2 : 1
  }
  return { face: s.shown, blink, look, mouth }
}
