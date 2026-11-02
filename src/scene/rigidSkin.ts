import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * A figure that moves in parts drawn as one mesh and one ink line (the owner's: a person in one or two draws): its pieces put together as a
 * single shape, each vertex wholly its piece's part (rigid skinning: one bone each, at full weight), the parts the very groups the figure's
 * motion already moves (its body, its hands, its eyes, what it holds), so nothing in how it moves changes; what comes and goes (a fan, the
 * glasses) is shown and hidden by scaling its part to nothing. Each vertex also carries how it's painted (`paint`): x lit (0) or flat (1),
 * as the eyes are; y whether shadows fall on it (the head takes none); z which picture it's painted from (a figure with more than one).
 */

/** a piece of the figure: its shape (not indexed, in the figure's frame at rest), the part that moves it (an index into the bones), inked or
 * not, flat or lit, shadowed or not, and which picture (0: none, its colour only) */
export type SkinPiece = { geo: THREE.BufferGeometry; bone: number; inked?: boolean; flat?: boolean; shadowless?: boolean; pic?: number }

const ones = (n: number, k: number) => new THREE.Float32BufferAttribute(new Float32Array(n * k).fill(1), k)

/** the pieces as one shape: their positions, normals, UVs and colours, each vertex's part, and how it's painted */
export function skinShape(pieces: SkinPiece[]) {
  const geos = pieces.map((p) => {
    const g = p.geo
    const n = g.attributes.position.count
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), paint = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      si[i * 4] = p.bone
      sw[i * 4] = 1
      paint[i * 3] = p.flat ? 1 : 0
      paint[i * 3 + 1] = p.shadowless ? 0 : 1
      paint[i * 3 + 2] = p.pic ?? 0
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', g.attributes.position)
    out.setAttribute('normal', g.attributes.normal)
    out.setAttribute('uv', g.attributes.uv ?? new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
    out.setAttribute('color', g.attributes.color ?? ones(n, 3))
    out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    out.setAttribute('paint', new THREE.Float32BufferAttribute(paint, 3))
    return out
  })
  const all = geos.length === 1 ? geos[0] : mergeGeometries(geos)
  if (!all) throw new Error('rigidSkin: the pieces would not go together')
  return all
}

/** the ink round the inked pieces: their shapes welded (the normals averaged where faces meet, so pushed out the line stays closed round hard
 * corners), each vertex with its part; null if nothing's inked */
export function skinInkShape(pieces: SkinPiece[]) {
  const inked = pieces.filter((p) => p.inked)
  if (!inked.length) return null
  const geos = inked.map((p) => {
    const n = p.geo.attributes.position.count
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) { si[i * 4] = p.bone; sw[i * 4] = 1 }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', p.geo.attributes.position)
    out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    return out
  })
  const all = geos.length === 1 ? geos[0] : mergeGeometries(geos)
  if (!all) return null
  // (welded where a point and its part are the same: two parts touching stay apart)
  const w = mergeVertices(all, 1e-5)
  w.computeVertexNormals()
  return w
}

/** the shop's ink (as scene/inkHull's, the same colour), bending with the figure's parts: its back faces pushed out along their skinned normals */
const SKIN_HULLS = new Map<number, THREE.ShaderMaterial>()
export function skinHull(width: number) {
  let m = SKIN_HULLS.get(width)
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color('#3b2a20') } },
      vertexShader: /* glsl */ `
        #include <common>
        #include <skinning_pars_vertex>
        uniform float uWidth;
        void main() {
          #include <skinbase_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          // (a part scaled to nothing (put away) has no normal left: it stays nothing, not pushed out to nowhere)
          float nl = length(objectNormal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed + (nl > 1e-6 ? objectNormal / nl : vec3(0.0)) * uWidth, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }`,
      side: THREE.BackSide,
    })
    SKIN_HULLS.set(width, m)
  }
  return m
}

/**
 * A toon material taught the figure's `paint`: a flat vertex (the eyes' whites and darks) shows its colour as it is, unlit; a shadowless one
 * (the head) takes no shadow from the shop's lights. Kept with whatever the material already does to its shaders (the people's airbrush).
 */
export function paintable<M extends THREE.Material>(m: M): M {
  const before = m.onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 paint;\nvarying vec3 vPaint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaint = paint;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaint;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replaceAll('&& receiveShadow )', '&& receiveShadow && vPaint.y > 0.5 )'))
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, vPaint.x);\n#include <opaque_fragment>')
  }
  const key = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${key()}|paint`
  return m
}

/**
 * The figure's one mesh (and its ink), on `root`, bound to `bones` (the groups that move its parts, in the figure, at rest as they are now):
 * each part's inverse taken here, so a vertex goes where its part goes. Its bounds a little generous, for the hands that swing out.
 */
export function rigidFigure(root: THREE.Object3D, pieces: SkinPiece[], material: THREE.Material, bones: THREE.Object3D[], inkWidth: number) {
  const mesh = new THREE.SkinnedMesh(skinShape(pieces), material)
  root.add(mesh)
  const inkGeo = skinInkShape(pieces)
  const ink = inkGeo ? new THREE.SkinnedMesh(inkGeo, skinHull(inkWidth)) : null
  if (ink) {
    ink.raycast = () => {}
    ink.userData.inked = true
    root.add(ink)
  }
  root.updateMatrixWorld(true)
  const inverses = bones.map((b) => b.matrixWorld.clone().invert())
  const skeleton = new THREE.Skeleton(bones as THREE.Bone[], inverses)
  for (const m of ink ? [mesh, ink] : [mesh]) {
    m.bind(skeleton, m.matrixWorld)
    m.computeBoundingSphere()
    m.boundingSphere!.radius *= 1.6
  }
  return { mesh, ink }
}
