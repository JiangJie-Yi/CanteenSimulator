import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** below this many frames a second (averaged over a couple of seconds) the view is lagging */
const LAG_FPS = 40
/** how long it's watched before each step down (s) */
const WINDOW_S = 2.5
/** the frame rate it's held to once it's still lagging on a lighter canvas */
const CAP_FPS = 30

/**
 * Keeps the 3D view smooth on a machine that can't keep up: when the frame rate stays low it first draws the canvas
 * at one pixel per screen pixel, and if that isn't enough holds it to a steady 30 frames a second (an even 30 looks
 * smoother than a stuttering 40, and leaves the machine room). It only steps down, once each, for the session.
 */
export function FramePacer() {
  const { setDpr, setFrameloop, advance } = useThree()
  const level = useRef(0)
  const frames = useRef(0)
  const since = useRef(0)
  const capped = useRef(false)

  useFrame((_, dt) => {
    if (level.current >= 2 || document.hidden) return
    // (a long gap is the tab coming back, or loading: not the drawing being slow)
    if (dt > 0.5) return
    frames.current++
    since.current += dt
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

  // held to 30: the loop is ours, drawing a frame only once a frame's time has gone by
  useEffect(() => {
    let raf = 0
    let last = 0
    let on = false
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (!capped.current) return
      if (!on) {
        on = true
        setFrameloop('never')
      }
      if (t - last < 1000 / CAP_FPS - 2) return
      last = t
      advance(t)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (on) setFrameloop('always')
    }
  }, [setFrameloop, advance])
  return null
}
