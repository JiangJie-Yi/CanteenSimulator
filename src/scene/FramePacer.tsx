import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GAME_SPEED } from './speed'

/** below this many frames a second (averaged over a couple of seconds) the view is lagging */
const LAG_FPS = 40
/** how long it's watched before each step down (s) */
const WINDOW_S = 2.5
/** the frame rate it's held to once it's still lagging on a lighter canvas */
const CAP_FPS = 30
/** the longest step the game takes in one frame (s): a stall (a hidden tab, a hitch) isn't a leap forward */
const MAX_STEP = 0.1

/**
 * Drives the 3D view's clock, and keeps it smooth on a machine that can't keep up.
 *
 * - Lagging: when the frame rate stays low it first draws the canvas at one pixel per screen pixel, and if that isn't
 *   enough holds it to a steady 30 frames a second (an even 30 looks smoother than a stuttering 40). It only steps
 *   down, once each, for the session.
 * - Game speed (GAME_SPEED, the ×2 button): the loop is run by hand, the game's clock moving on at that many times
 *   the real one, so everything in the scene (cooking, customers, servers) goes that much faster together.
 *
 * Either way, once the loop's ours each frame's real time is measured in seconds and clamped, so the clock never
 * jumps.
 */
export function FramePacer() {
  const { setDpr, setFrameloop, advance, clock } = useThree()
  const level = useRef(0)
  const frames = useRef(0)
  const since = useRef(0)
  const capped = useRef(false)

  useFrame((_, dt) => {
    if (level.current >= 2 || document.hidden) return
    // (a long gap is the tab coming back, or loading: not the drawing being slow; and at ×2 the clock runs faster
    // than the frames come, so it's real frames per real second that are counted)
    const real = dt / GAME_SPEED.value
    if (real > 0.5) return
    frames.current++
    since.current += real
    if (since.current < WINDOW_S) return
    const fps = frames.current / since.current
    frames.current = 0
    since.current = 0
    if (fps >= LAG_FPS) return
    level.current++
    if (level.current === 1) setDpr(1)
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
