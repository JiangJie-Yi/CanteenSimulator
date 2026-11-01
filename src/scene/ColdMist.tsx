// The cold that spills out of an open fridge, as it does: heavier than the room's air, it pours over the sill and down in thin wisps, then
// rolls out over the floor in a low pool that spreads and thins away. (The drinks' fridge drew rising steam there, which is what hot food
// does: the owner saw it was wrong.) Two soft sheets, their wisps fbm noise drifting down the one and out across the other.
import { memo, useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uOpacity;
uniform float uPool;
uniform vec3 uColor;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  float a;
  if (uPool < 0.5) {
    // (the curtain: wisps sliding down from the opening's foot, thickest just under it, thinning to nothing at the floor and at its sides)
    vec2 q = vec2(vUv.x * 3.2, vUv.y * 1.8 + uTime * 0.32);
    float n = fbm(q + 0.8 * fbm(q * 1.7 + vec2(0.0, uTime * 0.12)));
    float side = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    float fall = smoothstep(1.0, 0.7, vUv.y) * smoothstep(0.0, 0.25, vUv.y);
    a = smoothstep(0.45, 0.82, n) * side * fall;
  } else {
    // (the pool: rolling out from the fridge's foot (vUv.y 0) across the floor, spreading as it goes, thinning away at its edges)
    vec2 q = vec2(vUv.x * 2.6, vUv.y * 2.2 - uTime * 0.16);
    float n = fbm(q + 0.7 * fbm(q * 1.4 - vec2(uTime * 0.05, 0.0)));
    float d = length(vec2((vUv.x - 0.5) * 2.0 / (0.6 + 0.6 * vUv.y), vUv.y));
    a = smoothstep(0.4, 0.8, n) * smoothstep(1.0, 0.3, d) * smoothstep(0.0, 0.1, vUv.y);
  }
  gl_FragColor = vec4(uColor, a * uOpacity * uLevel);
}`

type Props = {
  /** how wide the opening it pours from is */
  width: number
  /** how far it falls, from the opening's foot to the floor */
  drop: number
  /** how far it rolls out over the floor */
  reach: number
  /** how open the fridge is (0 shut .. 1 open): the mist comes and goes with it */
  level: RefObject<number>
  opacity?: number
  color?: string
}

/**
 * The cold from an open fridge, its local origin on the floor under the middle of the opening's foot, +z out of the fridge: a sheet hanging
 * from the opening's foot down to the floor, and a pool on the floor out in front of it.
 */
export const ColdMist = memo(function ColdMist({ width, drop, reach, level, opacity = 0.32, color = '#eef7ff' }: Props) {
  const [curtain, pool] = useMemo(() => [0, 1].map((k) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: k * 13.7 }, uLevel: { value: 0 }, uOpacity: { value: opacity }, uPool: { value: k }, uColor: { value: new THREE.Color(color) } },
  })), [opacity, color])
  const group = useMemo(() => new THREE.Group(), [])
  useFrame((_, dt) => {
    const l = level.current ?? 0
    group.visible = l > 0.01
    if (!group.visible) return
    for (const m of [curtain, pool]) {
      m.uniforms.uTime.value += Math.min(dt, 0.1)
      m.uniforms.uLevel.value = l
    }
  })
  return (
    <primitive object={group}>
      {/* (hung a hair out from the opening, so it isn't cut by the sill) */}
      <mesh position={[0, drop / 2, 0.01]} material={curtain} renderOrder={3}><planeGeometry args={[width, drop]} /></mesh>
      <mesh position={[0, 0.006, reach / 2]} rotation-x={Math.PI / 2} material={pool} renderOrder={3}><planeGeometry args={[width * 1.7, reach]} /></mesh>
    </primitive>
  )
})
