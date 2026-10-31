import { useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clearPref, prefOf, readPrefs, setPref, sigOf, writePrefs, type RenderPref, type RenderPrefs } from '@/game/renderPrefs'
import { isInk } from '@/scene/inkHull'
import { gradientMap } from '@/scene/Person3D'

/*
 * How each piece is drawn, as set in developer mode's Render section (game/renderPrefs holds the rules): kept in the browser, and laid
 * onto the scene by RenderPrefsApply, mesh by mesh, each going by the nearest piece (Movable) it's inside. A changed mesh keeps what it was
 * made with, to go back to; the materials it's given instead are made once for each of the originals and shared.
 */
const KEY = 'jgs-edit-render-1'
let prefs: RenderPrefs = (() => { try { return readPrefs(localStorage.getItem(KEY)) } catch { return {} } })()
let version = 0
const subs = new Set<() => void>()
function changed() {
  version++
  try { if (Object.keys(prefs).length) localStorage.setItem(KEY, writePrefs(prefs)); else localStorage.removeItem(KEY) } catch { /* (not kept) */ }
  for (const f of subs) f()
}
export const renderPrefOf = (id: string) => prefOf(prefs, id)
export function setRenderPref(id: string, patch: RenderPref) { prefs = setPref(prefs, id, patch); changed() }
export function clearRenderPref(id: string) { prefs = clearPref(prefs, id); changed() }
export function clearAllRenderPrefs() { if (!Object.keys(prefs).length) return; prefs = {}; changed() }
export const onRenderPrefs = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const useRenderPrefsVersion = () => useSyncExternalStore(onRenderPrefs, () => version)

/** what's drawn in place of an ink line that's been turned off */
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })
/** the materials made in place of the originals: one for each original, look and shading */
const variants = new Map<string, THREE.Material>()
/** a surface that can be drawn another way (not a shader of its own, a sprite, points or a line) */
const SURFACE = new Set(['MeshToonMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial'])
function variantOf(src: THREE.Material, p: RenderPref): THREE.Material {
  const look = p.look ?? 'keep', flat = p.shade === 'flat'
  if (!SURFACE.has(src.type) || (look === 'keep' && !flat)) return src
  const key = `${src.uuid}|${look}|${flat}`
  let v = variants.get(key)
  if (!v) {
    const s = src as THREE.MeshStandardMaterial
    const base = { color: s.color?.clone() ?? new THREE.Color('#ffffff'), map: s.map ?? null, transparent: src.transparent, opacity: src.opacity,
      alphaTest: src.alphaTest, side: src.side, vertexColors: src.vertexColors, depthWrite: src.depthWrite }
    if (look === 'keep') v = src.clone()
    else if (look === 'toon') v = new THREE.MeshToonMaterial({ ...base, gradientMap })
    else if (look === 'real') v = new THREE.MeshStandardMaterial({ ...base, roughness: 0.55, metalness: 0, normalMap: s.normalMap ?? null })
    else v = new THREE.MeshBasicMaterial(base)
    // (flat: each face lit as one, its edges showing; the toon material takes it too, though its types don't say so)
    ;(v as THREE.MeshStandardMaterial).flatShading = flat
    v.name = src.name
    variants.set(key, v)
  }
  return v
}

type Orig = { mat: THREE.Material | THREE.Material[]; cast: boolean; receive: boolean }
/** one mesh drawn as its piece is set (or as it was made, with no setting) */
function apply(m: THREE.Mesh, p: RenderPref | null) {
  const u = m.userData as { renderSig?: string; renderOrig?: Orig }
  const sig = p ? sigOf(p) : ''
  if ((u.renderSig ?? '') === sig) return
  u.renderSig = sig
  if (!u.renderOrig) {
    if (!sig) return
    u.renderOrig = { mat: m.material, cast: m.castShadow, receive: m.receiveShadow }
  }
  const o = u.renderOrig
  m.material = o.mat
  m.castShadow = o.cast
  m.receiveShadow = o.receive
  if (!p || !sig) { delete u.renderOrig; return }
  const mats = Array.isArray(o.mat) ? o.mat : [o.mat]
  // (an ink line: only on or off)
  if (mats.some(isInk)) { if (p.ink === false) m.material = HIDDEN; return }
  if (p.cast !== undefined) m.castShadow = p.cast
  if (p.receive !== undefined) m.receiveShadow = p.receive
  const swapped = mats.map((x) => variantOf(x, p))
  m.material = Array.isArray(o.mat) ? swapped : swapped[0]
}

function walk(o: THREE.Object3D, id: string | null) {
  // (the editor's own handles and boxes are left be)
  if (o.userData?.editHandle) return
  const own = (o.userData?.editId as string | undefined) ?? id
  if ((o as THREE.Mesh).isMesh) apply(o as THREE.Mesh, own ? prefs[own] ?? null : null)
  for (const c of o.children) walk(c, own)
}

/** lays the settings onto the scene: at once when they change, and every second while there are any (for what's loaded since) */
export function RenderPrefsApply() {
  const scene = useThree((s) => s.scene)
  const ver = useRenderPrefsVersion()
  const last = useRef({ ver: -1, t: -9 })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const any = Object.keys(prefs).length > 0
    if (last.current.ver === ver && (!any || t - last.current.t < 1)) return
    last.current = { ver, t }
    walk(scene, null)
  })
  return null
}
