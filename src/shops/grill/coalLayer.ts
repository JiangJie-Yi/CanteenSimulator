import * as THREE from 'three'
import { ashMaterial, charcoalMaterial, type BinchotanKit } from './binchotanModel'

/**
 * The fire's charcoal drawn a few at a time: each of the kit's six stick shapes one instanced mesh for every stick of that shape on the fire
 * and one more for their ink, each of its six broken pieces one for the crumbs of ash. A stick's place, turn and size are its instance's
 * matrix, its colour (going grey with ash) the instance's colour, its glow and how much of it is left as it fades its own vec4 (`instGlow`:
 * the glow's colour times its strength, and an alpha the material hashes). Each stick was a mesh and a material of its own and its ink
 * another: a bed of twenty sticks, forty draws; now a dozen at most, the ash six more.
 */

/** what the fire sets on a stick or a crumb as it burns: the fields its own material had, set as they were */
export type CoalLook = { color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number; opacity: number; transparent: boolean; needsUpdate?: boolean }
export const coalLook = (): CoalLook => ({ color: new THREE.Color('#ffffff'), emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 0, opacity: 1, transparent: false })

/** a stick as the layer draws it: its pose (`g`, which the fire moves), which of the six it is, its size against the model's, its look */
export type CoalDrawn = { g: THREE.Object3D; shape: number; wide: number; long: number; mat: CoalLook; gone: boolean }
/** a crumb of ash: its pose, which of the six pieces, its length against the model's, its look */
export type CrumbDrawn = { m: THREE.Object3D; shape: number; sy: number; mat: CoalLook }

const STICKS_CAP = 48, CRUMBS_CAP = 40
/** the ink round a stick: its sides pushed out (not its ends, so the hollow ends stay open) */
const INK_OUT = new THREE.Matrix4().makeScale(1.07, 1, 1.07)

function instanced<M extends THREE.Material>(m: M): M {
  m.alphaHash = true
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 instGlow;\nvarying vec4 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = instGlow;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vGlow.a;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vGlow.rgb;')
  }
  m.customProgramCacheKey = () => 'coal-instanced'
  return m
}

type Batch = { geo: THREE.BufferGeometry; glow: THREE.InstancedBufferAttribute; meshes: THREE.InstancedMesh[]; n: number }

export function coalLayer(kit: BinchotanKit) {
  const group = new THREE.Group()
  group.name = 'coal-layer'
  const body = instanced(charcoalMaterial(kit))
  const ink = instanced(new THREE.MeshBasicMaterial({ color: '#3b2a20', side: THREE.BackSide }))
  const ash = instanced(ashMaterial(kit))
  const white = new THREE.Color('#ffffff')
  const batchOf = (src: THREE.BufferGeometry, cap: number, mats: THREE.Material[]): Batch => {
    // (its own copy of the shape, so letting it go lets go of nothing the kit still draws with)
    const geo = src.clone()
    const glow = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('instGlow', glow)
    const meshes = mats.map((mat) => {
      const m = new THREE.InstancedMesh(geo, mat, cap)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // (its colour there from the start: the program it's drawn with is made, and warmed with the page, with the instance's colour in it)
      if (mat !== ink) m.setColorAt(0, white)
      m.count = 0
      m.visible = false
      m.frustumCulled = false
      m.receiveShadow = true
      group.add(m)
      return m
    })
    return { geo, glow, meshes, n: 0 }
  }
  const sticks = Array.from({ length: 6 }, (_, k) => batchOf(kit.stickShape(k), STICKS_CAP, [body, ink]))
  const crumbs = Array.from({ length: 6 }, (_, k) => batchOf(kit.chunkShape(k).g, CRUMBS_CAP, [ash]))
  const all = [...sticks, ...crumbs]
  const m4 = new THREE.Matrix4(), s4 = new THREE.Matrix4()
  const glowAt = (b: Batch, i: number, look: CoalLook) => {
    const k = look.emissiveIntensity
    b.glow.setXYZW(i, look.emissive.r * k, look.emissive.g * k, look.emissive.b * k, look.transparent ? Math.min(1, Math.max(0, look.opacity)) : 1)
  }
  return {
    group,
    /** every stick and crumb as it is this frame, after the fire has moved and lit them */
    draw(coals: Iterable<CoalDrawn | undefined>, bits: Iterable<CrumbDrawn>) {
      for (const b of all) b.n = 0
      for (const c of coals) {
        if (!c || c.gone || !c.g.visible) continue
        const b = sticks[c.shape]
        if (b.n >= STICKS_CAP) continue
        const i = b.n++
        c.g.updateMatrix()
        m4.copy(c.g.matrix).multiply(s4.makeScale(c.wide, c.long, c.wide))
        b.meshes[0].setMatrixAt(i, m4)
        b.meshes[0].setColorAt(i, c.mat.color)
        b.meshes[1].setMatrixAt(i, m4.multiply(INK_OUT))
        glowAt(b, i, c.mat)
      }
      for (const k of bits) {
        const b = crumbs[k.shape]
        if (b.n >= CRUMBS_CAP) continue
        const i = b.n++
        k.m.updateMatrix()
        m4.copy(k.m.matrix).multiply(s4.makeScale(1, k.sy, 1))
        b.meshes[0].setMatrixAt(i, m4)
        b.meshes[0].setColorAt(i, k.mat.color)
        glowAt(b, i, k.mat)
      }
      for (const b of all) {
        for (const m of b.meshes) {
          m.count = b.n
          m.visible = b.n > 0
          if (!b.n) continue
          m.instanceMatrix.needsUpdate = true
          if (m.instanceColor) m.instanceColor.needsUpdate = true
        }
        if (b.n) b.glow.needsUpdate = true
      }
    },
    dispose() {
      for (const b of all) { for (const m of b.meshes) m.dispose(); b.geo.dispose() }
      body.dispose(); ink.dispose(); ash.dispose()
    },
  }
}
