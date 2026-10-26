import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The till's order tablet on its stand, from blender/ipad.py, in the frame the till had it (the stand's middle at the origin, the screen
 * toward +z), held landscape. Unlike the room's toon things it's finished as it really is: bead-blasted aluminium and glass that catch the
 * room's light, the lenses dark and glossy, a faint reflection over the screen; the screen shows a till app the way a tablet's OS draws it.
 */
const IPAD_URL = import.meta.env.BASE_URL + 'models/ipad.glb'
/** the parts too small or too flat for an ink line */
const UNINKED = /^Ipad(Screen|Glass|FrontCam|Grille|Port|Connector|BackLens|BackIris|Flash|MicHole|TopButton|Volume|StandFoot|StandLedgePad)/

/** each of the model's materials as it really looks */
function realMaterial(src: THREE.MeshStandardMaterial): THREE.Material {
  switch (src.name) {
    case 'IpadAlu':
      return new THREE.MeshPhysicalMaterial({ color: '#d4d7dc', map: src.map, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.1 })
    case 'IpadStand':
      return new THREE.MeshPhysicalMaterial({ color: '#b9bdc3', metalness: 0.8, roughness: 0.38 })
    case 'IpadGlass':
      return new THREE.MeshPhysicalMaterial({ color: '#08090b', metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 })
    case 'IpadLens':
      return new THREE.MeshPhysicalMaterial({ color: '#07080b', metalness: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01 })
    case 'IpadRing':
      return new THREE.MeshPhysicalMaterial({ color: '#46494f', metalness: 0.95, roughness: 0.22 })
    case 'IpadIris':
      return new THREE.MeshPhysicalMaterial({ color: '#2b3f80', metalness: 0.6, roughness: 0.08, iridescence: 0.8 })
    case 'IpadFlashGlass':
      return new THREE.MeshPhysicalMaterial({ color: '#efe6cf', roughness: 0.15, clearcoat: 1 })
    case 'IpadRubber':
      return new THREE.MeshStandardMaterial({ color: src.color.clone(), roughness: 0.9 })
    default:
      return new THREE.MeshStandardMaterial({ color: src.color.clone(), map: src.map, roughness: src.roughness, metalness: src.metalness })
  }
}

/** a soft streak of light across the screen's glass, as a window or lamp leaves on it */
const GLARE = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 180
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 256, 180)
  grad.addColorStop(0, 'rgba(255,255,255,0.10)')
  grad.addColorStop(0.32, 'rgba(255,255,255,0.03)')
  grad.addColorStop(0.42, 'rgba(255,255,255,0.09)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 180)
  return new THREE.CanvasTexture(c)
})()

/**
 * The till app on the screen, landscape, as the tablet's OS draws its apps: the status bar (time, date, Wi-Fi, battery), the app's nav bar,
 * category tabs as a segmented control, the menu as rounded cards, the order on the right with the subtotal, tax, total and a big blue pay
 * button, and the home indicator at the foot. System fonts, its greys and its blue.
 */
// (the screen's own proportions: 2360 x 1640)
const W = 1024, H = 712
const SANS = '-apple-system, "SF Pro Text", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Segoe UI", sans-serif'
const BLUE = '#007aff'
const ITEMS: [string, number, string][] = [
  ['鮎の塩焼き', 420, '#f2c38b'], ['秋刀魚', 380, '#9fb7d9'], ['鯖の塩焼き', 400, '#a9c8a0'], ['焼きおにぎり', 160, '#e9d79c'],
  ['ししとう', 120, '#b9d79a'], ['エリンギ', 140, '#d9c4a6'], ['生ビール', 180, '#f4d36b'], ['烏龍茶', 120, '#c9a27a'],
  ['鮎定食', 1200, '#e8b98a'], ['秋刀魚定食', 1100, '#a8bfe0'], ['味噌汁', 150, '#d6b48a'], ['枝豆', 300, '#9fcf8a'],
]
const ORDER: [string, number, number][] = [['鮎の塩焼き', 2, 840], ['秋刀魚', 1, 380], ['生ビール', 3, 540], ['焼きおにぎり', 2, 320]]
const yen = (n: number) => '¥' + n.toLocaleString('ja-JP')
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r) }
export const TILL_APP = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.textBaseline = 'middle'
  // the app's background, the system's grouped grey
  g.fillStyle = '#f2f2f7'
  g.fillRect(0, 0, W, H)
  // the status bar: the time and the date at the left, Wi-Fi and the battery at the right
  g.fillStyle = '#000'
  g.font = `600 17px ${SANS}`
  g.fillText('9:41', 22, 16)
  g.font = `500 17px ${SANS}`
  g.fillText('10月26日(日)', 66, 16)
  g.textAlign = 'right'
  g.fillText('100%', W - 54, 16)
  g.textAlign = 'left'
  rr(g, W - 46, 9, 26, 13, 4); g.lineWidth = 1.3; g.strokeStyle = '#000'; g.stroke()
  rr(g, W - 44, 11, 22, 9, 2.5); g.fill()
  g.fillRect(W - 19, 13, 2, 5)
  for (let k = 0; k < 3; k++) {
    g.beginPath(); g.arc(W - 112, 22, 4 + k * 4, -Math.PI * 0.75, -Math.PI * 0.25); g.lineWidth = 2.2; g.stroke()
  }
  // the nav bar: a large title, a search field, the buttons in the system blue
  g.font = `700 34px ${SANS}`
  g.fillText('お会計', 24, 64)
  rr(g, 170, 48, 300, 34, 10); g.fillStyle = '#e3e3e8'; g.fill()
  g.fillStyle = '#8e8e93'; g.font = `400 16px ${SANS}`; g.fillText('🔍  メニューを検索', 184, 66)
  g.fillStyle = BLUE; g.font = `500 17px ${SANS}`; g.textAlign = 'right'; g.fillText('履歴', 668, 65); g.textAlign = 'left'
  // the category tabs, a segmented control
  const tabs = ['すべて', '焼き物', '飲み物', '定食', '小鉢']
  rr(g, 24, 96, 644, 32, 9); g.fillStyle = '#e3e3e8'; g.fill()
  const tw = 644 / tabs.length
  rr(g, 26, 98, tw - 4, 28, 7); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.12)'; g.shadowBlur = 4; g.fill(); g.shadowBlur = 0
  g.font = `700 17px ${SANS}`; g.fillStyle = '#000'; g.textAlign = 'center'
  tabs.forEach((t, i) => g.fillText(t, 24 + tw * (i + 0.5), 113))
  g.textAlign = 'left'
  // the menu as cards: a picture swatch, the name, the price
  const cw = 152, ch = 168
  ITEMS.forEach(([name, price, col], i) => {
    const x = 24 + (i % 4) * (cw + 12), y = 142 + Math.floor(i / 4) * (ch + 10)
    rr(g, x, y, cw, ch, 14); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.08)'; g.shadowBlur = 8; g.shadowOffsetY = 2; g.fill()
    g.shadowBlur = 0; g.shadowOffsetY = 0
    g.save(); rr(g, x, y, cw, 92, 14); g.clip(); g.fillStyle = col; g.fillRect(x, y, cw, 92)
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x + cw / 2, y + 48, 40, 24, -0.3, 0, Math.PI * 2); g.fill(); g.restore()
    g.fillStyle = '#000'; g.font = `700 21px ${SANS}`; g.fillText(name, x + 12, y + 118, cw - 20)
    g.fillStyle = '#6c6c70'; g.font = `600 19px ${SANS}`; g.fillText(yen(price), x + 12, y + 146)
    if (i === 0 || i === 6) { g.beginPath(); g.arc(x + cw - 18, y + 18, 11, 0, Math.PI * 2); g.fillStyle = BLUE; g.fill(); g.fillStyle = '#fff'; g.font = `700 13px ${SANS}`; g.textAlign = 'center'; g.fillText(i === 0 ? '2' : '3', x + cw - 18, y + 18); g.textAlign = 'left' }
  })
  // the order, a panel down the right: its lines, the sums, the pay button
  const px = 692, pw = W - px - 20
  rr(g, px, 48, pw, H - 74, 16); g.fillStyle = '#fff'; g.fill()
  g.fillStyle = '#000'; g.font = `700 24px ${SANS}`; g.fillText('ご注文', px + 18, 76)
  g.fillStyle = '#8e8e93'; g.font = `500 14px ${SANS}`; g.textAlign = 'right'; g.fillText('3番テーブル・#0042', px + pw - 16, 77); g.textAlign = 'left'
  let y = 112
  for (const [name, n, sum] of ORDER) {
    g.fillStyle = '#000'; g.font = `600 20px ${SANS}`; g.fillText(name, px + 18, y)
    g.fillStyle = '#8e8e93'; g.font = `500 16px ${SANS}`; g.fillText(`× ${n}`, px + 18, y + 24)
    g.fillStyle = '#000'; g.font = `600 20px ${SANS}`; g.textAlign = 'right'; g.fillText(yen(sum), px + pw - 18, y + 6); g.textAlign = 'left'
    g.fillStyle = '#e5e5ea'; g.fillRect(px + 18, y + 40, pw - 36, 1)
    y += 60
  }
  const total = ORDER.reduce((a, o) => a + o[2], 0)
  const row = (a: string, b: string, yy: number, big = false) => {
    g.fillStyle = big ? '#000' : '#6c6c70'; g.font = `${big ? 700 : 600} ${big ? 28 : 18}px ${SANS}`
    g.fillText(a, px + 18, yy); g.textAlign = 'right'; g.fillText(b, px + pw - 18, yy); g.textAlign = 'left'
  }
  row('小計', yen(total), H - 200)
  row('内消費税 (10%)', yen(Math.round(total / 11)), H - 174)
  row('合計', yen(total), H - 136, true)
  rr(g, px + 16, H - 104, pw - 32, 52, 14); g.fillStyle = BLUE; g.fill()
  g.fillStyle = '#fff'; g.font = `700 24px ${SANS}`; g.textAlign = 'center'; g.fillText('会計する', px + pw / 2, H - 78); g.textAlign = 'left'
  // the home indicator
  rr(g, W / 2 - 70, H - 12, 140, 5, 3); g.fillStyle = '#1c1c1e'; g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
})()

export function IpadModel() {
  const gltf = useGLTF(IPAD_URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    const r = gltf.scene.clone(true)
    const mats = new Map<THREE.Material, THREE.Material>()
    let screen: THREE.Mesh | null = null
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (m.name === 'IpadScreen') { screen = m; return }
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) { t = realMaterial(src); mats.set(src, t) }
      m.material = t
      m.castShadow = !UNINKED.test(m.name)
    })
    inkModel(r, (m) => UNINKED.test(m.name), { width: 0.0009, weld: true })
    if (screen) {
      const s = screen as THREE.Mesh
      // (the app, as bright as a screen is: glTF's UVs run top to bottom, the canvas's bottom to top)
      const g = s.geometry.clone()
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
      s.geometry = g
      s.material = new THREE.MeshBasicMaterial({ map: TILL_APP, toneMapped: false })
      // (and the glare on its glass, a hair in front)
      const glare = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: GLARE, transparent: true, depthWrite: false, toneMapped: false }))
      glare.position.z = 0.0002
      glare.renderOrder = 2
      glare.raycast = () => {}
      s.add(glare)
    }
    return r
  }, [gltf])
  return <primitive object={root} />
}
useGLTF.preload(IPAD_URL)
