import { Environment, Lightformer } from '@react-three/drei'

/**
 * A mock indoor HDRI (made on the spot, nothing fetched): a small room of soft light panels, rendered once to the scene's
 * environment, so what's lit by it (glossy and metal materials: the fridge's shelves, the register, the glass) picks up a
 * believable room round it: warm ceiling lamps above, a cool window panel to one side, a wall bounce, a wood-floor glow below.
 * (Toon materials take their light from the lamps; this is for the rest.)
 */
export function IndoorHDRI({ intensity = 0.5 }: { intensity?: number }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity} background={false}>
      {/* the room's dark shell, so the panels read against it */}
      <color attach="background" args={['#241a14']} />
      {/* ceiling: a pair of warm long lamps */}
      <Lightformer form="rect" intensity={5} color="#ffd9a0" position={[-3, 5, 0]} rotation-x={Math.PI / 2} scale={[1.2, 8, 1]} />
      <Lightformer form="rect" intensity={5} color="#ffd9a0" position={[3, 5, 0]} rotation-x={Math.PI / 2} scale={[1.2, 8, 1]} />
      {/* a window to one side: cool daylight */}
      <Lightformer form="rect" intensity={3.2} color="#cfe0ff" position={[-6, 1.8, 2]} rotation-y={Math.PI / 2} scale={[5, 3.2, 1]} />
      {/* the wall opposite, a soft warm bounce */}
      <Lightformer form="rect" intensity={1.2} color="#ffcf9a" position={[6, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      {/* the floor's warm glow from below, and a paper lantern's round of light */}
      <Lightformer form="rect" intensity={0.9} color="#c98a4a" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      <Lightformer form="circle" intensity={4} color="#ffc27a" position={[0, 3, -5]} scale={1.6} />
    </Environment>
  )
}
