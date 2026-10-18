import * as THREE from 'three'

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

/** give every mesh under root (a loaded model, not skinned) its ink outline, once; `skip` leaves out the transparent ones (glass) */
export function inkModel(root: THREE.Object3D, skip: (m: THREE.Mesh) => boolean = () => false) {
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.material !== HULL && !m.userData.inked && !skip(m)) meshes.push(m)
  })
  for (const m of meshes) {
    m.userData.inked = true
    const hull = new THREE.Mesh(m.geometry, HULL)
    hull.raycast = () => {}
    hull.userData.inked = true
    m.add(hull)
  }
}
