import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2 } from 'three'

/**
 * A green frame-rate readout at the bottom left, with what's behind it: the frame's time, the draw calls and triangles
 * of the last frame, what's held in the GPU (geometries, textures, shader programs), the resolution it's drawn at, and
 * the memory the page uses where the browser says. It writes straight to its own element, once a half-second, so it costs
 * the frame nothing.
 */
const SIZE = new Vector2()
export function FpsMeter() {
  const gl = useThree((s) => s.gl)
  const el = useRef<HTMLDivElement | null>(null)
  const acc = useRef({ frames: 0, time: 0, worst: 0 })
  useEffect(() => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;left:10px;bottom:76px;z-index:60;pointer-events:none;font:11px/1.35 ui-monospace,Consolas,monospace;'
      + 'color:#39ff6a;background:rgba(0,0,0,0.55);padding:5px 8px;border-radius:6px;white-space:pre;text-shadow:0 0 2px #000'
    d.textContent = 'FPS …'
    document.body.appendChild(d)
    el.current = d
    return () => { d.remove(); el.current = null }
  }, [])
  useFrame((_, dt) => {
    const a = acc.current
    a.frames++
    a.time += dt
    a.worst = Math.max(a.worst, dt)
    if (a.time < 0.5 || !el.current) return
    const fps = a.frames / a.time
    const ms = (a.time / a.frames) * 1000
    const info = gl.info
    const size = gl.getDrawingBufferSize(SIZE)
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    el.current.textContent = [
      `FPS        ${fps.toFixed(0)}`,
      `Frame      ${ms.toFixed(1)} ms  (worst ${(a.worst * 1000).toFixed(0)} ms)`,
      `Draw calls ${info.render.calls}`,
      `Triangles  ${info.render.triangles.toLocaleString()}`,
      `Geometries ${info.memory.geometries}   Textures ${info.memory.textures}`,
      `Programs   ${info.programs?.length ?? 0}`,
      `Resolution ${size.x}x${size.y}  (dpr ${gl.getPixelRatio().toFixed(2)})`,
      mem ? `JS heap    ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
    ].filter(Boolean).join('\n')
    a.frames = 0
    a.time = 0
    a.worst = 0
  })
  return null
}
