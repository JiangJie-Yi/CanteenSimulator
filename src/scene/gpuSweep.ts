import * as THREE from 'three'

/*
 * In development only: what a hot update leaves behind on the GPU, let go. Vite swaps an edited module for a fresh copy and React runs the
 * memos of its components again, so the textures and shapes the old copy made (at the top of the module, and in every memo) are never
 * disposed: they stay on the GPU, counted by three, as long as the tab stays open (the owner's dev tab, after a day of edits: 4,662 shapes
 * and 1,227 textures, where the shop uses about 2,100 and 380). So every texture and geometry is noted as it's made (forgotten again once
 * it's disposed), and a few seconds after each hot update of code, every one noted that nothing in the scene uses is disposed. What's kept
 * for later and isn't drawn just now (a customer's look not in the shop, the lamps' unlit paper) is only put on the GPU again when it's next
 * drawn; render targets (the shadow maps, the room's light) are never noted. Imported first of all (main.tsx), before anything is made.
 */

const made = new Set<THREE.Texture | THREE.BufferGeometry>()

if (import.meta.env.DEV) {
  const tp = THREE.Texture.prototype
  const need = Object.getOwnPropertyDescriptor(tp, 'needsUpdate')
  if (need?.set) {
    Object.defineProperty(tp, 'needsUpdate', {
      configurable: true,
      get: need.get,
      set(this: THREE.Texture, v: boolean) {
        if (v && !(this as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) made.add(this)
        need.set!.call(this, v)
      },
    })
  }
  const tDispose = tp.dispose
  tp.dispose = function (this: THREE.Texture) { made.delete(this); return tDispose.call(this) }
  const gp = THREE.BufferGeometry.prototype
  const set = gp.setAttribute
  gp.setAttribute = function (this: THREE.BufferGeometry, ...a: Parameters<typeof set>) { made.add(this); return set.apply(this, a) } as typeof set
  const gDispose = gp.dispose
  gp.dispose = function (this: THREE.BufferGeometry) { made.delete(this); return gDispose.call(this) }
}

/** let go of every texture and geometry noted that nothing in the scene draws: how many of each */
export function gpuSweep(scene: THREE.Object3D): { textures: number; geometries: number } {
  const used = new Set<unknown>()
  const take = (v: unknown) => { if (v && (v as THREE.Texture).isTexture) used.add(v) }
  scene.traverse((o) => {
    const m = o as THREE.Mesh & { skeleton?: THREE.Skeleton }
    if (m.geometry) used.add(m.geometry)
    take(m.skeleton?.boneTexture)
    for (const mat of ([] as (THREE.Material | undefined)[]).concat(m.material)) {
      if (!mat) continue
      for (const v of Object.values(mat)) take(v)
      for (const u of Object.values((mat as THREE.ShaderMaterial).uniforms ?? {})) take(u?.value)
    }
  })
  const sc = scene as THREE.Scene
  take(sc.background)
  take(sc.environment)
  let textures = 0, geometries = 0
  for (const r of [...made]) {
    if (used.has(r)) continue
    if ((r as THREE.Texture).isTexture) {
      // (a picture that couldn't be put back (one with nothing to upload from) is left be)
      if (!(r as THREE.Texture).image) continue
      textures++
    } else geometries++
    r.dispose()
  }
  return { textures, geometries }
}

if (import.meta.env.DEV && import.meta.hot) {
  let wait = 0
  import.meta.hot.on('vite:afterUpdate', (payload: { updates?: { type: string }[] }) => {
    if (!payload.updates?.some((u) => u.type === 'js-update')) return
    window.clearTimeout(wait)
    wait = window.setTimeout(() => {
      const scene = (window as unknown as { __scene?: THREE.Scene }).__scene
      if (!scene) return
      const n = gpuSweep(scene)
      if (n.textures || n.geometries) console.info(`[gpu sweep] after a hot update: let go of ${n.textures} textures, ${n.geometries} geometries`)
    }, 4000)
  })
  ;(window as unknown as { __gpuSweep?: () => unknown }).__gpuSweep = () => {
    const scene = (window as unknown as { __scene?: THREE.Scene }).__scene
    return scene ? gpuSweep(scene) : null
  }
}
