import { memo, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { ALONG, LAY, nameOver } from './bar'

/**
 * The work counter's gas stove (item 461, the owner's, 2026-11-21: 「這邊要細修，電鍋往左移，右邊加一個瓦斯爐灶，用平底鍋來煎料。」;
 * blender/gasstove.py): a one-burner cassette stove right of the rice cooker (moved left up to the miso pot for it), its frying pan on it,
 * the square tamagoyaki pan hung on the rice-ball shelf's left post beside it. Its flame and its knob the game's (STOVE.on), the blue
 * flames flickering while it's lit; in the scene from the first (its programs made at loading), the flames shrunk to nothing when it's off.
 */
const URL = import.meta.env.BASE_URL + 'models/gasstove.glb'
useGLTF.preload(URL)

/** where it stands on the counter (Decor's frame: along the counter (LAY), across it (ALONG)), how big (its model's metres to the bar's
 * units; a little under the cooker's 1.45: the counter's room between the cooker's rice bowl and the rice-ball things is 0.32) */
export const STOVE_AT = { along: 4.435, lay: -0.0835 }
export const STOVE_SCALE = 0.95
/** the counter's top (blender/warmer.py's H, as the cooker stands on it) */
const TOP = 0.236
/** where the tamagoyaki pan hangs: on the rice-ball shelf's left post's face toward the stove (blender/warmer.py's SX[0] at the rice-ball
 * counter's PREP_AT: its face at lay 0.068), its handle's end near the post's top (0.676), its foot 4 cm over the counter; `y` its bottom's
 * middle (the pan 0.18 long, its handle 0.19 more) */
const EGGPAN_AT = { along: 4.715, lay: 0.064, y: 0.37 }
/** the frying pan's handle turned out toward the cook's left front (out to the left it lay over the rice cooker) */
const PAN_TURN = 1.31

/** the stove's state, the game's: lit or not (the cook's work sets it) */
export const STOVE = { on: false, flame: 0 }

const SAYS = nameOver('【廚具】卡式瓦斯爐', '煎玉子燒、蛋包飯的蛋皮；平底鍋在爐上，方形的玉子燒鍋掛在旁邊架子上')

export const GasStove = memo(function GasStove() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const r = (gltf.scene.getObjectByName('GasStoveRoot') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the flames lit from within, seen from either side; the rest the shop's toon)
        t = src.name === 'StoveFlame' ? new THREE.MeshBasicMaterial({ color: '#6aa8ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = src.name !== 'StoveFlame'
      m.receiveShadow = true
    })
    const flame = r.getObjectByName('StoveFlame0')!, knob = r.getObjectByName('StoveKnob0')!
    const fry = r.getObjectByName('FryPan')!, egg = r.getObjectByName('EggPan')!
    fry.rotation.y = PAN_TURN
    // (the tamagoyaki pan taken out of the stove's frame and hung on the shelf's post: its bottom against the post, its handle up)
    r.remove(egg)
    // (its own place in the stove's model let go: placed by its hanging alone)
    egg.position.set(0, 0, 0)
    egg.rotation.set(0, 0, 0)
    inkModel(r, (m) => (m.material as THREE.Material).name === 'StoveFlame', { width: 0.0012, weld: true })
    inkModel(egg, () => false, { width: 0.0012, weld: true })
    flame.scale.setScalar(0.001)
    return { r, flame, knob, fry, egg, mats: [...made.values()] }
  }, [gltf])
  // (the pan hung: its handle (+z) up, its inside (+y) toward the stove (-LAY), its width along the counter's depth)
  const hang = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4().makeBasis(ALONG.clone(), LAY.clone().negate(), up)
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    const p = new THREE.Vector3().addScaledVector(ALONG, EGGPAN_AT.along).addScaledVector(LAY, EGGPAN_AT.lay).setY(EGGPAN_AT.y)
    return { q, p }
  }, [])
  const at = useMemo(() => new THREE.Vector3().addScaledVector(ALONG, STOVE_AT.along).addScaledVector(LAY, STOVE_AT.lay), [])
  useFrame(({ clock }) => {
    // (lit: the flames up, licking; off: down to nothing; the knob turned with it)
    const want = STOVE.on ? 1 : 0
    STOVE.flame += (want - STOVE.flame) * 0.2
    const t = clock.elapsedTime
    const k = STOVE.flame < 0.01 ? 0.001 : STOVE.flame * (0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3))
    parts.flame.scale.set(STOVE.flame < 0.01 ? 0.001 : 1, k, STOVE.flame < 0.01 ? 0.001 : 1)
    parts.knob.rotation.z = -STOVE.flame * 1.4
  })
  return (
    <group>
      <group position={[at.x, TOP, at.z]} rotation-y={Math.atan2(-ALONG.x, -ALONG.z)} scale={STOVE_SCALE}>
        <primitive object={parts.r} />
        <mesh visible={false} position={[0, 0.08, 0]} {...SAYS}><boxGeometry args={[0.36, 0.18, 0.3]} /></mesh>
      </group>
      <group position={hang.p} quaternion={hang.q}><primitive object={parts.egg} /></group>
    </group>
  )
})
