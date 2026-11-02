/**
 * When the 3D view is drawn more lightly because the machine can't keep up, and when it's given back (scene/FramePacer acts on it; BDD
 * frame-pace).
 *
 * It judges by the typical frame (the median) of a few seconds at a time, so a hitch now and then (something loading, a shader compiled the
 * first time it's seen, a customer's figure built) doesn't count; not at all while the page has just opened, nor for a while after something
 * big (the shop opening or shutting, the speed changed, the developer mode on or off, a hot update): those are slow for a moment, and that's
 * no measure of the machine. It steps down only when two stretches in a row are slow: first to one canvas pixel per screen pixel, then
 * holding it to a steady 30 a second (an even 30 looks smoother than a stuttering 40). And it steps back up: drawn lightly, if it's been
 * fast a good while it goes back to the full resolution (a longer while each time it's gone back, so it doesn't see-saw); held to 30, it
 * tries going without now and then (if the try's still slow, it holds again and waits twice as long before the next).
 *
 * Before, it stepped down for good, once a stretch of two and a half seconds had been slow: the shop opening was enough (its figures built,
 * its shaders compiled), and the rest of the session was drawn coarse and held to 30, on a machine that runs it at 60.
 *
 * The state is changed in place: it's run every frame.
 */

export const PACE = {
  /** below this many frames a second (the typical frame of a stretch) it's lagging */
  LAG_FPS: 40,
  /** at this many or more, drawn lightly, it's keeping up with room to spare */
  GOOD_FPS: 55,
  /** how long a stretch is that's judged (s) */
  WINDOW_S: 2.5,
  /** not judged at all for this long after the page opens (s): its models coming in, its shaders compiled the first time each is seen */
  WARMUP_S: 10,
  /** nor for this long after something big (s) */
  HOLD_S: 6,
  /** a frame this long (s) is a hitch, not the drawing being slow: the stretch starts over */
  HITCH_S: 0.25,
  /** stretches in a row that must be slow before it steps down */
  SLOW_WINDOWS: 2,
  /** stretches in a row that must be fast before it goes back to the full resolution (twice as many each time it's gone back before) */
  FAST_WINDOWS: 4,
  /** how long it's held to 30 before it first tries going without (s; twice as long after each try that's still slow) */
  TRY_S: 30,
} as const

export type Pace = {
  /** 0 as the page asks; 1 one canvas pixel per screen pixel; 2 that, and held to 30 a second */
  level: 0 | 1 | 2
  /** its own clock (s): the real time it's been running */
  clock: number
  /** not judged till then (its clock): the page just opened, or something big just happened */
  holdTill: number
  /** this stretch's frames (s) and how long it's been */
  frames: number[]
  span: number
  /** stretches in a row that were slow, and (drawn lightly) fast */
  slow: number
  fast: number
  /** times it has gone back to the full resolution, and tried going without the 30 and found it still slow */
  ups: number
  fails: number
  /** held to 30, when it next tries going without (its clock) */
  tryAt: number
  /** this stretch is such a try */
  trying: boolean
  /** the last stretch judged: its typical frames a second */
  fps: number
}

export const newPace = (): Pace => ({ level: 0, clock: 0, holdTill: PACE.WARMUP_S, frames: [], span: 0, slow: 0, fast: 0, ups: 0, fails: 0, tryAt: Infinity, trying: false, fps: 0 })

/** something big has just happened: not judged for a while (`s` seconds), and the stretch so far thrown away */
export function holdPace(p: Pace, s: number = PACE.HOLD_S) {
  p.holdTill = Math.max(p.holdTill, p.clock + s)
  p.frames.length = 0
  p.span = 0
  p.slow = 0
  p.fast = 0
}

/** a frame of `dt` real seconds: 'down' when it's just stepped down, 'up' when it's just stepped up (`level` is where it is now) */
export function paceFrame(p: Pace, dt: number): 'down' | 'up' | null {
  p.clock += Math.min(dt, 0.5)
  if (p.clock < p.holdTill) return null
  if (dt > PACE.HITCH_S) { p.frames.length = 0; p.span = 0; return null }
  p.frames.push(dt)
  p.span += dt
  if (p.span < PACE.WINDOW_S) return null
  p.frames.sort((a, b) => a - b)
  const fps = 1 / p.frames[p.frames.length >> 1]
  p.fps = fps
  p.frames.length = 0
  p.span = 0
  // (a try without the 30: kept if it's keeping up, held again if not, and the next try twice as far off)
  if (p.trying) {
    p.trying = false
    if (fps >= PACE.LAG_FPS) return null
    p.level = 2
    p.fails++
    p.tryAt = p.clock + PACE.TRY_S * 2 ** p.fails
    return 'down'
  }
  // (held to 30, every stretch is 30: nothing to judge but when to try going without)
  if (p.level === 2) {
    if (p.clock < p.tryAt) return null
    p.level = 1
    p.trying = true
    p.slow = 0
    p.fast = 0
    return 'up'
  }
  if (fps < PACE.LAG_FPS) {
    p.fast = 0
    if (++p.slow < PACE.SLOW_WINDOWS) return null
    p.slow = 0
    p.level = p.level === 0 ? 1 : 2
    if (p.level === 2) p.tryAt = p.clock + PACE.TRY_S * 2 ** p.fails
    return 'down'
  }
  p.slow = 0
  if (p.level === 1 && fps >= PACE.GOOD_FPS) {
    if (++p.fast < PACE.FAST_WINDOWS * 2 ** p.ups) return null
    p.fast = 0
    p.ups++
    p.level = 0
    return 'up'
  }
  p.fast = 0
  return null
}
