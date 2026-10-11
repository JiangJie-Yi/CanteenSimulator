import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type StoveControlsProps = {
  url: string
  /** 0..100 */
  heat: number
}

const W = 256
const H = 88

/** Draws the stove's LCD: ghosted segments behind the reading, a 火力 label, OFF when the flame is out. */
function drawDisplay(ctx: CanvasRenderingContext2D, heat: number) {
  ctx.fillStyle = '#1d2a1f'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.font = 'bold 64px "Courier New", monospace'
  ctx.fillStyle = 'rgba(160, 220, 140, 0.1)'
  ctx.fillText('888', W - 52, H / 2 + 4)
  ctx.fillStyle = '#b9f59a'
  ctx.shadowColor = 'rgba(150, 255, 120, 0.8)'
  ctx.shadowBlur = 8
  ctx.fillText(heat === 0 ? 'OFF' : String(heat), W - 52, H / 2 + 4)
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'left'
  if (heat > 0) ctx.fillText('%', W - 46, H / 2 + 12)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('火力', 10, 20)
  ctx.shadowBlur = 0
}

/**
 * The cassette stove's live controls: the LCD (blender/hotpot.py "Display") shows the 火候 reading, and the
 * knob's pointer turns with it over the printed 270° scale, 小 at lower left to 大 at lower right.
 */
export function StoveControls({ url, heat }: StoveControlsProps) {
  const { scene } = useGLTF(url)

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return c
  }, [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])

  useEffect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawDisplay(ctx, heat)
    texture.needsUpdate = true
  }, [canvas, texture, heat])

  // the screen sits just in front of the modelled display, sized to it
  const screen = useMemo(() => {
    const display = scene.getObjectByName('Display')
    if (!display) return null
    const box = new THREE.Box3().setFromObject(display)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    return { position: [centre.x, centre.y, box.max.z + 0.002] as [number, number, number], size: [size.x, size.y] }
  }, [scene])

  // knob pointer: remember where it was modelled (pointing straight up = halfway) and swing it about the knob
  const knob = useMemo(() => {
    const k = scene.getObjectByName('Knob')
    const mark = scene.getObjectByName('KnobMark')
    if (!k || !mark) return null
    return { mark, centre: k.position.clone(), offset: mark.position.clone().sub(k.position), baseQ: mark.quaternion.clone() }
  }, [scene])
  const angle = useRef((135 * Math.PI) / 180)
  useFrame((_, delta) => {
    if (!knob) return
    const target = ((135 - 270 * (heat / 100)) * Math.PI) / 180
    angle.current += (target - angle.current) * Math.min(1, delta * 10)
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle.current)
    knob.mark.position.copy(knob.offset).applyQuaternion(turn).add(knob.centre)
    knob.mark.quaternion.copy(knob.baseQ).premultiply(turn)
  })

  if (!screen) return null
  return (
    <mesh position={screen.position}>
      <planeGeometry args={[screen.size[0], screen.size[1]]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
