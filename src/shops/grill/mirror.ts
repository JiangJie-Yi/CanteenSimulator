import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

/*
 * A washroom's round mirror that shows what's in front of it (the owner's: the guests washing their hands seen in it): three's Reflector,
 * the scene drawn again from the far side of the glass into a picture laid on it. Kept cheap: drawn only while the eye is near and the glass
 * is in sight (three skips it when it's off screen or turned away), every other frame, at 512 square; and only what's near the mirror is in
 * it (its own layer: the room it hangs in, the people, the lights), not the whole shop again.
 */
const LAYER = 3
/** how near the eye has to be for the mirror to show its room, not the studio's blur (m, scene units) */
const NEAR = 4.5
/** what's within this of the mirror is drawn in it (its room and what's in it) */
const REACH = 2.2

const SHADER = {
  name: 'RoundMirror',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLoc;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLoc = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vLoc;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      // (round: a square of two triangles, its corners cut away here, not a fan of them into its middle)
      if (distance(vLoc, vec2(0.5)) > 0.5) discard;
      vec4 base = texture2DProj(tDiffuse, vUv);
      gl_FragColor = vec4(base.rgb * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}

export type Mirror = { glass: Reflector; tick: (scene: THREE.Scene, camera: THREE.Camera, frame: number) => boolean }

/** a round mirror `r` across its radius, its face toward its own +z; tick() each frame says whether it's showing (else show the plain glass) */
export function roundMirror(r: number): Mirror {
  const glass = new Reflector(new THREE.PlaneGeometry(2 * r, 2 * r), {
    textureWidth: 512, textureHeight: 512, multisample: 2, color: new THREE.Color('#dfe6e8'), shader: SHADER, clipBias: 0.002,
  })
  glass.name = 'WashMirrorGlass'
  glass.raycast = () => {}
  // (its reflection camera, made once for the eye's and kept: given the mirror's layer only)
  const made = glass.getReflectionCamera.bind(glass)
  glass.getReflectionCamera = (cam: THREE.Camera) => {
    const c = made(cam)
    if (!c.userData.mirror) { c.userData.mirror = true; c.layers.set(LAYER) }
    return c
  }
  // (every other frame: the picture kept from the last one between)
  const draw = glass.onBeforeRender
  let odd = false
  glass.onBeforeRender = function (...args) { odd = !odd; if (odd || glass.forceUpdate) draw.apply(this, args) }
  const at = new THREE.Vector3(), eye = new THREE.Vector3(), sphere = new THREE.Sphere()
  let swept = -1e9
  const tick = (scene: THREE.Scene, camera: THREE.Camera, frame: number) => {
    glass.getWorldPosition(at)
    camera.getWorldPosition(eye)
    const on = eye.distanceTo(at) < NEAR
    glass.visible = on
    // (now and then while it shows: what's come near it (a guest walked in), the people and the lights, put on its layer)
    if (on && frame - swept > 60) {
      swept = frame
      scene.traverse((o) => {
        if ((o as THREE.Light).isLight || (o as THREE.SkinnedMesh).isSkinnedMesh) { o.layers.enable(LAYER); return }
        const m = o as THREE.Mesh
        if (!m.isMesh || o === glass || !m.geometry) return
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
        sphere.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld)
        if (sphere.center.distanceTo(at) - sphere.radius < REACH) o.layers.enable(LAYER)
      })
    }
    return on
  }
  return { glass, tick }
}
