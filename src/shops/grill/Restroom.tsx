import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { setTip } from '@/scene/hoverTip'
import { cleanRoom, FLIES_AT, DIRTY_AT, newRoll, ROLL_USES } from '@/game/restroom'
import { toonOf } from './BarFurnish'
import { handOver, TOILETS } from './bar'
import { getEdit } from './edit'
import { flushSound, knockSound, otohimeNear, otohimeSound, rollSound, scrubSound } from './restroomSound'

/**
 * The toilet rooms' live parts (blender/wc.py): the washlet that lifts its lid as someone comes in and flushes as they go (the water
 * swirling down, the cistern's tap running into the basin on its lid as it refills); clicked, it's scrubbed with the brush from the pot
 * in the corner if it's not spotless, flushed if it is. On the walls, the washlet's remote (its wand gives a little fountain) and the
 * flush keys; the Otohime (音姫), which plays a stream and birdsong, by itself while a woman's in; the paper on its holder, thinning visit
 * by visit till it's bare, a new roll with its end folded to a point at a click; in the women's, the sanitary bin. As it gets dirty,
 * marks on the duckboard and a ring in the bowl, and at the worst flies; scrubbed, it sparkles. Everything in the room's own frame
 * (WcRoom: x from the door to the back wall at D, z across it, w wide).
 */
const TOILET_URL = import.meta.env.BASE_URL + 'models/toilet.glb'
const BITS_URL = import.meta.env.BASE_URL + 'models/wcbits.glb'
useGLTF.preload(TOILET_URL)
useGLTF.preload(BITS_URL)

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
    const wand = root.getObjectByName('WcWand')
    return { root, lid: root.getObjectByName('WcLid')!, water, wand, wandX: wand?.position.x ?? 0.16 }
  }, [gltf])
  const swirl = useRef<THREE.Mesh>(null)
  const tap = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const spray = useRef<THREE.InstancedMesh>(null)
  const stars = useRef<THREE.Group>(null)
  const flies = useRef<THREE.Group>(null)
  const st = useRef({ lid: 0, water: parts.water.position.y, lastIn: 0 })
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
    if (t.flushAt > s.lastIn) { s.lastIn = t.flushAt; if (T - t.flushAt < 200) flushSound(nearOf(parts.root, camera)) }
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
      {/* the cistern's tap running */}
      <mesh ref={tap} position={[0.3, 0.86, 0]} visible={false}>
        <cylinderGeometry args={[0.0035, 0.0045, 0.09, 8]} />
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
      core: of('WcCore'), fold: of('WcFold'), pot: of('WcBrushPot'), brush: of('WcBrush'), bin: of('WcBin'),
    }
    const lcd = r.remote.getObjectByName('RemLcd') as THREE.Mesh | undefined
    lit(lcd, '#a8e0c8')
    const ledMat = lit(r.led.getObjectByName('OtoLed') as THREE.Mesh, '#5ab4ff')
    return { ...r, ledMat }
  }, [gltf])
}

const hover = (title: string, hint: () => string) => ({
  onPointerOver: (e: Parameters<typeof handOver.onPointerOver>[0]) => { handOver.onPointerOver(e); setTip({ title, hint: hint() }) },
  onPointerOut: (e: Parameters<typeof handOver.onPointerOut>[0]) => { handOver.onPointerOut(e); setTip(null) },
})

/** the washlet's remote and flush keys, on the side wall by the toilet (their own frame: the wall at z=0, the room toward +z) */
export function WcRemote({ who }: { who: Who }) {
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
      <group position={[0.14, 0, 0]}>
        <group ref={key} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; TOILETS[who].flushAt = now() }}
          {...hover('沖水鈕', () => '點一下沖水')}>
          <primitive object={b.flush} />
        </group>
      </group>
    </group>
  )
}

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
