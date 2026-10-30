import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from './quality'

/**
 * The look of the fixed views (every one but the free view): the picture softens toward the edges (a blur growing with the distance from
 * the middle, the middle sharp) and darkens all round its rim (a vignette); with `bulge`, it also bows out from the middle as through a
 * fisheye (barrel distortion, drawn in a little so the corners stay filled), for the view that follows the owner about.
 *
 * Mounted only while such a view is on: it takes the frame over (a useFrame of priority 1), drawing the scene into a target and that
 * through the lens onto the screen.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`
const FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 texel;
uniform float aspect;
uniform float bulge;
uniform float blur;
uniform float vignette;
varying vec2 vUv;
vec2 lens(vec2 uv) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= aspect;
  // (the distance out, 1 at the corners; the corners pulled in by as much as they'd bow out, so the picture still fills the frame)
  float r2 = dot(p, p) / (aspect * aspect + 1.0);
  p *= (1.0 + bulge * r2) / (1.0 + bulge);
  p.x /= aspect;
  return p * 0.5 + 0.5;
}
void main() {
  vec2 uv = lens(vUv);
  vec2 c = (vUv - 0.5) * 2.0;
  c.x *= aspect;
  float r = length(c) / sqrt(aspect * aspect + 1.0);
  // (the blur: a ring of taps round the point, wider the further out it is; the middle third untouched)
  float spread = blur * smoothstep(0.32, 1.0, r);
  vec4 col = texture2D(tScene, uv);
  if (spread > 0.01) {
    vec4 sum = col;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      float k = (i % 2 == 0) ? 1.0 : 0.55;
      sum += texture2D(tScene, uv + vec2(cos(a), sin(a)) * texel * spread * k);
    }
    col = sum / 13.0;
  }
  // (the rim darkened, softly, deepest in the corners; over the page behind the canvas too, where the scene left it clear: the colour is
  // premultiplied, so the dark is laid on by taking away colour and adding cover)
  float v = vignette * smoothstep(0.3, 1.0, r) * (0.6 + 0.4 * r);
  gl_FragColor = vec4(col.rgb * (1.0 - v), 1.0 - (1.0 - col.a) * (1.0 - v));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function LensFX({ bulge = 0, blur = 5, vignette = 0.7 }: { bulge?: number; blur?: number; vignette?: number }) {
  const { gl, size, scene, camera } = useThree()
  const dpr = useThree((s) => s.viewport.dpr)
  const target = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY.antialias ? 4 : 0 }), [])
  const pass = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      uniforms: { tScene: { value: target.texture }, texel: { value: new THREE.Vector2() }, aspect: { value: 1 },
        bulge: { value: bulge }, blur: { value: blur }, vignette: { value: vignette } },
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    const s = new THREE.Scene()
    s.add(quad)
    return { mat, scene: s, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }
  }, [target, bulge, blur, vignette])
  useEffect(() => {
    const w = Math.max(1, Math.round(size.width * dpr)), h = Math.max(1, Math.round(size.height * dpr))
    target.setSize(w, h)
    pass.mat.uniforms.texel.value.set(1 / w, 1 / h)
    pass.mat.uniforms.aspect.value = w / h
  }, [dpr, size, target, pass])
  useEffect(() => () => { target.dispose(); pass.mat.dispose() }, [target, pass])
  useFrame(() => {
    gl.setRenderTarget(target)
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(pass.scene, pass.cam)
  }, 1)
  return null
}
