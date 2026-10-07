import { useMemo, useRef } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

type GasFlameProps = ThreeElements['group'] & {
  radius?: number
  count?: number
  baseIntensity?: number
  /** 0 (off) .. 1 (full) */
  heat?: number
}

/**
 * Ring of blue burner flames for the cassette stove. Flames lean outward and are sized to show in the gap
 * between the burner and the pot bottom; a glow ring on the stove plate reads even from high angles.
 */
export function GasFlame({ radius = 0.37, count = 28, baseIntensity = 0.8, heat = 1, ...props }: GasFlameProps) {
  const outer = useMemo(() => new THREE.ConeGeometry(0.045, 0.17, 10).translate(0, 0.085, 0), [])
  const inner = useMemo(() => new THREE.ConeGeometry(0.024, 0.09, 8).translate(0, 0.045, 0), [])
  const glowGeometry = useMemo(() => new THREE.RingGeometry(radius - 0.08, radius + 0.32, 64), [radius])

  const outerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#4d8cff', transparent: true, opacity: 1, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  const innerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  // soft radial falloff so the glow fades out instead of ending in a hard edge
  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uInner: { value: radius - 0.08 }, uOuter: { value: radius + 0.32 }, uStrength: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vPos;
          void main() {
            vPos = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uInner;
          uniform float uOuter;
          uniform float uStrength;
          varying vec2 vPos;
          void main() {
            float r = length(vPos);
            float t = (r - uInner) / (uOuter - uInner);
            float a = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.15, 1.0, t)) * uStrength;
            gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [radius],
  )

  const flames = useRef<THREE.Group[]>([])
  const light = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // a low flame is small and short; at 0 the burner is off
    const size = heat > 0 ? 0.4 + heat * 0.6 : 0
    flames.current.forEach((f, i) => {
      if (!f) return
      f.visible = size > 0
      f.scale.setScalar(size)
      f.scale.y = size * (1 + Math.sin(t * 23 + i * 1.7) * 0.18 + Math.sin(t * 13 + i * 0.9) * 0.12)
    })
    glowMat.uniforms.uStrength.value = heat * (0.35 + Math.sin(t * 17) * 0.04)
    if (light.current) light.current.intensity = baseIntensity * heat * (1 + Math.sin(t * 19) * 0.08)
  })

  return (
    <group {...props}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        return (
          // lean each flame outward, like gas leaving the burner ports
          <group key={i} ref={(g) => { if (g) flames.current[i] = g }}
            position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]} rotation={[0, -a, -0.95]}>
            <mesh geometry={outer} material={outerMat} renderOrder={2} />
            <mesh geometry={inner} material={innerMat} renderOrder={3} />
          </group>
        )
      })}
      <mesh geometry={glowGeometry} material={glowMat} rotation-x={-Math.PI / 2} position-y={-0.03} renderOrder={1} />
      <pointLight ref={light} position={[0, 0.06, 0]} color="#6aa8ff" intensity={baseIntensity} distance={2}
        decay={2} />
    </group>
  )
}
