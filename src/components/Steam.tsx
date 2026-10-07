import { useMemo, useRef } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { snoise as noise } from '../shaders/noise'

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
${noise}
void main() {
  vUv = uv;
  vec3 p = position;
  float h = uv.y;
  // twist and drift more the higher the steam rises
  float twist = snoise(vec2(h * 0.6 - uTime * 0.05, uSeed)) * 2.5 * h;
  float s = sin(twist);
  float c = cos(twist);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p.x += snoise(vec2(h * 0.8 - uTime * 0.12, uSeed + 10.0)) * 0.3 * h * h;
  p.z += snoise(vec2(h * 0.8 - uTime * 0.12, uSeed + 20.0)) * 0.3 * h * h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uShade;
uniform float uSpeed;
varying vec2 vUv;
${noise}
void main() {
  vec2 uv = vec2(vUv.x * 0.6, vUv.y * 0.35 - uTime * uSpeed);
  float n = (snoise(uv * 3.0 + uSeed) * 0.5 + 0.5)
          + (snoise(uv * 7.0 - uSeed) * 0.5 + 0.5) * 0.5;
  n /= 1.5;
  float steam = smoothstep(0.45, 1.0, n);
  steam *= smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  steam *= smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
  // cel look: crisp-edged puffs with a soft shadow band inside
  float puff = smoothstep(0.3, 0.33, steam);
  float core = smoothstep(0.46, 0.49, steam);
  vec3 col = mix(uShade, uColor, core);
  gl_FragColor = vec4(col, puff * uOpacity);
}
`

type SteamProps = ThreeElements['group'] & {
  layers?: number
  width?: number
  height?: number
  opacity?: number
  /** puff colour and the shadow band inside it; defaults are white steam with a blue shade */
  color?: string
  shade?: string
  /** how fast the puffs rise */
  speed?: number
}

/** Rising steam (or smoke) built from a few crossed, noise-animated planes. */
export function Steam({ layers = 4, width = 1.1, height = 1.6, opacity = 0.55, color = '#ffffff', shade = '#e6f0fc',
  speed = 0.07, ...props }: SteamProps) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 16, 64)
    g.translate(0, height / 2, 0)
    return g
  }, [width, height])

  const materials = useMemo(
    () =>
      Array.from(
        { length: layers },
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
              uTime: { value: 0 },
              uSeed: { value: i * 7.31 },
              uOpacity: { value: 0 },
              uColor: { value: new THREE.Color() },
              uShade: { value: new THREE.Color() },
              uSpeed: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
      ),
    [layers],
  )

  const time = useRef(0)
  useFrame((_, delta) => {
    time.current += delta
    for (const m of materials) {
      m.uniforms.uTime.value = time.current
      m.uniforms.uOpacity.value = opacity
      m.uniforms.uColor.value.set(color)
      m.uniforms.uShade.value.set(shade)
      m.uniforms.uSpeed.value = speed
    }
  })

  return (
    <group {...props}>
      {materials.map((m, i) => (
        <mesh key={i} geometry={geometry} material={m} rotation-y={(i * Math.PI) / layers} renderOrder={1} />
      ))}
    </group>
  )
}
