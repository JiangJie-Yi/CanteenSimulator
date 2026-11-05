import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { reflectStudio } from '@/scene/studio'
import * as THREE from 'three'
import { setTip } from '@/scene/hoverTip'
import { cleanRoom, FLIES_AT, DIRTY_AT, newRoll, ROLL_USES } from '@/game/restroom'
import { mergeByMaterial, plainColours } from '@/scene/StaticBatch'
import { toonOf } from './BarFurnish'
import { handOver, TOILETS, meterWater } from './bar'
import { getEdit } from './edit'
import { roundMirror } from './mirror'
import { shrineDoor } from './shrineSound'
import { dryerSound, flushSound, knockSound, otohimeNear, otohimeSound, rollSound, scrubSound, tapRunning, tapTurnSound } from './restroomSound'

/**
 * The toilet rooms' live parts (blender/wc.py): the washlet that lifts its lid as someone comes in and flushes as they go (the water
 * swirling down, the cistern's tap running into the basin on its lid as it refills); clicked, it's scrubbed with the brush from the pot
 * in the corner if it's not spotless, flushed if it is. On the walls, the washlet's remote (its wand gives a little fountain) and the
 * flush keys; the Otohime (音姫), which plays a stream and birdsong, by itself while a woman's in (the women's only); the paper on its
 * holder, thinning visit by visit till it's bare, a new roll with its end folded to a point at a click; in the women's, the sanitary bin and
 * a basket of sanitary pads on a shelf, free to take. As it gets dirty, marks on the floor before it and a ring in the bowl, and at the worst
 * flies; scrubbed, it sparkles. In the washroom through the door, the washstand: its tap turned on and off at a click, and running by
 * itself while a guest washes their hands. Each in the frame it's set in by WcRoom.
 */
const TOILET_URL = import.meta.env.BASE_URL + 'models/toilet.glb'
const BITS_URL = import.meta.env.BASE_URL + 'models/wcbits.glb'
const WASH_URL = import.meta.env.BASE_URL + 'models/washstand.glb'
useGLTF.preload(TOILET_URL)
useGLTF.preload(BITS_URL)
useGLTF.preload(WASH_URL)

type Who = 'm' | 'f'
const now = () => performance.now()
/** how much of a room's sound carries to the view (0..1), from how far it is */
const nearOf = (o: THREE.Object3D | null, cam: THREE.Camera) => {
  if (!o) return 0
  const d = o.getWorldPosition(new THREE.Vector3()).distanceTo(cam.position)
  return Math.max(0, Math.min(1, 1 - (d - 1.5) / 7))
}
const ss = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return null
  draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** the water spiralling down as it flushes: pale streaks winding into the middle */
const SWIRL = tex(128, 128, (g) => {
  g.clearRect(0, 0, 128, 128)
  g.translate(64, 64)
  for (let arm = 0; arm < 4; arm++) {
    g.beginPath()
    for (let k = 0; k <= 60; k++) {
      const r = 62 * (1 - k / 60), a = arm * Math.PI / 2 + k * 0.11
      if (k) g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      else g.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 5
    g.stroke()
  }
})
/** a dirty floor's marks: muddy smudges and the prints of slippers, some scraps of paper */
const MARKS = tex(256, 256, (g) => {
  g.clearRect(0, 0, 256, 256)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 14; k++) {
    const x = 30 + rnd() * 196, y = 30 + rnd() * 196, r = 6 + rnd() * 18
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(110,88,52,0.55)')
    gr.addColorStop(1, 'rgba(110,88,52,0)')
    g.fillStyle = gr
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill()
  }
  // (slippers' prints, toward the toilet)
  for (let k = 0; k < 4; k++) {
    g.fillStyle = 'rgba(80,64,40,0.4)'
    g.beginPath(); g.ellipse(70 + k * 34, 100 + (k % 2) * 46, 24, 10, 0.1, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = 'rgba(250,250,246,0.95)'
  for (let k = 0; k < 5; k++) { g.save(); g.translate(40 + rnd() * 176, 40 + rnd() * 176); g.rotate(rnd() * 3); g.fillRect(-7, -5, 14, 10); g.restore() }
})
/** a sparkle: a soft four-pointed star */
const STAR = tex(64, 64, (g) => {
  g.clearRect(0, 0, 64, 64)
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(220,240,255,0.7)')
  gr.addColorStop(1, 'rgba(220,240,255,0)')
  g.fillStyle = gr
  g.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, r = k % 2 ? 7 : 30
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
  }
  g.fill()
})
/** the door's lock window: 使用中 on red, 空き on blue */
export const LOCK_TEX = {
  in: tex(96, 48, (g) => { g.fillStyle = '#c9a04a'; g.fillRect(0, 0, 96, 48); g.fillStyle = '#c4302a'; g.fillRect(6, 6, 84, 36); g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('使用中', 48, 25) }),
  free: tex(96, 48, (g) => { g.fillStyle = '#c9a04a'; g.fillRect(0, 0, 96, 48); g.fillStyle = '#2a6ab0'; g.fillRect(6, 6, 84, 36); g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('空き', 48, 25) }),
}

/** what a click on the door does: knocks if someone's in (it's locked), otherwise opens or shuts it */
export function doorClick(who: Who, near: number) {
  const t = TOILETS[who]
  if (t.inside > 0) {
    t.knockAt = now()
    knockSound(near)
    setTip({ title: '廁所門', hint: '使用中：裡面有人' })
    return
  }
  t.open = !t.open
}

const lit = (m: THREE.Mesh | undefined, color: string) => {
  if (!m) return null
  const b = new THREE.MeshBasicMaterial({ color, toneMapped: false })
  m.material = b
  return b
}

/** the toilet (facing the door, its cistern to the back wall), set at `at` in the room */
export function ToiletLive({ who, at }: { who: Who; at: [number, number, number] }) {
  const gltf = useGLTF(TOILET_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const root = toonOf(TOILET_URL, gltf.scene)
    lit(root.getObjectByName('WcPowerLamp') as THREE.Mesh, '#4aa8ff')
    // (the water a clear pale aqua in the white bowl, not the glaze's white gloss)
    const water = root.getObjectByName('WcWater') as THREE.Mesh
    water.material = new THREE.MeshToonMaterial({ color: '#8fcfe4', side: THREE.DoubleSide })
    // (the bowl turned up from one profile, out over the rim and back down into its well: both its faces drawn, the well's being its back)
    const bowl = root.getObjectByName('WcBowl') as THREE.Mesh
    bowl.material = (bowl.material as THREE.Material).clone()
    ;(bowl.material as THREE.Material).side = THREE.DoubleSide
    lit(root.getObjectByName('WcArmScreen') as THREE.Mesh, '#9fe0ff')
    // (what never moves on its own folded together by material, its ink lines into one: some thirty draws to under twenty; the lid, the water
    // and the washlet's wand, which do, kept as they are)
    // (its plain colours one material, so those merge too)
    plainColours(root)
    mergeByMaterial(root, (o) => /^Wc(Lid|Water|Wand)$/.test(o.name))
    const wand = root.getObjectByName('WcWand')
    return { root, lid: root.getObjectByName('WcLid')!, water, wand, wandX: wand?.position.x ?? 0.16 }
  }, [gltf])
  const swirl = useRef<THREE.Mesh>(null)
  const tap = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const spray = useRef<THREE.InstancedMesh>(null)
  const stars = useRef<THREE.Group>(null)
  const flies = useRef<THREE.Group>(null)
  const st = useRef({ lid: 0, water: parts.water.position.y, lastIn: 0 , lastWash: -1e9})
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ camera, clock }) => {
    const t = TOILETS[who]
    const T = now()
    const s = st.current
    // (someone's coming in, or in, or the owner's looking in, or it's being scrubbed or washing: the washlet's sensor lifts the lid)
    const scrubbing = T - t.scrubAt < 1900
    const washing = T - t.washAt < 3000
    const want = t.inside > 0 || t.passing > 0 || t.open || scrubbing || washing ? 1 : 0
    s.lid += (want - s.lid) * 0.06
    parts.lid.rotation.z = -1.56 * ss(s.lid)
    // (the flush: the water dips and swirls away, then fills again)
    const f = (T - t.flushAt) / 1000
    const flushing = f >= 0 && f < 3.2
    parts.water.position.y = s.water - (flushing ? 0.025 * Math.sin(Math.PI * Math.min(1, f / 3)) : 0)
    if (swirl.current) {
      swirl.current.visible = flushing
      swirl.current.position.y = parts.water.position.y + 0.002
      swirl.current.rotation.z -= 0.25
      ;(swirl.current.material as THREE.MeshBasicMaterial).opacity = flushing ? Math.min(1, f * 3, (3.2 - f) * 2) * 0.8 : 0
    }
    // (the cistern refilling, its tap running into the basin on its lid)
    if (tap.current) {
      const on = f > 2.4 && f < 8
      tap.current.visible = on
      if (on) tap.current.scale.set(1, Math.min(1, (f - 2.4) * 4), 1)
    }
    // (the ring in the bowl as it gets dirty)
    if (ring.current) {
      const dirt = Math.max(0, (DIRTY_AT + 0.25 - t.room.clean) / (DIRTY_AT + 0.25))
      ring.current.visible = dirt > 0.02 && s.lid > 0.3
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, 0.3 + dirt * 1.2)
      ring.current.position.y = parts.water.position.y + 0.006
    }
    // (the wash, from the seat's panel or the wall's remote: the wand slides out from under the washlet, a little fountain arcs from its
    // tip over the bowl, and it tucks itself away again)
    const k = (T - t.washAt) / 1000
    const out = k < 0 ? 0 : ss(Math.min((k - 0.2) / 0.3, (2.9 - k) / 0.3))
    if (parts.wand) parts.wand.position.x = parts.wandX - 0.09 * out
    if (spray.current) {
      const on = k > 0.5 && k < 2.4
      spray.current.visible = on
      const tip = parts.wandX - 0.06 - 0.09 * out
      if (on) for (let i = 0; i < 14; i++) {
        const u = ((clock.elapsedTime * 1.8 + i / 14) % 1)
        dummy.position.set(tip - u * 0.16, 0.405 + Math.sin(Math.PI * u) * 0.09, (i % 3 - 1) * 0.003)
        dummy.scale.setScalar(1 - u * 0.4)
        dummy.updateMatrix()
        spray.current.setMatrixAt(i, dummy.matrix)
      }
      spray.current.instanceMatrix.needsUpdate = true
    }
    // (scrubbed clean: it sparkles a moment)
    if (stars.current) {
      const k = (T - t.scrubAt) / 1000 - 1.6
      stars.current.visible = k > 0 && k < 1.8
      if (stars.current.visible) stars.current.children.forEach((c, i) => {
        const p = Math.sin(Math.PI * Math.min(1, Math.max(0, (k - i * 0.15) / 1.1)))
        c.scale.setScalar(0.07 * p)
      })
    }
    // (filthy: flies, buzzing round it)
    if (flies.current) {
      flies.current.visible = t.room.clean < FLIES_AT
      if (flies.current.visible) flies.current.children.forEach((c, i) => {
        const a = clock.elapsedTime * (2.2 + i) + i * 2
        c.position.set(-0.03 + Math.cos(a) * 0.14 + Math.sin(a * 3.1) * 0.03, 0.55 + Math.sin(a * 1.7) * 0.08, Math.sin(a) * 0.12)
      })
    }
    // (the flush, heard: when a guest goes out, it flushed behind them)
    if (t.flushAt > s.lastIn) {
      s.lastIn = t.flushAt
      if (T - t.flushAt < 200) flushSound(nearOf(parts.root, camera))
      // (metered: the cistern refilled (through the tap on its lid); the hands are washed at the washstand, and metered there)
      meterWater('flush')
    }
    if (t.washAt > s.lastWash) { s.lastWash = t.washAt; meterWater('washlet') }
  })
  const isArm = (o: THREE.Object3D) => o.name.startsWith('WcArm')
  const over = (e: Parameters<typeof handOver.onPointerOver>[0] & { object: THREE.Object3D }) => {
    handOver.onPointerOver(e)
    const r = TOILETS[who].room
    if (isArm(e.object)) { setTip({ title: '免治馬桶操作面板', hint: '點一下：溫水洗淨' }); return }
    setTip({ title: '免治馬桶', hint: r.clean < 0.999 ? `清潔度 ${Math.round(r.clean * 100)}%・點一下打掃` : '很乾淨・點一下沖水' })
  }
  return (
    <group position={at}>
      <group onClick={(e) => {
        e.stopPropagation()
        if (getEdit().on) return
        const t = TOILETS[who]
        const near = nearOf(parts.root, e.camera)
        if (isArm(e.object)) t.washAt = now()
        else if (t.room.clean < 0.999) {
          t.room = cleanRoom(t.room)
          t.scrubAt = now()
          scrubSound(near)
        } else t.flushAt = now()
        over(e)
      }} onPointerOver={over} onPointerOut={(e) => { handOver.onPointerOut(e); setTip(null) }}>
        <primitive object={parts.root} />
      </group>
      {/* the swirl on the water as it goes down */}
      <mesh ref={swirl} position={[-0.035, 0.3, 0]} rotation-x={-Math.PI / 2} scale={[1.2, 1, 1]} visible={false}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial map={SWIRL} transparent depthWrite={false} color="#2f7fb0" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {/* the cistern's tap running: from the spout's nozzle down into the basin */}
      <mesh ref={tap} position={[0.295, 0.811, 0]} visible={false}>
        <cylinderGeometry args={[0.0035, 0.0045, 0.082, 8]} />
        <meshBasicMaterial color="#cfeaf6" transparent opacity={0.7} />
      </mesh>
      {/* the ring that gathers in the bowl */}
      <mesh ref={ring} position={[-0.035, 0.3, 0]} rotation-x={-Math.PI / 2} scale={[1.22, 1, 1]} visible={false}>
        <ringGeometry args={[0.058, 0.074, 32]} />
        <meshBasicMaterial color="#86642a" transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <instancedMesh ref={spray} args={[undefined, undefined, 14]} visible={false}>
        <sphereGeometry args={[0.005, 6, 4]} />
        <meshBasicMaterial color="#d8f0ff" />
      </instancedMesh>
      <group ref={stars} visible={false}>
        {[[-0.2, 0.5, 0.1], [0.05, 0.62, -0.15], [-0.1, 0.45, -0.18], [0.12, 0.85, 0.12], [-0.25, 0.4, -0.05]].map((p, i) => (
          <sprite key={i} position={p as [number, number, number]} scale={0.0001}>
            <spriteMaterial map={STAR} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ))}
      </group>
      <group ref={flies} visible={false}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <mesh><sphereGeometry args={[0.006, 6, 4]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
            {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.004, sd * 0.006]} rotation-x={sd * 0.6}><planeGeometry args={[0.008, 0.01]} /><meshBasicMaterial color="#dfe6ee" transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>)}
          </group>
        ))}
      </group>
    </group>
  )
}

/** the floor's marks before the toilet, as it gets dirty (on the duckboard: x, y, z of its middle, and its size) */
export function WcMarks({ who, at, size }: { who: Who; at: [number, number, number]; size: [number, number] }) {
  const m = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const c = TOILETS[who].room.clean
    if (m.current) m.current.opacity = Math.max(0, Math.min(1, (DIRTY_AT + 0.2 - c) / 0.35))
  })
  return (
    <mesh position={at} rotation-x={-Math.PI / 2} raycast={() => {}}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={m} map={MARKS} transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

/**
 * The washlet remote's face and the flush unit's, painted (wc.py lays each a single quad): the remote's dark face in an ivory frame, its round
 * keys each shaded like a domed button (a soft shadow under it, a lit top, a white glint): the big orange stop, the rear wash (blue) and
 * the front wash (pink) beside it, the water's strength (− +) by the screen (the screen itself a quad of its own, lit), the seat's warmth
 * (two small keys) under; the flush unit's two chrome keys, 大 and 小, and a strip naming them
 */
function paintKey(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: string, label = '') {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + r * 0.08, y + r * 0.14, r * 1.04, 0, Math.PI * 2); g.fill()
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, base); gr.addColorStop(1, base)
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(x, y + r * 0.1, r, 0.15 * Math.PI, 0.85 * Math.PI); g.arc(x, y - r * 0.05, r * 0.92, 0.85 * Math.PI, 0.15 * Math.PI, true); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.16, -0.5, 0, Math.PI * 2); g.fill()
  if (label) { g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = `700 ${Math.round(r * 0.75)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, y + r * 0.05) }
}
const REMOTE_ART = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = 512; c.height = 304
  const g = c.getContext('2d')!
  g.fillStyle = '#efe8da'; g.fillRect(0, 0, 512, 304)
  const round = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r) }
  round(14, 14, 484, 276, 26); g.fillStyle = '#c9c1b1'; g.fill()
  round(22, 22, 468, 260, 22); g.fillStyle = '#353a42'; g.fill()
  // (where the lit screen's quad lies (wc.py: 0.07 x 0.022 at (-0.03, 0.026) on the 0.172 x 0.102 face), a recess round it)
  round(55, 34, 224, 80, 8); g.fillStyle = '#1c1f24'; g.fill()
  paintKey(g, 400, 86, 17, '#8f949b', '−'); paintKey(g, 452, 86, 17, '#8f949b', '+')
  paintKey(g, 256, 186, 46, '#e8762c', '止'); paintKey(g, 132, 186, 32, '#3a7ac8'); paintKey(g, 380, 186, 32, '#e07aa0')
  paintKey(g, 210, 254, 15, '#8f949b'); paintKey(g, 302, 254, 15, '#8f949b')
  g.fillStyle = '#c9ced6'; g.font = '600 15px sans-serif'; g.textAlign = 'center'
  g.fillText('おしり', 132, 238); g.fillText('ビデ', 380, 238); g.fillText('水勢', 426, 122); g.fillText('便座', 256, 282)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false
  return t
})()
const FLUSH_ART = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = 192; c.height = 284
  const g = c.getContext('2d')!
  g.fillStyle = '#efe8da'; g.fillRect(0, 0, 192, 284)
  g.fillStyle = '#d8d0c0'; g.beginPath(); g.roundRect(10, 10, 172, 264, 18); g.fill()
  g.fillStyle = '#353a42'; g.beginPath(); g.roundRect(36, 26, 120, 22, 6); g.fill()
  g.fillStyle = '#e8ecef'; g.font = '700 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('洗浄', 96, 38)
  paintKey(g, 96, 128, 50, '#b9bec5', '大'); paintKey(g, 96, 226, 32, '#b9bec5', '小')
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false
  return t
})()

/** a node of wcbits.glb, drawn in the room's toon light (each room its own copy) */
function useBits() {
  const gltf = useGLTF(BITS_URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    const root = toonOf(BITS_URL, gltf.scene)
    const of = (n: string) => {
      const o = root.getObjectByName(n)!
      o.removeFromParent()
      o.position.set(0, 0, 0)
      return o
    }
    const r = {
      remote: of('WcRemote'), flush: of('WcFlushKey'), oto: of('WcOtohime'), led: of('WcOtoLed'), holder: of('WcHolder'), roll: of('WcRoll'),
      core: of('WcCore'), fold: of('WcFold'), pot: of('WcBrushPot'), brush: of('WcBrush'), bin: of('WcBin'), pads: of('WcPads'),
    }
    const lcd = r.remote.getObjectByName('RemLcd') as THREE.Mesh | undefined
    lit(lcd, '#7fe2ee')
    // (the faces' keys, frame and words: painted, not modelled (the owner's: the pair 30 triangles))
    for (const [n, tex] of [['RemFace', REMOTE_ART], ['FlushFace', FLUSH_ART]] as const) {
      const m = r.remote.getObjectByName(n) ?? r.flush.getObjectByName(n)
      if (m && (m as THREE.Mesh).isMesh) (m as THREE.Mesh).material = new THREE.MeshToonMaterial({ color: '#ffffff', map: tex })
    }
    const ledMat = lit(r.led.getObjectByName('OtoLed') as THREE.Mesh, '#5ab4ff')
    // (the parts that never move on their own, their buttons and ink lines, folded into a mesh or two per material: the remote and the
    // Otohime were near thirty draws apiece, in each of the two toilets; the lit screen keeps its own)
    for (const o of [r.remote, r.oto, r.holder, r.pot, r.bin, r.pads]) { plainColours(o); mergeByMaterial(o) }
    return { ...r, ledMat }
  }, [gltf])
}

const hover = (title: string, hint: () => string) => ({
  onPointerOver: (e: Parameters<typeof handOver.onPointerOver>[0]) => { handOver.onPointerOver(e); setTip({ title, hint: hint() }) },
  onPointerOut: (e: Parameters<typeof handOver.onPointerOut>[0]) => { handOver.onPointerOut(e); setTip(null) },
})

/** the washlet's remote and flush keys, on the side wall by the toilet (their own frame: the wall at z=0, the room toward +z) */
export function WcRemote({ who, flushAt = 0.14 }: { who: Who; flushAt?: number }) {
  const b = useBits()
  const key = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = (now() - TOILETS[who].flushAt) / 1000
    if (key.current) key.current.position.z = k >= 0 && k < 0.35 ? -0.006 * Math.sin(Math.PI * k / 0.35) : 0
  })
  return (
    <group>
      <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].washAt = now() }}
        {...hover('免治馬桶遙控器', () => '點一下：溫水洗淨')}>
        <primitive object={b.remote} />
      </group>
      <group position={[flushAt, 0, 0]}>
        <group ref={key} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].flushAt = now() }}
          {...hover('沖水鈕', () => '點一下沖水')}>
          <primitive object={b.flush} />
        </group>
      </group>
    </group>
  )
}

/**
 * The washroom's hand drying (the owner's: no towel on a rod; a modern izakaya's), on the side wall by the washstand, their own frame the
 * wall at z=0 facing +z: a paper towel dispenser (brushed stainless, a little window in its front, a white sheet showing at the slot under
 * it), and a hand dryer (white, rounded, a dark outlet under it, a little lamp): it blows 1.5 s after a guest's washed their hands (TOILETS'
 * dryAt, GuestBar3D steps them to it), or at a click: the lamp lit cyan, a soft whir, a tremble
 */
const TOWEL_BODY = new RoundedBoxGeometry(0.24, 0.3, 0.1, 2, 0.02).translate(0, 0, 0.05)
const TOWEL_WINDOW = new RoundedBoxGeometry(0.08, 0.05, 0.004, 1, 0.008)
const TOWEL_SLOT = new RoundedBoxGeometry(0.17, 0.012, 0.03, 1, 0.004)
const TOWEL_SHEET = new THREE.PlaneGeometry(0.15, 0.05).translate(0, -0.025, 0)
const DRYER_BODY = new RoundedBoxGeometry(0.2, 0.22, 0.12, 3, 0.045).translate(0, 0, 0.06)
const DRYER_OUTLET = new RoundedBoxGeometry(0.13, 0.014, 0.07, 1, 0.006)
const DRYER_LAMP = new THREE.CircleGeometry(0.008, 12)
const STEEL = (() => { const m = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35, envMapIntensity: 0.9 }); reflectStudio(m); return m })()
export function WcTowelBox() {
  return (
    <group {...nameOverWc('擦手紙盒', '從下方的出紙口抽一張擦手')}>
      <mesh geometry={TOWEL_BODY} material={STEEL} castShadow />
      <mesh geometry={TOWEL_WINDOW} position={[0, 0.06, 0.101]}><meshToonMaterial color="#e8eef2" /></mesh>
      <mesh geometry={TOWEL_SLOT} position={[0, -0.14, 0.07]}><meshToonMaterial color="#2a2c30" /></mesh>
      <mesh geometry={TOWEL_SHEET} position={[0, -0.146, 0.072]} rotation-x={-0.25}><meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} /></mesh>
    </group>
  )
}
export function WcDryer({ who }: { who: 'm' | 'f' }) {
  const g = useRef<THREE.Group>(null)
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: '#3a4048' }), [])
  useEffect(() => () => lamp.dispose(), [lamp])
  const was = useRef(-1e9)
  useFrame(({ camera }) => {
    const t = TOILETS[who], u = now() - t.dryAt
    if (t.dryAt !== was.current) { was.current = t.dryAt; if (u < 300) dryerSound(nearOf(g.current, camera)) }
    const on = u >= 0 && u < 1500
    lamp.color.set(on ? '#7fe2ee' : '#3a4048')
    if (g.current) g.current.position.x = on ? Math.sin(now() * 0.09) * 0.0015 : 0
  })
  return (
    <group ref={g} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].dryAt = now() }}
      {...hover('烘手機', () => '點一下吹風；客人洗完手會自己來烘乾')}>
      <mesh geometry={DRYER_BODY} castShadow><meshToonMaterial color="#f3f1ec" /></mesh>
      <mesh geometry={DRYER_OUTLET} position={[0, -0.106, 0.07]}><meshToonMaterial color="#3a3d42" /></mesh>
      <mesh geometry={DRYER_LAMP} position={[0.06, 0.07, 0.1205]} material={lamp} />
    </group>
  )
}
/** named when pointed at, nothing to do with it (bar.ts's nameOver, kept here so this file needn't take all of bar.ts's) */
const nameOverWc = (title: string, hint: string) => ({
  onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title, hint }) },
  onPointerOut: () => setTip(null),
})

/** the Otohime on the wall (the wall at z=0, facing +z): a stream and birdsong at a click, and by itself while a woman's in */
export function WcOtohime({ who }: { who: Who }) {
  const b = useBits()
  const g = useRef<THREE.Group>(null)
  const st = useRef({ inside: 0 })
  useFrame(({ camera, clock }) => {
    const t = TOILETS[who]
    if (who === 'f' && t.inside > st.current.inside) { t.otoAt = now(); otohimeSound(16) }
    st.current.inside = t.inside
    const playing = now() - t.otoAt < 16000
    if (playing) otohimeNear(nearOf(g.current, camera))
    if (b.ledMat) b.ledMat.color.set(playing ? '#5ab4ff' : '#4a5560').multiplyScalar(playing ? 0.8 + 0.4 * Math.sin(clock.elapsedTime * 4) : 1)
  })
  return (
    <group ref={g} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].otoAt = now(); otohimeSound(16) }}
      {...hover('音姬', () => '點一下播放流水聲')}>
      <primitive object={b.oto} />
      <primitive object={b.led} />
    </group>
  )
}

/** the paper holder on the wall (z=0, facing +z): the roll thins with each visit; a click puts a new one on, its end folded to a point */
export function WcPaper({ who }: { who: Who }) {
  const b = useBits()
  const roll = useRef<THREE.Group>(null)
  const sheet = useRef<THREE.Mesh>(null)
  const st = useRef({ uses: -1, fold: true })
  useFrame(() => {
    const t = TOILETS[who]
    const p = t.room.paper
    // (a guest's been since it was seen to: the point's gone, a sheet hangs loose)
    if (t.room.uses !== st.current.uses) { if (st.current.uses >= 0) st.current.fold = false; st.current.uses = t.room.uses }
    if (t.rollAt > 0 && now() - t.rollAt < 100) st.current.fold = true
    const r = 0.022 + 0.034 * p
    if (roll.current) {
      b.roll.scale.set(1, r, r)
      b.roll.visible = p > 0.001
      b.fold.visible = p > 0.001 && st.current.fold
      b.fold.position.set(0, -r * 0.35, r + 0.002)
    }
    if (sheet.current) {
      sheet.current.visible = p > 0.001 && !st.current.fold
      sheet.current.position.set(0, -0.03 - r * 0.3, r + 0.001)
    }
  })
  return (
    <group onClick={(e) => {
      e.stopPropagation()
      if (getEdit().on) return
      const t = TOILETS[who]
      t.room = newRoll(t.room)
      t.rollAt = now()
      rollSound(nearOf(roll.current, e.camera))
    }} {...hover('衛生紙架', () => {
      const p = TOILETS[who].room.paper
      const left = Math.round(p * ROLL_USES)
      return left >= ROLL_USES ? '新的一捲' : left > 0 ? `還夠 ${left} 位客人用・點一下換新捲` : '用完了！點一下換新捲'
    })}>
      <primitive object={b.holder} />
      <group ref={roll} position={[0, 0, 0.065]}>
        <primitive object={b.roll} />
        <primitive object={b.core} />
        <primitive object={b.fold} />
        <mesh ref={sheet} raycast={() => {}}>
          <planeGeometry args={[0.1, 0.06]} />
          <meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

/** the brush in its pot on the floor at `at`; scrubbing, it goes over into the bowl (at `bowl`, in the room) and round, and back */
export function WcBrush({ who, at, bowl }: { who: Who; at: [number, number, number]; bowl: [number, number, number] }) {
  const b = useBits()
  const brush = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = (now() - TOILETS[who].scrubAt) / 1000
    const o = brush.current
    if (!o) return
    if (k < 0 || k > 1.9) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); return }
    // (up out of the pot, over to the bowl, round and round in it, and back)
    const home = new THREE.Vector3(0, 0, 0), up = new THREE.Vector3(0, 0.36, 0)
    const into = new THREE.Vector3(bowl[0] - at[0], bowl[1] - at[1] - 0.06, bowl[2] - at[2])
    const over = into.clone().setY(0.36)
    const p = new THREE.Vector3()
    if (k < 0.25) p.lerpVectors(home, up, ss(k / 0.25))
    else if (k < 0.5) p.lerpVectors(up, over, ss((k - 0.25) / 0.25))
    else if (k < 0.65) p.lerpVectors(over, into, ss((k - 0.5) / 0.15))
    else if (k < 1.35) { const a = (k - 0.65) * 22; p.copy(into).add(new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.04)) }
    else if (k < 1.55) p.lerpVectors(into, over, ss((k - 1.35) / 0.2))
    else if (k < 1.75) p.lerpVectors(over, up, ss((k - 1.55) / 0.2))
    else p.lerpVectors(up, home, ss((k - 1.75) / 0.15))
    o.position.copy(p)
    o.rotation.z = k > 0.5 && k < 1.55 ? -0.35 : 0
  })
  return (
    <group position={at}>
      <primitive object={b.pot} />
      <group ref={brush}><primitive object={b.brush} /></group>
    </group>
  )
}

/** the sanitary bin (the women's), on the floor */
export function WcBin() {
  const b = useBits()
  return <primitive object={b.bin} />
}

/** the sanitary pads (the women's; the owner's: 女廁有提供衛生棉): a basket of them on a little shelf on the wall (z=0, facing +z), free to take;
 * pointed at, only named (nothing to click: no glow, the cursor as it is) */
export function WcPads() {
  const b = useBits()
  return (
    <group onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '衛生棉', hint: '免費提供・歡迎取用' }) }}
      onPointerOut={() => setTip(null)}>
      <primitive object={b.pads} />
    </group>
  )
}

/** how long a guest's hand wash runs the tap (ms) */
export const HAND_MS = 1500
const WASH_STREAM = new THREE.MeshBasicMaterial({ color: '#cfeaf6', transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false })
/**
 * The washroom's washstand (blender/wc.py: its back to +x, against the back wall facing the door, so it's the first thing seen as the door
 * slides open; the owner's): its tap's cross handle turned a quarter round at a click to run the water, and back to stop it (left running,
 * it's metered by the minute: App), and turned and running by itself while a guest washes their hands (metered as a hand wash); a stream
 * from the spout's mouth down into the bowl, wavering, a ring spreading where it lands; heard running, as loud as it's near.
 */
/** the cabinet's doors: how long they take to swing open or shut (s), and how far (a little past square) */
const CAB_S = 0.35, CAB_SWING = 1.75
export function WashstandLive({ who }: { who: Who }) {
  const gltf = useGLTF(WASH_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const root = toonOf(WASH_URL, gltf.scene)
    // (the handle a piece of its own, turned as the water's turned on and off; the rest never moves: a mesh or two per material)
    const handle = root.getObjectByName('WashTapHandle')!
    handle.removeFromParent()
    root.updateMatrixWorld(true)
    // (the cabinet's two doors each a piece of its own, hinged at its outer edge (the owner's: click, and they swing open on what's kept in
    // it; again, shut): their frames, slats, panels and pulls gathered round each hinge, out of the rest's merging)
    const doors = [0, 1].map((k) => {
      const bits: THREE.Object3D[] = []
      root.traverse((o) => { if (new RegExp(`^Wash(DoorBack|Stile|Rail|Slat|Pull)${k}`).test(o.name) && (o as THREE.Mesh).isMesh) bits.push(o) })
      const box = new THREE.Box3()
      for (const o of bits) box.expandByObject(o)
      const hinge = root.worldToLocal(new THREE.Vector3(box.max.x, 0, k === 0 ? box.min.z : box.max.z))
      const g = new THREE.Group()
      g.name = `WashCabDoor${k}`
      g.position.copy(hinge)
      root.add(g)
      g.updateMatrixWorld(true)
      for (const o of bits) g.attach(o)
      return g
    })
    root.updateMatrixWorld(true)
    const at = (n: string) => root.worldToLocal(root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()))
    const tip = at('WashSpoutTip'), floor = at('WashBowlFloor')
    // (the mirror's glass: where its face is (the stand's back is to +x, the glass faces -x), for the mirror that shows the room)
    const pane = root.getObjectByName('WashMirror') as THREE.Mesh
    const box = new THREE.Box3().setFromObject(pane), mid = box.getCenter(new THREE.Vector3())
    const toRoot = root.matrixWorld.clone().invert()
    const face = new THREE.Vector3(box.min.x, mid.y, mid.z).applyMatrix4(toRoot)
    plainColours(root)
    mergeByMaterial(root, (o) => doors.includes(o as THREE.Group))
    for (const d of doors) mergeByMaterial(d)
    mergeByMaterial(handle)
    let plain: THREE.Object3D | null = null
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === 'WashMirror') plain = m })
    const mirror = roundMirror((box.max.y - box.min.y) / 2)
    mirror.glass.position.copy(face).add(new THREE.Vector3(-0.0006, 0, 0))
    mirror.glass.rotation.y = -Math.PI / 2
    return { root, handle, tip, floor, mirror, plain: plain as THREE.Object3D | null, doors }
  }, [gltf])
  const cab = useRef({ open: false, k: 0 })
  useEffect(() => () => { parts.mirror.glass.getRenderTarget().dispose(); (parts.mirror.glass.material as THREE.Material).dispose() }, [parts])
  const frame = useRef(0)
  const st = useRef({ turn: 0, lastHand: -1e9, was: false })
  const stream = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const len = parts.tip.y - parts.floor.y
  useFrame(({ clock, camera, scene }, dt) => {
    // (the mirror showing the room while the eye's near it; the plain glass (the studio's blur in it) when not)
    const showing = parts.mirror.tick(scene, camera, frame.current++)
    if (parts.plain) parts.plain.visible = !showing
    const t = TOILETS[who]
    const s = st.current
    const on = t.tap || now() - t.handAt < HAND_MS
    // (the handle heard as it's turned, by a click or a guest washing their hands, as loud as the room's near)
    if (on !== s.was) { s.was = on; tapTurnSound(on, nearOf(parts.root, camera)) }
    s.turn += ((on ? 1 : 0) - s.turn) * Math.min(1, Math.min(dt, 0.1) * 8)
    parts.handle.rotation.y = s.turn * (Math.PI / 2)
    // (a guest's hand wash, metered once)
    if (t.handAt > s.lastHand) { s.lastHand = t.handAt; meterWater('handwash') }
    const k = clock.elapsedTime
    if (stream.current) {
      stream.current.visible = on
      if (on) stream.current.scale.set(1 + Math.sin(k * 31) * 0.12, 1, 1 + Math.cos(k * 27) * 0.12)
    }
    if (ring.current) {
      ring.current.visible = on
      if (on) { const r = 1 + ((k * 2.4) % 1) * 1.6; ring.current.scale.set(r, r, r); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((k * 2.4) % 1)) }
    }
    tapRunning(`wc-${who}`, on ? nearOf(parts.root, camera) : 0)
    // (the cabinet's doors swinging, eased in and out over CAB_S; the left one out round its left edge, the right round its right)
    const c = cab.current
    c.k = Math.min(1, Math.max(0, c.k + (c.open ? 1 : -1) * Math.min(dt, 0.1) / CAB_S))
    const e = c.k * c.k * (3 - 2 * c.k)
    parts.doors[0].rotation.y = -e * CAB_SWING
    parts.doors[1].rotation.y = e * CAB_SWING
  })
  const onDoor = (o: THREE.Object3D) => { for (let q: THREE.Object3D | null = o; q; q = q.parent) if (parts.doors.includes(q as THREE.Group)) return true; return false }
  const cabSays = () => (cab.current.open ? '點擊關上' : '點擊打開・備用的衛生紙與毛巾')
  const says = () => (TOILETS[who].tap ? '點一下關水' : '點一下開水（開著會一直計水費）')
  return (
    <group>
      {/* (the cabinet's doors pointed at through the stand's own model: only they answer) */}
      <group onClick={(e) => {
        if (!onDoor(e.object)) return
        e.stopPropagation()
        if (getEdit().on) return
        cab.current.open = !cab.current.open
        shrineDoor(cab.current.open)
        setTip({ title: '收納櫃', hint: cabSays() })
      }}
        onPointerOver={(e) => { if (!onDoor(e.object) || getEdit().on) return; e.stopPropagation(); document.body.style.cursor = 'pointer'; setTip({ title: '收納櫃', hint: cabSays() }) }}
        onPointerOut={(e) => { if (!onDoor(e.object)) return; document.body.style.cursor = ''; setTip(null) }}>
        <primitive object={parts.root} />
      </group>
      <primitive object={parts.mirror.glass} />
      {/* (the tap's handle: pointed at it lights and says so; clicked, the water's turned on, or off) */}
      <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].tap = !TOILETS[who].tap; setTip({ title: '洗手台水龍頭', hint: says() }) }}
        {...hover('洗手台水龍頭', says)}>
        <primitive object={parts.handle} />
      </group>
      <mesh position={[parts.tip.x, parts.floor.y + len / 2, parts.tip.z]} ref={stream} material={WASH_STREAM} visible={false} raycast={() => {}}>
        <cylinderGeometry args={[0.0045, 0.006, len, 8, 1, true]} />
      </mesh>
      <mesh ref={ring} position={[parts.floor.x, parts.floor.y + 0.003, parts.floor.z]} rotation-x={-Math.PI / 2} visible={false} raycast={() => {}}>
        <ringGeometry args={[0.01, 0.018, 20]} />
        <meshBasicMaterial color="#e8f6fc" transparent opacity={0.5} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
