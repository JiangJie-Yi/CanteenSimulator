import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PACE, holdPace, newPace, paceFrame } from '@/game/framePace'
import { GAME_SPEED } from './speed'

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
const setPaced = (dpr: number | null) => {
  if (paced === dpr) return
  paced = dpr
  pacedSubs.forEach((f) => f())
}

/** something big has just happened (the shop opening or shutting, the speed changed, the developer mode on or off, the view flown
 * elsewhere): a moment of slow frames, its figures built and shaders compiled, and no measure of the machine; the pacer doesn't judge for
 * a while (`s` seconds) */
let heldFor = 0
export function holdPacer(s: number = PACE.HOLD_S) { heldFor = Math.max(heldFor, s) }
// (and after a hot update while the game's being worked on: parts of the scene built again, shaders compiled again)
if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', () => holdPacer(10))
export const usePacedDpr = () => useSyncExternalStore((f) => { pacedSubs.add(f); return () => { pacedSubs.delete(f) } }, () => paced, () => null)

/**
 * Drives the 3D view's clock, and keeps it smooth on a machine that can't keep up.
 *
 * - Lagging: when the frame rate stays low it first draws the canvas at one pixel per screen pixel, and if that isn't
 *   enough holds it to a steady 30 frames a second (an even 30 looks smoother than a stuttering 40); fast again a good while, it
 *   goes back (game/framePace: when, and why not sooner).
 * - Game speed (GAME_SPEED, the ×2 button): the loop is run by hand, the game's clock moving on at that many times
 *   the real one, so everything in the scene (cooking, customers, servers) goes that much faster together.
 *
 * Either way, once the loop's ours each frame's real time is measured in seconds and clamped, so the clock never
 * jumps.
 */
export function FramePacer() {
  const { setDpr, setFrameloop, advance, clock, gl } = useThree()
  const pace = useRef(newPace())
  const capped = useRef(false)
  // (the tab coming back: its first frames come slow)
  useEffect(() => {
    const back = () => { if (!document.hidden) holdPacer(3) }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [])

  useFrame((_, dt) => {
    const p = pace.current
    // (drawn lightly, it stays at one pixel per screen pixel: the Canvas's dpr follows it, usePacedDpr)
    if (p.level >= 1 && gl.getPixelRatio() !== 1) { setPaced(1); setDpr(1) }
    if (heldFor) { holdPace(p, heldFor); heldFor = 0 }
    if (OFF || document.hidden || GAME_SPEED.value === 0) return
    // (at ×2 the clock runs faster than the frames come: it's real frames per real second that are counted)
    const act = paceFrame(p, dt / GAME_SPEED.value)
    if (!act) return
    capped.current = p.level === 2
    if (p.level >= 1) { setPaced(1); setDpr(1) } else setPaced(null)
    if (import.meta.env.DEV) console.info(`[pacer] ${p.fps.toFixed(0)} fps: ${act === 'down' ? 'down' : 'back up'} to ${['the full resolution', 'one pixel per screen pixel', 'one pixel per screen pixel, held to 30 a second'][p.level]}`)
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
