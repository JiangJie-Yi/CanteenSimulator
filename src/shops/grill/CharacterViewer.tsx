// Developer mode's character viewer (the owner's: it comes with G, on the right): every figure in the game on a turntable, the owner, the
// staff in each of their outfits, every kind of customer (another of the same kind at a click), turned with the mouse and zoomed with the
// wheel; a customer's moods and anyone's walk to try; how many triangles and draws each one is. Its own little canvas (its own GL context),
// mounted only while developer mode is on.
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js'
import { KINDS, kindOf, type GuestKind } from '@/data/guests'
import { tl, type Lang } from '@/data/i18n'
import type { Role } from '@/data/staff'
import { FolkFigure } from '@/scene/FolkFigure'
import type { Mood } from '@/scene/people'
import { StaffFigure } from '@/scene/StaffFigure'
import { BossModel } from './Boss'
import { WireView } from './Movable'
import { usePanelSound } from '@/ui/uiSound'
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
function Fitted({ children, onStats, spin, look, normals }: { children: React.ReactNode; onStats: (s: { tris: number; draws: number }) => void; spin: boolean; look: Look; normals: boolean }) {
  const inner = useRef<THREE.Group>(null)
  const outer = useRef<THREE.Group>(null)
  const tries = useRef(0)
  const box = useMemo(() => new THREE.Box3(), [])
  useFrame((_, dt) => {
    const o = outer.current, g = inner.current
    if (!o || !g) return
    if (spin) o.rotation.y += Math.min(dt, 0.1) * 0.45
    // (measured for the first frames: a model loads, and grows, a frame or two after it's mounted)
    if (tries.current > 40) return
    tries.current++
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)
    box.makeEmpty()
    let tris = 0, draws = 0
    g.traverse((q) => {
      const m = q as THREE.Mesh
      if (!m.isMesh || !m.visible) return
      draws++
      const geo = m.geometry
      tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3
      box.expandByObject(m)
    })
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const k = STAND_H / Math.max(0.01, size.y)
    g.scale.setScalar(k)
    const c = box.getCenter(new THREE.Vector3())
    g.position.set(-c.x * k, -box.min.y * k, -c.z * k)
    if (tries.current % 10 === 0) onStats({ tris: Math.round(tris), draws })
  })
  return <group ref={outer}><group ref={inner}>{children}</group><LookOver root={inner} look={look} normals={normals} /></group>
}

/** how the figure's drawn, for looking it over (the owner's): as it is, a plain clay, or each point coloured by the way it faces */
type Look = 'as' | 'clay' | 'normal'
const CLAY = new THREE.MeshStandardMaterial({ color: '#d8d2c8', roughness: 0.85 })
const NORMAL_LOOK = new THREE.MeshNormalMaterial()
/**
 * The figure's look-over tools: its materials swapped for a clay or a normals' colouring (each mesh's own kept and put back), and its
 * vertex normals drawn as short lines (a dark patch in its shading is often a normal turned wrong). Only on the viewer's own copy.
 */
function LookOver({ root, look, normals }: { root: React.RefObject<THREE.Group | null>; look: Look; normals: boolean }) {
  const helpers = useRef<VertexNormalsHelper[]>([])
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
  useEffect(() => {
    const g = root.current
    if (!g || !normals) return
    const made: VertexNormalsHelper[] = []
    g.updateMatrixWorld(true)
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry?.attributes?.normal || ([] as THREE.Material[]).concat(m.material).every((x) => x.side === THREE.BackSide)) return
      // (about two centimetres a line, whatever the figure's been scaled by)
      const h = new VertexNormalsHelper(m, 0.02 / Math.max(1e-3, g.getWorldScale(new THREE.Vector3()).x), 0x33ccff)
      g.parent?.add(h)
      made.push(h)
    })
    helpers.current = made
    return () => { for (const h of made) { h.removeFromParent(); h.geometry.dispose(); (h.material as THREE.Material).dispose() } helpers.current = [] }
  }, [root, normals])
  useFrame(() => { for (const h of helpers.current) h.update() })
  return null
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
  const [walk, setWalk] = useState(false)
  const [spin, setSpin] = useState(true)
  const [look, setLook] = useState<Look>('as')
  const [normals, setNormals] = useState(false)
  const [stats, setStats] = useState({ tris: 0, draws: 0 })
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
  const minLabel = tl(lang, '縮到左下角', '左下にしまう', 'Minimise to the bottom left')
  const closeLabel = tl(lang, '關閉（離開開發者模式）', '閉じる（開発者モード終了）', 'Close (leave developer mode)')
  return createPortal(
    <div className={`char-dock${tucked ? ' is-tucked' : ''}`} style={height ? { height } : undefined}>
    <section className={`char-view${open ? '' : ' is-folded'}`} aria-label={tl(lang, '角色模型', 'キャラクター', 'Characters')} inert={tucked}>
      <header className="char-view-head">
        <b>{tl(lang, '角色模型', 'キャラクター', 'Characters')}</b>
        <span>{name}{e.kind ? ` #${gid}` : ''}</span>
        <button type="button" className="char-view-fold" onClick={() => setCharHidden(true)} title={minLabel} aria-label={minLabel}>−</button>
        {/* (× leaves developer mode, as the dev panel's does (the owner's): both panels, the handles and the boxes gone) */}
        <button type="button" className="char-view-fold char-view-x" onClick={() => toggleEdit()} title={closeLabel} aria-label={closeLabel}>×</button>
      </header>
      {open && (<>
        <div className="char-view-stage">
          <Canvas dpr={[1, 1.5]} camera={{ fov: 28, position: [0, 1.25, 5.2] }} gl={{ antialias: true, alpha: true }} frameloop={tucked ? 'never' : 'always'}>
            <Lights />
            <Stand />
            <Suspense fallback={null}>
              <Fitted key={`${e.key}-${gid}`} onStats={setStats} spin={spin} look={look} normals={normals}>
                {e.group === 'boss' && <BossModel />}
                {e.group === 'staff' && <StaffFigure id={`viewer-${e.key}`} role={e.role!} look={{ female: !!e.female, age: 'young' }} moving={walk} />}
                {e.group === 'guest' && <FolkFigure id={gid} eating={false} walking={walk} mood={mood} ground />}
              </Fitted>
            </Suspense>
            <OrbitControls target={[0, 0.9, 0]} enablePan={false} minDistance={2} maxDistance={9} />
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
          {tl(lang, `三角面 ${stats.tris.toLocaleString()}・繪製 ${stats.draws} 次`, `三角形 ${stats.tris.toLocaleString()}・描画 ${stats.draws} 回`, `${stats.tris.toLocaleString()} triangles · ${stats.draws} draws`)}
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
