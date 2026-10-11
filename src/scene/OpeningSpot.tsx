import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/*
 * The spotlight over an unopened shop, while its 開業 button is pointed at: a real light slanting down from high
 * up on the left, lighting the stove or grill or bowl and throwing a warm, soft-edged pool on the floor around it,
 * with a faint shaft of light through the air. It swings in and brightens, and fades away again.
 */

const FROM = new THREE.Vector3(-4.2, 7.5, 2.6)

export function OpeningSpot({ on, focusY }: { on: boolean; focusY: number }) {
  const scene = useThree((s) => s.scene)
  const light = useRef<THREE.SpotLight>(null)
  const pool = useRef<THREE.Mesh>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const k = useRef(0)
  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    return () => { scene.remove(l.target) }
  }, [scene])

  // the pool of light on the floor: bright in the middle, falling off softly to nothing
  const poolTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255, 236, 190, 0.8)')
    grad.addColorStop(0.3, 'rgba(255, 230, 180, 0.5)')
    grad.addColorStop(0.65, 'rgba(255, 224, 170, 0.15)')
    grad.addColorStop(1, 'rgba(255, 220, 160, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  // the shaft: a long open cone from the lamp to the floor (how bright each part is, is up to its shader)
  const shaftGeo = useMemo(() => {
    const len = FROM.length()
    const g = new THREE.CylinderGeometry(0.12, 1.7, len, 64, 16, true)
    // point it from the lamp down to the floor
    g.translate(0, -len / 2, 0)
    return g
  }, [])

  // the shaft is soft all over: it fades out toward its edges (where we look through less of the cone, by how
  // square-on the surface faces us), toward the lamp, and at the floor, so there's no hard line anywhere
  const shaftMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // (normal blending with the glow in alpha: the canvas is see-through over the page, so additive with alpha 1
    // would paint the dark parts of the shaft black)
    uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color('#ffe2b4') } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vT;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vT = clamp(-position.y / ${FROM.length().toFixed(3)}, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; varying float vT;
      uniform float uStrength; uniform vec3 uColor;
      void main() {
        float face = abs(dot(normalize(vN), normalize(vV)));
        float edge = pow(face, 2.6);                       // the rim of the cone fades to nothing
        float along = smoothstep(0.0, 0.45, vT) * (1.0 - smoothstep(0.82, 1.0, vT));
        gl_FragColor = vec4(uColor, edge * along * uStrength);
      }`,
  }), [])

  useFrame((_, dt) => {
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * 3.5)
    const v = k.current
    const l = light.current
    if (l) {
      l.intensity = v * 26
      // it swings in: from a little off to the left onto the shop
      l.target.position.set(-1.2 * (1 - v), focusY * 0.5, 0)
      l.visible = v > 0.01
    }
    if (pool.current) {
      ;(pool.current.material as THREE.MeshBasicMaterial).opacity = v * 0.38
      pool.current.position.x = -1.2 * (1 - v)
      pool.current.visible = v > 0.01
    }
    if (shaft.current) {
      shaftMat.uniforms.uStrength.value = v * 0.32
      shaft.current.visible = v > 0.01
      const dir = new THREE.Vector3(-1.2 * (1 - v), 0, 0).sub(FROM).normalize()
      shaft.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    }
  })

  return (
    <>
      <spotLight ref={light} position={FROM} angle={0.3} penumbra={1} decay={1.2} distance={18} color="#ffe2b0"
        intensity={0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <mesh ref={pool} rotation-x={-Math.PI / 2} position-y={0.003} scale={[4.6, 4.6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={poolTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={shaft} geometry={shaftGeo} position={FROM} material={shaftMat} />
    </>
  )
}
