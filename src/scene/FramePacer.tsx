import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GAME_SPEED } from './speed'

/** below this many frames a second (the typical frame over a couple of seconds) the view is lagging */
const LAG_FPS = 40
/** how long it's watched before each step down (s) */
const WINDOW_S = 2.5
/** how long after it starts before it judges at all (s): while the shop's still loading (its models coming in, its shaders compiled the
 * first time each is seen) the frames come slow and uneven, and that's no measure of the machine */
const WARMUP_S = 10
/** a frame this long (s) is a hitch (something loading, a shader compiling), not the drawing being slow: the window starts over */
const HITCH_S = 0.25
/** the frame rate it's held to once it's still lagging on a lighter canvas */
const CAP_FPS = 30
/** the longest step the game takes in one frame (s): a stall (a hidden tab, a hitch) isn't a leap forward */
const MAX_STEP = 0.1
/** ?pace=0: never steps down (for measuring how heavy a view is) */
const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).get('pace') === '0'

/** the resolution the pacer has stepped the 3D view down to (null: as the page asks for it), for the Canvas's own `dpr` to follow
 * (usePacedDpr). Given anything else, R3F set the canvas back to it each time the page redrew, several times a second while the shop's
 * open, and the pacer down again each frame after: the canvas flicking between the two resolutions, reallocated each time (the owner saw
 * the screen flickering, only with the shop open, on a machine slow enough for the pacer to have stepped in) */
let paced: number | null = null
const pacedSubs = new Set<() => void>()
const pace = (dpr: number) => {
  if (paced === dpr) return
  paced = dpr
  pacedSubs.forEach((f) => f())
}
export const usePacedDpr = () => useSyncExternalStore((f) => { pacedSubs.add(f); return () => { pacedSubs.delete(f) } }, () => paced, () => null)

/**
 * Drives the 3D view's clock, and keeps it smooth on a machine that can't keep up.
 *
 * - Lagging: when the frame rate stays low it first draws the canvas at one pixel per screen pixel, and if that isn't
 *   enough holds it to a steady 30 frames a second (an even 30 looks smoother than a stuttering 40). It only steps
 *   down, once each, for the session; it judges by the typical frame (the median, so a hitch now and then doesn't count), and not
 *   until the shop's had time to load.
 * - Game speed (GAME_SPEED, the ×2 button): the loop is run by hand, the game's clock moving on at that many times
 *   the real one, so everything in the scene (cooking, customers, servers) goes that much faster together.
 *
 * Either way, once the loop's ours each frame's real time is measured in seconds and clamped, so the clock never
 * jumps.
 */
export function FramePacer() {
  const { setDpr, setFrameloop, advance, clock, gl } = useThree()
  const level = useRef(0)
  const times = useRef<number[]>([])
  const since = useRef(0)
  const age = useRef(0)
  const capped = useRef(false)

  useFrame((_, dt) => {
    // (stepped down to one pixel per screen pixel, it stays there: the Canvas's dpr follows it, usePacedDpr)
    if (level.current >= 1 && gl.getPixelRatio() !== 1) { pace(1); setDpr(1) }
    if (OFF || level.current >= 2 || document.hidden) return
    // (a long gap is the tab coming back, or loading: not the drawing being slow; and at ×2 the clock runs faster
    // than the frames come, so it's real frames per real second that are counted)
    const real = dt / GAME_SPEED.value
    age.current += Math.min(real, 0.5)
    if (age.current < WARMUP_S) return
    if (real > HITCH_S) { times.current = []; since.current = 0; return }
    times.current.push(real)
    since.current += real
    if (since.current < WINDOW_S) return
    const sorted = times.current.sort((a, b) => a - b)
    const fps = 1 / sorted[sorted.length >> 1]
    times.current = []
    since.current = 0
    if (fps >= LAG_FPS) return
    level.current++
    if (level.current === 1) { pace(1); setDpr(1) }
    else capped.current = true
    if (import.meta.env.DEV) console.info(`[pacer] ${fps.toFixed(0)} fps: step ${level.current}`)
  })

  // the loop run by hand (held to 30, or the game sped up): a frame drawn only once a frame's time has gone by, the
  // game's clock (in seconds) moved on by that much, times the game's speed
  useEffect(() => {
    let raf = 0
    let last = 0
    let game = 0
    let manual = false
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const want = capped.current || GAME_SPEED.value !== 1
      if (want !== manual) {
        manual = want
        last = t
        // (carrying on from the scene's own clock; and handing it back with its last tick set to now, so its next
        // step isn't the whole time since it started)
        game = clock.elapsedTime
        if (!want) clock.oldTime = performance.now()
        setFrameloop(want ? 'never' : 'always')
      }
      if (!manual) return
      if (capped.current && t - last < 1000 / CAP_FPS - 2) return
      const step = Math.min(MAX_STEP, Math.max(0, (t - last) / 1000))
      last = t
      game += step * GAME_SPEED.value
      advance(game)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (manual) {
        clock.oldTime = performance.now()
        setFrameloop('always')
      }
    }
  }, [setFrameloop, advance, clock])
  return null
}
