import { useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { snoise } from '../shaders/noise'

const flameVertex = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
${snoise}
void main() {
  vUv = uv;
  vec3 p = position;
  float h = uv.y;
  // tips lick sideways, the base stays put
  p.x += snoise(vec2(h * 1.5 - uTime * 0.9, uSeed)) * 0.09 * h;
  p.z += snoise(vec2(h * 1.5 - uTime * 0.9, uSeed + 5.0)) * 0.09 * h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const flameFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
varying vec2 vUv;
${snoise}
void main() {
  float h = vUv.y;
  float n = (snoise(vec2(vUv.x * 3.0 + uSeed, h * 2.0 - uTime * 1.6)) * 0.5 + 0.5)
          + (snoise(vec2(vUv.x * 7.0 - uSeed, h * 4.5 - uTime * 2.6)) * 0.5 + 0.5) * 0.5;
  n /= 1.5;

  // teardrop silhouette that narrows toward the top, broken up by noise
  float x = abs(vUv.x - 0.5) * 2.0;
  float width = (1.0 - h) * 0.85 + 0.05;
  float shape = smoothstep(width, width * 0.3, x + (n - 0.5) * 0.45);
  float flame = shape * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.35, 1.0, h + (1.0 - n) * 0.45));
  flame = clamp(flame * (0.55 + n), 0.0, 1.0);

  // cel look: three flat bands (red rim, orange body, yellow core) instead of a gradient
  float outer = smoothstep(0.12, 0.15, flame);
  float mid = smoothstep(0.4, 0.43, flame);
  float inner = smoothstep(0.72, 0.75, flame);
  vec3 col = mix(vec3(0.93, 0.27, 0.12), vec3(1.0, 0.6, 0.18), mid);
  col = mix(col, vec3(1.0, 0.9, 0.5), inner);
  gl_FragColor = vec4(col * uIntensity, outer);
}
`

const emberVertex = /* glsl */ `
attribute float aLife;
attribute float aSize;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const emberFragment = /* glsl */ `
uniform float uLevel;
varying float vLife;
void main() {
  // a crisp, bright spark: a hard-edged dot with a hot yellow-white core, so it reads on a pale background too
  float d = length(gl_PointCoord - 0.5);
  float spark = 1.0 - smoothstep(0.38, 0.5, d);
  float core = 1.0 - smoothstep(0.1, 0.28, d);
  float a = spark * smoothstep(0.0, 0.12, vLife) * min(1.0, vLife * 1.6) * uLevel;
  vec3 col = mix(vec3(0.95, 0.28, 0.04), vec3(1.0, 0.62, 0.15), vLife);
  col = mix(col, vec3(1.0, 0.95, 0.7), core);
  gl_FragColor = vec4(col, a);
}
`

type FireProps = ThreeElements['group'] & {
  layers?: number
  width?: number
  height?: number
  embers?: number
  /** average firelight intensity before flicker */
  baseIntensity?: number
  /** 0..1 how fierce the fire is, read every frame: scales the flames, embers and light */
  level?: RefObject<number>
}

/** Campfire flames (crossed noise planes), rising embers and a flickering firelight. */
export function Fire({ layers = 4, width = 0.9, height = 0.75, embers = 90, baseIntensity = 7, level, ...props }: FireProps) {
  const flameGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 16, 48)
    g.translate(0, height / 2, 0)
    return g
  }, [width, height])

  const flameMaterials = useMemo(
    () =>
      Array.from(
        { length: layers },
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader: flameVertex,
            fragmentShader: flameFragment,
            uniforms: { uTime: { value: 0 }, uSeed: { value: i * 4.17 }, uIntensity: { value: 1.0 } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [layers],
  )

  // embers: simulated on the CPU, few enough that this is cheap
  const emberState = useMemo(() => {
    const pos = new Float32Array(embers * 3)
    const vel = new Float32Array(embers * 3)
    const life = new Float32Array(embers)
    const maxLife = new Float32Array(embers)
    const size = new Float32Array(embers)
    for (let i = 0; i < embers; i++) {
      maxLife[i] = 1.5 + Math.random() * 2
      life[i] = Math.random()
      size[i] = 0.035 + Math.random() * 0.035
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    return { pos, vel, life, maxLife, geometry }
  }, [embers])

  const emberMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: emberVertex,
        fragmentShader: emberFragment,
        uniforms: { uLevel: { value: 1 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  const light = useRef<THREE.PointLight>(null)
  const flames = useRef<THREE.Group>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    time.current += dt
    const t = time.current
    for (const m of flameMaterials) m.uniforms.uTime.value = t

    // fire strength: low embers barely flicker, a fierce fire stands tall and bright
    const lv = level ? level.current : 1
    // once the charcoal is spent the flames die right down and go out
    const alive = THREE.MathUtils.smoothstep(lv, 0, 0.1)
    if (flames.current) {
      flames.current.visible = alive > 0.01
      flames.current.scale.set((0.6 + 0.6 * lv) * alive, (0.25 + 1.5 * lv) * alive, (0.6 + 0.6 * lv) * alive)
    }
    emberMaterial.uniforms.uLevel.value = alive

    // flicker: a few incommensurate sines read as random
    if (light.current) {
      // no fire, no firelight
      light.current.intensity = baseIntensity * 1.45 * lv * alive *
        (1 + Math.sin(t * 11) * 0.13 + Math.sin(t * 17.3) * 0.1 + Math.sin(t * 5.1) * 0.16)
    }

    const { pos, vel, life, maxLife, geometry } = emberState
    for (let i = 0; i < life.length; i++) {
      life[i] -= dt / maxLife[i]
      if (life[i] <= 0) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 0.3
        pos[i * 3] = Math.cos(a) * r
        pos[i * 3 + 1] = 0.1
        pos[i * 3 + 2] = Math.sin(a) * r
        vel[i * 3] = (Math.random() - 0.5) * 0.15
        vel[i * 3 + 1] = 0.35 + Math.random() * 0.5
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15
        life[i] = 1
      }
      // drift outward a little so embers escape around the pot instead of through it
      const x = pos[i * 3]
      const z = pos[i * 3 + 2]
      const rr = Math.hypot(x, z) + 1e-4
      const push = pos[i * 3 + 1] > 0.4 ? 0.5 : 0.05
      pos[i * 3] += (vel[i * 3] + (x / rr) * push + Math.sin(t * 3 + i) * 0.05) * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += (vel[i * 3 + 2] + (z / rr) * push + Math.cos(t * 3 + i) * 0.05) * dt
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
  })

  return (
    <group {...props}>
      <group ref={flames}>
        {flameMaterials.map((m, i) => (
          <mesh key={i} geometry={flameGeometry} material={m} rotation-y={(i * Math.PI) / layers} renderOrder={2} />
        ))}
      </group>
      <points geometry={emberState.geometry} material={emberMaterial} renderOrder={3} frustumCulled={false} />
      {/* no shadows: from inside the ring it threw a giant star of stone shadows across the floor */}
      <pointLight ref={light} position={[0, 0.3, 0]} color="#ff8a3d" intensity={baseIntensity} distance={5}
        decay={2} />
    </group>
  )
}
