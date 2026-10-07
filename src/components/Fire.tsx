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
    const baseSize = new Float32Array(embers)
    for (let i = 0; i < embers; i++) {
      maxLife[i] = 1.5 + Math.random() * 2
      life[i] = Math.random()
      baseSize[i] = 0.03 + Math.random() * 0.04
      size[i] = baseSize[i]
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    return { pos, vel, life, maxLife, size, baseSize, geometry }
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

    // sparks follow the fire: a fierce fire throws lots of them, fast and high, in bursts as it crackles;
    // dying embers let off only the odd lazy one
    const { pos, vel, life, maxLife, size, baseSize, geometry } = emberState
    const crackle = 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 5.7 + 1.3))
    const spawn = alive * (0.15 + 0.85 * lv) * crackle
    for (let i = 0; i < life.length; i++) {
      if (life[i] > 0) life[i] -= dt / maxLife[i]
      if (life[i] <= 0) {
        // dead sparks wait to be thrown again, more often the hotter the fire
        if (Math.random() > spawn * dt * 2.5) {
          life[i] = 0
          size[i] = 0
          continue
        }
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * (0.12 + 0.2 * lv)
        pos[i * 3] = Math.cos(a) * r
        pos[i * 3 + 1] = 0.08 + Math.random() * 0.1
        pos[i * 3 + 2] = Math.sin(a) * r
        const kick = 0.4 + 0.9 * lv
        vel[i * 3] = (Math.random() - 0.5) * 0.3 * kick
        vel[i * 3 + 1] = (0.35 + Math.random() * 0.6) * kick
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * kick
        maxLife[i] = (0.8 + Math.random() * 1.6) * (0.6 + 0.6 * lv)
        life[i] = 1
      }
      const y = pos[i * 3 + 1]
      // swirled about by the hot air (a cheap curl of sines), slowing as they cool, a touch of draught
      const swirl = 0.25 + 0.35 * lv
      const sx = Math.sin(y * 7 + t * 2.1 + i * 1.3) * swirl
      const sz = Math.cos(y * 6 + t * 1.7 + i * 0.7) * swirl
      vel[i * 3 + 1] *= 1 - 0.35 * dt
      pos[i * 3] += (vel[i * 3] + sx + 0.06) * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += (vel[i * 3 + 2] + sz) * dt
      // twinkle as they tumble, and shrink as they burn out
      const twinkle = 0.65 + 0.35 * Math.sin(t * (14 + (i % 7) * 3) + i)
      size[i] = baseSize[i] * twinkle * (0.4 + 0.6 * life[i]) * (0.7 + 0.5 * lv)
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
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
