import * as THREE from 'three'
import { brushText } from '@/scene/signFont'

/**
 * A beckoning cat (招き猫), about 0.2 tall, facing +z: sat up round, one paw raised to call the customers in, the
 * other holding a gold koban to its chest; big round eyes, pink nose and cheeks, whiskers, pink inside its ears, a red
 * collar with a gold bell, a tail curled round behind, and (on a white one) a tortoiseshell patch or two.
 */

const INK = '#2a1d16'
const GEO = {
  ball: new THREE.SphereGeometry(1, 16, 12),
  ear: new THREE.ConeGeometry(1, 1, 8),
  limb: new THREE.CapsuleGeometry(1, 1, 4, 8),
  stick: new THREE.CylinderGeometry(1, 1, 1, 4),
  coin: new THREE.CylinderGeometry(1, 1, 1, 20),
  collar: new THREE.TorusGeometry(0.037, 0.006, 6, 20),
  tail: new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI * 1.2),
}

/** the koban's face: gold with the hammered ribs and 千萬兩 brushed down it */
const KOBAN = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#e6be4e'
  g.fillRect(0, 0, 64, 96)
  g.strokeStyle = 'rgba(140,96,20,0.45)'
  g.lineWidth = 2
  for (let y = 10; y < 96; y += 7) {
    g.beginPath()
    g.moveTo(4, y)
    g.lineTo(60, y)
    g.stroke()
  }
  ;['千', '萬', '兩'].forEach((ch, i) => brushText(g, ch, 32, 22 + i * 26, 24, { fill: '#5a3a10', shadow: 'rgba(255,240,170,0.5)' }))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

function Bit({ geo, color, outline = 0, basic, ...rest }:
  { geo: THREE.BufferGeometry; color: string; outline?: number; basic?: boolean } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geo} castShadow={outline > 0}>
        {basic ? <meshBasicMaterial color={color} /> : <meshToonMaterial color={color} />}
      </mesh>
      {outline > 0 && (
        <mesh geometry={geo} scale={outline}>
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  )
}

export function LuckyCat({ body = '#f6f3ea', paw = 'right' }: { body?: string; paw?: 'left' | 'right' }) {
  const p = paw === 'right' ? 1 : -1
  const white = body === '#f6f3ea'
  const dark = body === '#2a2420'
  const eye = dark ? '#e8c45a' : INK
  const pink = '#f2a0a0'
  return (
    <group>
      {/* body, sat up, and its feet poking out in front */}
      <Bit geo={GEO.ball} color={body} outline={1.05} position={[0, 0.05, 0]} scale={[0.052, 0.056, 0.046]} />
      {[-1, 1].map((sd) => (
        <Bit key={sd} geo={GEO.ball} color={body} outline={1.1} position={[sd * 0.022, 0.009, 0.034]} scale={[0.014, 0.009, 0.016]} />
      ))}
      {/* the tail curled round its side at the back */}
      <mesh geometry={GEO.tail} position={[-p * 0.01, 0.02, -0.03]} rotation={[Math.PI / 2, 0, -0.6]}>
        <meshToonMaterial color={body} />
      </mesh>
      {/* tortoiseshell patches on a white one: one on its back, one over an ear */}
      {white && (
        <>
          <Bit geo={GEO.ball} color="#e0913a" position={[-p * 0.02, 0.06, -0.018]} scale={[0.028, 0.026, 0.026]} />
          <Bit geo={GEO.ball} color="#3a2e28" position={[p * 0.024, 0.032, -0.024]} scale={[0.02, 0.018, 0.02]} />
        </>
      )}
      {/* the red collar and its gold bell */}
      <mesh geometry={GEO.collar} position={[0, 0.093, 0.002]} rotation-x={Math.PI / 2 - 0.15} scale={[1.05, 1, 0.9]}>
        <meshToonMaterial color="#c4302a" />
      </mesh>
      <Bit geo={GEO.ball} color="#e8c45a" outline={1.12} position={[0, 0.08, 0.04]} scale={0.011} />
      <Bit geo={GEO.stick} color={INK} basic position={[0, 0.077, 0.0505]} rotation-x={Math.PI / 2} scale={[0.0015, 0.002, 0.004]} />
      {/* the head: wide, a little flat */}
      <group position={[0, 0.138, 0]}>
        <Bit geo={GEO.ball} color={body} outline={1.05} scale={[0.058, 0.048, 0.05]} />
        {white && <Bit geo={GEO.ball} color="#e0913a" position={[p * 0.028, 0.026, -0.004]} scale={[0.024, 0.02, 0.03]} />}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.033, 0.04, 0]} rotation-z={-sd * 0.35}>
            <Bit geo={GEO.ear} color={white && sd === p ? '#e0913a' : body} outline={1.12} scale={[0.017, 0.03, 0.013]} />
            <Bit geo={GEO.ear} color={pink} position={[0, -0.002, 0.007]} scale={[0.009, 0.018, 0.004]} />
          </group>
        ))}
        {/* big round eyes with a glint, pink nose, blushed cheeks, a little w of a mouth */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.021, 0.006, 0.045]}>
            <Bit geo={GEO.ball} color={eye} basic scale={[0.0075, 0.009, 0.004]} />
            <Bit geo={GEO.ball} color="#ffffff" basic position={[0.002, 0.003, 0.003]} scale={0.0022} />
            <Bit geo={GEO.ball} color={pink} position={[sd * 0.012, -0.015, -0.005]} scale={[0.009, 0.005, 0.003]} />
          </group>
        ))}
        <Bit geo={GEO.ball} color="#e07a86" basic position={[0, -0.007, 0.05]} scale={[0.005, 0.0035, 0.003]} />
        {[-1, 1].map((sd) => (
          <Bit key={sd} geo={GEO.stick} color={INK} basic position={[sd * 0.0045, -0.0135, 0.049]} rotation-z={-sd * 1.0}
            scale={[0.0012, 0.01, 0.0012]} />
        ))}
        {/* whiskers, three a side */}
        {[-1, 1].flatMap((sd) => [-0.25, 0, 0.25].map((a) => (
          <Bit key={`${sd}${a}`} geo={GEO.stick} color={dark ? '#d8d0c0' : '#6a5a50'} basic
            position={[sd * 0.045, -0.01 + a * 0.02, 0.038]} rotation={[0, -sd * 0.5, Math.PI / 2 + sd * a]} scale={[0.0007, 0.03, 0.0007]} />
        )))}
      </group>
      {/* the raised paw, calling them in, its pink pad to the front */}
      <group position={[p * 0.046, 0.108, 0.01]} rotation-z={-p * 0.15}>
        <Bit geo={GEO.limb} color={body} outline={1.1} position-y={0.03} scale={[0.012, 0.03, 0.012]} />
        <Bit geo={GEO.ball} color={body} outline={1.08} position-y={0.065} scale={0.015} />
        <Bit geo={GEO.ball} color={pink} position={[0, 0.063, 0.013]} scale={[0.008, 0.007, 0.003]} />
      </group>
      {/* the other paw holding the koban to its chest */}
      <group position={[-p * 0.012, 0.042, 0.046]} rotation-y={p * 0.15}>
        <mesh geometry={GEO.coin} rotation-x={Math.PI / 2} scale={[0.022, 0.004, 0.034]}>
          <meshToonMaterial color="#d9ab3a" />
        </mesh>
        <mesh position-z={0.0025} scale={[0.04, 0.064, 1]}>
          <circleGeometry args={[0.5, 24]} />
          <meshToonMaterial color="#ffffff" map={KOBAN} />
        </mesh>
        <Bit geo={GEO.ball} color={body} outline={1.1} position={[-p * 0.022, 0.012, 0.004]} scale={0.013} />
      </group>
    </group>
  )
}
