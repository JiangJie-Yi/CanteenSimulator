// Developer mode's character viewer (the owner's: it comes with G, on the right): every figure in the game on a turntable, the owner, the
// staff in each of their outfits, every kind of customer (another of the same kind at a click), turned with the mouse and zoomed with the
// wheel; a customer's moods and anyone's walk to try; how many triangles and draws each one is. Its own little canvas (its own GL context),
// mounted only while developer mode is on.
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { KINDS, kindOf, type GuestKind } from '@/data/guests'
import { tl, type Lang } from '@/data/i18n'
import type { Role } from '@/data/staff'
import { FolkFigure } from '@/scene/FolkFigure'
import type { Mood } from '@/scene/people'
import { StaffFigure } from '@/scene/StaffFigure'
import { BossModel } from './Boss'
import { WireView } from './Movable'
import { isInk } from '@/scene/inkHull'
import type { CrewFace } from '@/scene/faceSheet'
import { usePanelSound } from '@/ui/uiSound'
import { Glyph } from '@/ui/GameIcons'
import { getCharHidden, onCharHidden, setCharHidden, toggleEdit } from './edit'

type Entry = { key: string; zh: string; ja: string; en: string; group: 'boss' | 'staff' | 'guest'; role?: Role; female?: boolean; kind?: GuestKind }
const ENTRIES: Entry[] = [
  { key: 'boss', zh: '老闆', ja: '店主', en: 'Owner', group: 'boss' },
  { key: 'chef-m', zh: '廚師（男）', ja: '料理人（男）', en: 'Cook (m)', group: 'staff', role: 'chef', female: false },
  { key: 'chef-f', zh: '廚師（女）', ja: '料理人（女）', en: 'Cook (f)', group: 'staff', role: 'chef', female: true },
  { key: 'server-m', zh: '外場（男）', ja: 'ホール（男）', en: 'Server (m)', group: 'staff', role: 'server', female: false },
  { key: 'server-f', zh: '外場（女）', ja: 'ホール（女）', en: 'Server (f)', group: 'staff', role: 'server', female: true },
  { key: 'stock', zh: '倉儲', ja: '倉庫番', en: 'Stock keeper', group: 'staff', role: 'stock', female: false },
  ...KINDS.map((k) => ({ key: `guest-${k.kind}`, zh: k.zh, ja: k.ja, en: k.en, group: 'guest' as const, kind: k.kind })),
]
/** a dozen customers' ids of each kind (a customer's look is fixed by their id), found once */
const IDS = (() => {
  const out = new Map<GuestKind, number[]>()
  for (let id = 1; id < 6000; id++) {
    const k = kindOf(id).kind
    const list = out.get(k) ?? []
    if (list.length < 12) { list.push(id); out.set(k, list) }
  }
  return out
})()
/** how tall every figure stands on the stand (each scaled to it), and the stand's top */
const STAND_H = 1.8
const KEY_PICK = 'jgs-char-view-1'
/** whether the viewer's slid away to the screen's edge (its handle left showing): kept in the browser */
/** the viewer's height, as last dragged (its foot's grip) */
const KEY_H = 'jgs-char-view-h-1'

/** a wooden turntable: a round top with a brass ring, on a dark plinth */
function Stand() {
  return (
    <group>
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <cylinderGeometry args={[0.78, 0.84, 0.14, 48]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.72, 0.03, 48]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.012, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.725, 0.012, 8, 64]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** the figure scaled to stand STAND_H tall on the stand, its feet's middle at its middle; its triangles and draws counted */
function Fitted({ children, onStats, spin, look, normals }: { children: React.ReactNode; onStats: (s: Stats) => void; spin: boolean; look: Look; normals: boolean }) {
  const inner = useRef<THREE.Group>(null)
  const outer = useRef<THREE.Group>(null)
  // (measured until it's held the same size for a while: a model loads, and grows, some frames after it's mounted, and on a long session
  // or with the panel tucked away that's well past the first forty frames (only those were measured, and a figure that came later stood
  // at its model's own size, a speck on the stand); frames with nothing in them yet don't count)
  const still = useRef(0)
  const [ready, setReady] = useState(false)
  const was = useRef(new THREE.Vector3())
  const box = useMemo(() => new THREE.Box3(), [])
  const camera = useThree((t) => t.camera) as THREE.PerspectiveCamera
  const controls = useThree((t) => t.controls) as unknown as { target: THREE.Vector3; update: () => void; minDistance: number; maxDistance: number } | null
  useFrame((_, dt) => {
    const o = outer.current, g = inner.current
    if (!o || !g) return
    if (spin) o.rotation.y += Math.min(dt, 0.1) * 0.45
    if (still.current > 8) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)
    box.makeEmpty()
    // (the model's own triangles apart from its outline's (the owner's: the count is the figure's body; the ink hull, the stand, the
    // normals' lines and a wireframe's copies aren't it): the hull's a back-faced copy, counted on its own)
    let tris = 0, ink = 0, draws = 0
    g.traverse((q) => {
      const m = q as THREE.Mesh
      if (!m.isMesh || !m.visible || q.userData.wireDepth) return
      draws++
      const geo = m.geometry
      const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      if (mats.every(isInk)) ink += n
      // (a skinned figure (the owner, the staff, the customers: one mesh on bones) measured as it's posed, point by point: its bounding box is
      // worked out once at rest and never follows the bones, and the owner stood on it sank to his middle in the stand (the owner saw))
      else { tris += n; box.expandByObject(m, (m as THREE.SkinnedMesh).isSkinnedMesh) }
    })
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    still.current = size.distanceTo(was.current) < 1e-4 ? still.current + 1 : 0
    was.current.copy(size)
    const k = STAND_H / Math.max(0.01, size.y)
    g.scale.setScalar(k)
    const c = box.getCenter(new THREE.Vector3())
    g.position.set(-c.x * k, -box.min.y * k, -c.z * k)
    onStats({ tris: Math.round(tris), ink: Math.round(ink), draws })
    // (once it's settled, the camera fitted to it (the owner's): the controls aimed at its middle, the camera back far enough that its
    // bounding sphere fills the view with a fifth to spare, a little above its middle; the near and far planes by that distance)
    if (still.current > 8) {
      setReady(true)
      g.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(g)
      const centre = b.getCenter(new THREE.Vector3()), tall = b.getSize(new THREE.Vector3())
      const radius = b.getBoundingSphere(new THREE.Sphere()).radius
      const fov = camera.fov * (Math.PI / 180)
      const d = Math.abs(radius / Math.sin(fov / 2)) * 1.25
      camera.position.set(centre.x, centre.y + tall.y * 0.1, centre.z + d)
      camera.near = d / 100
      camera.far = d * 100
      camera.updateProjectionMatrix()
      if (controls) { controls.target.copy(centre); controls.minDistance = d * 0.35; controls.maxDistance = d * 2; controls.update() }
      else camera.lookAt(centre)
    }
  })
  return <group ref={outer}><group ref={inner}>{children}</group><LookOver root={inner} look={look} normals={normals && ready} /></group>
}

type Stats = { tris: number; ink: number; draws: number }

/** how the figure's drawn, for looking it over (the owner's): as it is, a plain clay, or each point coloured by the way it faces */
type Look = 'as' | 'clay' | 'normal'
const CLAY = new THREE.MeshStandardMaterial({ color: '#d8d2c8', roughness: 0.85 })
const NORMAL_LOOK = new THREE.MeshNormalMaterial()
/**
 * The figure's look-over tools: its materials swapped for a clay or a normals' colouring (each mesh's own kept and put back), and its
 * vertex normals drawn as short lines (a dark patch in its shading is often a normal turned wrong). Only on the viewer's own copy.
 */
function LookOver({ root, look, normals }: { root: React.RefObject<THREE.Group | null>; look: Look; normals: boolean }) {
  const helpers = useRef<NormalLines | null>(null)
  useEffect(() => {
    const g = root.current
    if (!g) return
    const was = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    if (look !== 'as') g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || ([] as THREE.Material[]).concat(m.material).every((x) => x.side === THREE.BackSide)) return
      was.set(m, m.material)
      m.material = look === 'clay' ? CLAY : NORMAL_LOOK
    })
    return () => { for (const [m, mat] of was) m.material = mat }
  }, [root, look])
  const scene = useThree((t) => t.scene)
  useEffect(() => {
    const g = root.current
    if (!g || !normals) return
    // (the lines' length by the figure's height (the owner's: 5%, never under 0.08; at two centimetres they were specks round it))
    g.updateMatrixWorld(true)
    const tall = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y
    const lines = new NormalLines(g, Math.max(tall * 0.05, 0.08))
    // (in the scene's own frame: hung under the turntable it was carried round twice, and its points were the model's at rest)
    scene.add(lines)
    helpers.current = lines
    return () => { lines.removeFromParent(); lines.geometry.dispose(); (lines.material as THREE.Material).dispose(); helpers.current = null }
  }, [root, normals, scene])
  useFrame(() => helpers.current?.update())
  return null
}

/**
 * Every vertex's normal drawn as a line out from it, in bright cyan, where the figure is drawn: through its skinning (the figures are one
 * rigidly skinned mesh each, their points at rest somewhere else entirely: three's VertexNormalsHelper reads the points at rest, and
 * scattered them round the body as specks), then the mesh's place in the world. Parts shrunk to nothing (a fan put away) left out.
 */
class NormalLines extends THREE.LineSegments {
  private meshes: THREE.Mesh[]
  private len: number
  constructor(root: THREE.Object3D, len: number) {
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry?.attributes?.normal || ([] as THREE.Material[]).concat(m.material).every((x) => x.side === THREE.BackSide)) return
      meshes.push(m)
    })
    const n = meshes.reduce((k, m) => k + m.geometry.attributes.position.count, 0)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3))
    super(geo, new THREE.LineBasicMaterial({ color: 0x00ffff }))
    this.meshes = meshes
    this.len = len
    this.frustumCulled = false
    this.matrixAutoUpdate = false
    this.update()
  }
  update() {
    const out = this.geometry.attributes.position as THREE.BufferAttribute
    const P = new THREE.Vector3(), N = new THREE.Vector3(), M = new THREE.Matrix4(), S = new THREE.Matrix4(), B = new THREE.Matrix4()
    const nm = new THREE.Matrix3()
    let k = 0
    for (const m of this.meshes) {
      m.updateWorldMatrix(true, false)
      const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal
      const sk = (m as THREE.SkinnedMesh).isSkinnedMesh ? (m as THREE.SkinnedMesh) : null
      const si = sk?.geometry.attributes.skinIndex, sw = sk?.geometry.attributes.skinWeight
      for (let i = 0; i < pos.count; i++, k += 2) {
        P.fromBufferAttribute(pos, i)
        N.fromBufferAttribute(nor, i)
        if (sk && si && sw) {
          // (the skinning: each bone's pose times its inverse at rest, by its weight, after the mesh's bind matrix; the bones' matrices are
          // the world's already, so the mesh's own place is in them)
          M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
          for (let j = 0; j < 4; j++) {
            const w = sw.getComponent(i, j)
            const bi = si.getComponent(i, j)
            const bone = sk.skeleton.bones[bi]
            if (!w || !bone) continue
            S.multiplyMatrices(bone.matrixWorld, sk.skeleton.boneInverses[bi])
            for (let e = 0; e < 16; e++) M.elements[e] += S.elements[e] * w
          }
          B.multiplyMatrices(M, sk.bindMatrix)
          P.applyMatrix4(B)
          N.applyMatrix3(nm.getNormalMatrix(B))
        } else {
          P.applyMatrix4(m.matrixWorld)
          N.applyMatrix3(nm.getNormalMatrix(m.matrixWorld))
        }
        // (a part shrunk to nothing: no line)
        if (!(N.lengthSq() > 1e-12) || !Number.isFinite(P.x) || !Number.isFinite(N.x)) { out.setXYZ(k, 0, -100, 0); out.setXYZ(k + 1, 0, -100, 0); continue }
        N.normalize()
        out.setXYZ(k, P.x, P.y, P.z)
        out.setXYZ(k + 1, P.x + N.x * this.len, P.y + N.y * this.len, P.z + N.z * this.len)
      }
    }
    out.needsUpdate = true
  }
}

function Lights() {
  const { scene } = useThree()
  useEffect(() => { scene.background = null }, [scene])
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#3a3040', 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2.5]} intensity={0.8} color="#bcd4ff" />
    </>
  )
}

export function CharacterViewer({ lang }: { lang: Lang }) {
  const [pick, setPick] = useState<{ key: string; n: number }>(() => {
    try { const v = JSON.parse(localStorage.getItem(KEY_PICK) ?? 'null'); if (v && ENTRIES.some((e) => e.key === v.key)) return v } catch { /* (none kept) */ }
    return { key: 'boss', n: 0 }
  })
  useEffect(() => { try { localStorage.setItem(KEY_PICK, JSON.stringify(pick)) } catch { /* (not kept) */ } }, [pick])
  const open = true
  // (slid off to the right, all but its handle (the owner's: a drawer's handle on its left edge), and its little canvas resting meanwhile)
  // (minimised into the dock at the bottom left, its pill there to bring it back (edit.ts holds it; the owner's: − and × on its title bar
  // as the dev panel's, no side handle); its little canvas resting meanwhile)
  const tucked = useSyncExternalStore(onCharHidden, getCharHidden)
  usePanelSound(!tucked)
  // (its height dragged at its foot, kept; the list inside scrolls)
  const [height, setHeight] = useState(() => { try { return Number(localStorage.getItem(KEY_H)) || 0 } catch { return 0 } })
  const dragH = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = (e.currentTarget as HTMLElement).parentElement!
    const y0 = e.clientY, h0 = el.offsetHeight
    const fit = (h: number) => Math.max(320, Math.min(window.innerHeight - 100, h))
    const move = (m: PointerEvent) => setHeight(fit(h0 + m.clientY - y0))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setHeight((h) => { try { localStorage.setItem(KEY_H, String(h)) } catch { /* */ } return h }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const [mood, setMood] = useState<Mood | null>(null)
  // (the owner's and the staff's expression to try (the owner's: Overcooked's faces), each with its squash and stretch)
  const [face, setFace] = useState<CrewFace>('idle')
  const [walk, setWalk] = useState(false)
  const [spin, setSpin] = useState(true)
  const [look, setLook] = useState<Look>('as')
  const [normals, setNormals] = useState(false)
  const [stats, setStats] = useState<Stats>({ tris: 0, ink: 0, draws: 0 })
  const e = ENTRIES.find((x) => x.key === pick.key) ?? ENTRIES[0]
  // (the one before or after in the list, round from the last to the first: the arrows either side of the stage (the owner's))
  const step = (d: number) => setPick((p) => {
    const i = Math.max(0, ENTRIES.findIndex((x) => x.key === p.key))
    return { key: ENTRIES[(i + d + ENTRIES.length) % ENTRIES.length].key, n: 0 }
  })
  const ids = e.kind ? IDS.get(e.kind) ?? [1] : []
  const gid = ids.length ? ids[pick.n % ids.length] : 0
  const name = tl(lang, e.zh, e.ja, e.en)
  const group = (g: Entry['group']) => tl(lang, g === 'boss' ? '老闆' : g === 'staff' ? '店員' : '客人', g === 'boss' ? '店主' : g === 'staff' ? 'スタッフ' : 'お客さん', g === 'boss' ? 'Owner' : g === 'staff' ? 'Staff' : 'Customers')
  const moods: [Mood | null, string][] = [[null, tl(lang, '平常', 'ふつう', 'Calm')], ['joy', tl(lang, '開心', 'うれしい', 'Happy')], ['mad', tl(lang, '生氣', '怒り', 'Cross')], ['sad', tl(lang, '難過', 'かなしい', 'Sad')]]
  const faces: [CrewFace, string][] = [['idle', tl(lang, '表情：平常', '表情：ふつう', 'Face: calm')], ['happy', tl(lang, '開心', 'うれしい', 'Happy')],
    ['focused', tl(lang, '認真', '真剣', 'Focused')], ['panic', tl(lang, '慌張', 'あわてる', 'Panic')], ['proud', tl(lang, '得意', '得意げ', 'Proud')],
    ['drink', tl(lang, '暢飲', 'ごくごく', 'Gulp')], ['talk', tl(lang, '說話', '話す', 'Talk')]]
  const minLabel = tl(lang, '縮到左下角', '左下にしまう', 'Minimise to the bottom left')
  const closeLabel = tl(lang, '關閉（離開開發者模式）', '閉じる（開発者モード終了）', 'Close (leave developer mode)')
  return createPortal(
    <div className={`char-dock${tucked ? ' is-tucked' : ''}`} style={height ? { height } : undefined}>
    <section className={`char-view${open ? '' : ' is-folded'}`} aria-label={tl(lang, '角色模型', 'キャラクター', 'Characters')} inert={tucked}>
      <header className="char-view-head">
        <b>{tl(lang, '角色模型', 'キャラクター', 'Characters')}</b>
        <span>{name}{e.kind ? ` #${gid}` : ''}</span>
        <button type="button" className="char-view-fold" onClick={() => setCharHidden(true)} title={minLabel} aria-label={minLabel}><Glyph id="minus" /></button>
        {/* (× leaves developer mode, as the dev panel's does (the owner's): both panels, the handles and the boxes gone) */}
        <button type="button" className="char-view-fold char-view-x" onClick={() => toggleEdit()} title={closeLabel} aria-label={closeLabel}><Glyph id="close" /></button>
      </header>
      {open && (<>
        <div className="char-view-stage">
          <Canvas dpr={[1, 1.5]} camera={{ fov: 28, position: [0, 1.25, 5.2] }} gl={{ antialias: true, alpha: true }} frameloop={tucked ? 'never' : 'always'}>
            <Lights />
            <Stand />
            <Suspense fallback={null}>
              <Fitted key={`${e.key}-${gid}`} onStats={setStats} spin={spin} look={look} normals={normals}>
                {e.group === 'boss' && <BossModel face={face} />}
                {e.group === 'staff' && <StaffFigure id={`viewer-${e.key}`} role={e.role!} look={{ female: !!e.female, age: 'young' }} moving={walk} face={face} />}
                {e.group === 'guest' && <FolkFigure id={gid} eating={false} walking={walk} mood={mood} ground />}
              </Fitted>
            </Suspense>
            <OrbitControls makeDefault target={[0, 0.9, 0]} enablePan={false} minDistance={2} maxDistance={9} />
            {/* (the wireframe (4) here too, its hidden lines hidden) */}
            <WireView />
          </Canvas>
          {([-1, 1] as const).map((d) => (
            <button key={d} type="button" className={`char-view-arrow ${d < 0 ? 'is-prev' : 'is-next'}`} onClick={() => step(d)}
              aria-label={d < 0 ? tl(lang, '上一個', '前へ', 'Previous') : tl(lang, '下一個', '次へ', 'Next')}>
              <svg viewBox="0 0 16 28" aria-hidden="true"><path d={d < 0 ? 'M11 4 3 14l8 10' : 'M5 4l8 10-8 10'} /></svg>
            </button>
          ))}
        </div>
        <div className="char-view-info">
          {tl(lang, `三角面 ${stats.tris.toLocaleString()}（描線 ${stats.ink.toLocaleString()}）・繪製 ${stats.draws} 次`, `三角形 ${stats.tris.toLocaleString()}（線 ${stats.ink.toLocaleString()}）・描画 ${stats.draws} 回`, `${stats.tris.toLocaleString()} tris (ink ${stats.ink.toLocaleString()}) · ${stats.draws} draws`)}
        </div>
        <div className="char-view-tools">
          <button type="button" className={spin ? 'is-on' : ''} onClick={() => setSpin((v) => !v)}>{tl(lang, '旋轉', '回転', 'Spin')}</button>
          {e.group !== 'boss' && <button type="button" className={walk ? 'is-on' : ''} onClick={() => setWalk((v) => !v)}>{tl(lang, '走路', '歩く', 'Walk')}</button>}
          {e.group === 'guest' && <button type="button" onClick={() => setPick((p) => ({ ...p, n: p.n + 1 }))}>{tl(lang, '換一位', '別の人', 'Another')}</button>}
          {/* (looking it over: clay, normals' colours, the normals drawn) */}
          {([['as', tl(lang, '原材質', '元の材質', 'As made')], ['clay', tl(lang, '白模', '白モデル', 'Clay')], ['normal', tl(lang, '法線色', '法線色', 'Normals')]] as [Look, string][]).map(([k, label]) => (
            <button key={k} type="button" className={look === k ? 'is-on' : ''} onClick={() => setLook(k)}>{label}</button>
          ))}
          <button type="button" className={normals ? 'is-on' : ''} onClick={() => setNormals((v) => !v)}>{tl(lang, '法線方向', '法線の向き', 'Normal lines')}</button>
          {e.group !== 'guest' && faces.map(([f, label]) => (
            <button key={f} type="button" className={face === f ? 'is-on' : ''} onClick={() => setFace(f)}>{label}</button>
          ))}
          {e.group === 'guest' && moods.map(([m, label]) => (
            <button key={label} type="button" className={mood === m ? 'is-on' : ''} onClick={() => setMood(m)}>{label}</button>
          ))}
        </div>
        <div className="char-view-list">
          {(['boss', 'staff', 'guest'] as const).map((g) => (
            <div key={g} className="char-view-group">
              <h4>{group(g)}</h4>
              {ENTRIES.filter((x) => x.group === g).map((x) => (
                <button key={x.key} type="button" className={x.key === e.key ? 'is-on' : ''} onClick={() => setPick({ key: x.key, n: 0 })}>{tl(lang, x.zh, x.ja, x.en)}</button>
              ))}
            </div>
          ))}
        </div>
      </>)}
    </section>
    <div className="char-view-grip" onPointerDown={dragH} title={tl(lang, '拖曳調整高度', 'ドラッグで高さを変える', 'Drag to resize')} />
    </div>,
    document.body,
  )
}
