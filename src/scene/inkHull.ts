import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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
