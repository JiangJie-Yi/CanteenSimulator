import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/*
 * Eating a bowl of noodles (shop closed: tasting). A click on the noodles takes a mouthful: the heap of noodles
 * sinks and the soup goes down with it, and after the last mouthful the bowl counts as eaten. A click on a topping
 * (a slice of shank, an egg, greens…) eats that piece. Ordering a fresh bowl fills it back up.
 */

const MOUTHFULS = 6

type Props = {
  url: string
  /** the bowl ordered (its id), or none */
  base: string | null
  /** how good the bowl is (soup noodles a touch better hot) */
  taste: number
  active: boolean
  locked: boolean
  toppings: string[]
  onEat?: (id: string, taste: number) => void
}

export function NoodleEating({ url, base, taste, active, locked, toppings, onEat }: Props) {
  const { scene } = useGLTF(url)
  const { camera, gl } = useThree()
  const parts = useMemo(() => {
    const find = (name: string) => {
      let o: THREE.Object3D | undefined
      scene.traverse((x) => { if (!o && x.name.replace(/\d+$/, '') === name) o = x })
      return o
    }
    const noodles = find('Noodles')
    const broth = find('Broth')
    return {
      noodles, broth,
      n0: noodles ? { y: noodles.position.y, s: noodles.scale.clone() } : null,
      b0: broth ? { y: broth.position.y, s: broth.scale.clone() } : null,
    }
  }, [scene])
  const left = useRef(MOUTHFULS)
  const shown = useRef(MOUTHFULS)
  const eatenTops = useRef(new Set<string>())
  // a fresh bowl (or none): full again, every topping back
  useEffect(() => {
    left.current = MOUTHFULS
    eatenTops.current.forEach((uuid) => {
      const o = scene.getObjectByProperty('uuid', uuid)
      if (o) o.userData.shrink = 1
    })
    eatenTops.current.clear()
  }, [base, scene])

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || locked || !base) return
      down = null
      const r = el.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hits = ray.intersectObject(scene, true)
      for (const h of hits) {
        if (!h.object.visible) continue
        // a topping: eat that piece
        let o: THREE.Object3D | null = h.object
        while (o && !o.userData.itemId) o = o.parent
        if (o && toppings.includes(o.userData.itemId as string) && !eatenTops.current.has(o.uuid) && o.scale.x > 0.01) {
          eatenTops.current.add(o.uuid)
          o.userData.shrink = 0.0001
          onEat?.(o.userData.itemId as string, Math.round(taste + 3))
          return
        }
        // the noodles (or the bowl they're in): a mouthful
        if (left.current > 0) {
          left.current -= 1
          if (left.current === 0) onEat?.(base, taste)
        }
        return
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [active, gl, camera, scene, base, locked, toppings, taste, onEat])

  useFrame((_, dt) => {
    shown.current += (left.current - shown.current) * Math.min(1, dt * 5)
    const k = shown.current / MOUTHFULS
    const { noodles, broth, n0, b0 } = parts
    if (noodles && n0) {
      noodles.scale.set(n0.s.x * (0.75 + 0.25 * k), n0.s.y * Math.max(0.02, k), n0.s.z * (0.75 + 0.25 * k))
      noodles.position.y = n0.y - (1 - k) * 0.05
      if (k < 0.03) noodles.scale.setScalar(0.0001)
    }
    if (broth && b0) {
      // the soup drunk down as it goes, to a little left at the bottom
      broth.position.y = b0.y - (1 - k) * 0.1
      const w = 0.82 + 0.18 * k
      broth.scale.set(b0.s.x * w, b0.s.y, b0.s.z * w)
    }
  })
  return null
}
