import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** the shop's ink: a dark line round every object, drawn as its back faces pushed out a little along their normals */
const HULL = new THREE.ShaderMaterial({
  uniforms: { uWidth: { value: 0.012 }, uColor: { value: new THREE.Color('#3b2a20') } },
  vertexShader: /* glsl */ `
    uniform float uWidth;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * uWidth, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  side: THREE.BackSide,
})

/** the hull's material for a line of the given width (in the model's own units), kept once each */
const HULLS = new Map<number, THREE.ShaderMaterial>([[0.012, HULL]])
const HULL_MATS = new Set<THREE.Material>([HULL])
/** an ink line's material: one of the hulls made here, or any back-faced flat colour or shader drawn round a model as one (the inked
 * pieces made by hand, as Decor's) */
export const isInk = (m: THREE.Material) => HULL_MATS.has(m) || (m.side === THREE.BackSide && (m.type === 'MeshBasicMaterial' || m.type === 'ShaderMaterial'))
const hullOf = (width: number) => {
  let h = HULLS.get(width)
  if (!h) {
    h = HULL.clone()
    h.uniforms.uWidth = { value: width }
    h.uniforms.uColor = HULL.uniforms.uColor
    HULLS.set(width, h)
    HULL_MATS.add(h)
  }
  return h
}
/** the geometry's shape with its normals averaged where faces meet, so pushed out it stays closed round hard corners (no cracks, no spikes) */
function welded(g: THREE.BufferGeometry) {
  const p = new THREE.BufferGeometry()
  p.setAttribute('position', g.attributes.position)
  if (g.index) p.setIndex(g.index)
  const w = mergeVertices(p, 1e-5)
  w.computeVertexNormals()
  return w
}

/**
 * One ink line round several meshes that move together (a figure's body, whatever its materials; each at rest in the same frame): their
 * shapes put together and drawn as a single hull, one draw where each had its own. Null if there's nothing to ink.
 */
export function inkTogether(meshes: THREE.Mesh[], { width = 0.012, weld = false } = {}): THREE.Mesh | null {
  // (just where each is and, unwelded, which way it faces: the materials' own attributes needn't match)
  const shapes = meshes.map((m) => {
    const p = new THREE.BufferGeometry()
    p.setAttribute('position', m.geometry.attributes.position)
    if (!weld) p.setAttribute('normal', m.geometry.attributes.normal)
    if (m.geometry.index) p.setIndex(m.geometry.index)
    return m.geometry.index ? p.toNonIndexed() : p
  })
  if (!shapes.length) return null
  const all = shapes.length === 1 ? shapes[0] : mergeGeometries(shapes)
  if (!all) return null
  const geo = weld ? welded(all) : all
  const hull = new THREE.Mesh(geo, hullOf(width))
  hull.raycast = () => {}
  hull.userData.inked = true
  for (const m of meshes) m.userData.inked = true
  return hull
}

/**
 * give every mesh under root (a loaded model, not skinned) its ink outline, once; `skip` leaves out the transparent ones (glass).
 * `width` is the line's width in the model's own units; `weld` draws it round the shape with its normals averaged (for hard-edged models).
 */
export function inkModel(root: THREE.Object3D, skip: (m: THREE.Mesh) => boolean = () => false, { width = 0.012, weld = false } = {}) {
  const hullMat = hullOf(width)
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !HULL_MATS.has(m.material as THREE.Material) && !m.userData.inked && !skip(m)) meshes.push(m)
  })
  for (const m of meshes) {
    m.userData.inked = true
    const hull = new THREE.Mesh(weld ? welded(m.geometry) : m.geometry, hullMat)
    hull.raycast = () => {}
    hull.userData.inked = true
    m.add(hull)
  }
}
