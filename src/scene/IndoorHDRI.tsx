import { useEffect, useState } from 'react'
import { Environment, Lightformer } from '@react-three/drei'

/**
 * A mock indoor HDRI (made on the spot, nothing fetched): a small room of soft light panels, rendered once to the scene's
 * environment, so what's lit by it (glossy and metal materials: the fridge's shelves, the register, the glass) picks up a
 * believable room round it: warm ceiling lamps above, a cool window panel to one side, a wall bounce, a wood-floor glow below.
 * (Toon materials take their light from the lamps; this is for the rest.)
 */
const HDRI_BASE = import.meta.env.BASE_URL + 'hdri/'
/** whether a real HDRI photograph has been put in public/hdri/ for the day or the night (day.hdr, night.hdr, e.g. from polyhaven.com/hdris, 1k is plenty) */
function useHdriFile(name: 'day' | 'night') {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let alive = true
    // (a dev server answers a missing file with the page itself: only an actual radiance file, which starts "#?", counts)
    fetch(`${HDRI_BASE}${name}.hdr`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (alive) setOk(!!b && new TextDecoder().decode(b.slice(0, 2)) === '#?') }).catch(() => { if (alive) setOk(false) })
    return () => { alive = false }
  }, [name])
  return ok
}

export function IndoorHDRI({ intensity = 0.5, night = false }: { intensity?: number; night?: boolean }) {
  const real = useHdriFile(night ? 'night' : 'day')
  // (a real HDRI photograph, if one's there, lights the glossy things; otherwise the room's own made-up one below)
  if (real) return <Environment key={night ? 'real-night' : 'real-day'} files={`${HDRI_BASE}${night ? 'night' : 'day'}.hdr`} environmentIntensity={intensity} background={false} />
  return <IndoorMock intensity={intensity} night={night} />
}
function IndoorMock({ intensity, night }: { intensity: number; night: boolean }) {
  // (day: bright daylight through the window, a pale shell, the lamps a lighter touch; night: a dim moonlit blue window, a dark shell, the lamps
  // and the lantern warm and strong, so the glossy things pick up a different room as the day turns. Keyed, so it's rendered afresh on a switch.)
  const L = night
    ? { shell: '#120d12', lamp: 6.5, lampC: '#ffb866', win: 0.9, winC: '#5f78c8', bounce: 0.8, bounceC: '#d98a4e', floor: 0.7, lantern: 6, sky: 0 }
    : { shell: '#3a3430', lamp: 3.2, lampC: '#ffe2b4', win: 6, winC: '#e8f1ff', bounce: 1.8, bounceC: '#ffdcae', floor: 1.1, lantern: 2.2, sky: 1.6 }
  return (
    <Environment key={night ? 'night' : 'day'} resolution={256} frames={1} environmentIntensity={intensity} background={false}>
      {/* the room's shell, so the panels read against it */}
      <color attach="background" args={[L.shell]} />
      {/* ceiling: a pair of long lamps */}
      <Lightformer form="rect" intensity={L.lamp} color={L.lampC} position={[-3, 5, 0]} rotation-x={Math.PI / 2} scale={[1.2, 8, 1]} />
      <Lightformer form="rect" intensity={L.lamp} color={L.lampC} position={[3, 5, 0]} rotation-x={Math.PI / 2} scale={[1.2, 8, 1]} />
      {/* a window to one side: daylight, or the moon's cool blue */}
      <Lightformer form="rect" intensity={L.win} color={L.winC} position={[-6, 1.8, 2]} rotation-y={Math.PI / 2} scale={[5, 3.2, 1]} />
      {/* (by day, a wide pale sky over the roof's gap too) */}
      {L.sky > 0 && <Lightformer form="rect" intensity={L.sky} color="#dfeaff" position={[0, 7, 3]} rotation-x={Math.PI / 2} scale={[10, 5, 1]} />}
      {/* the wall opposite, a soft bounce */}
      <Lightformer form="rect" intensity={L.bounce} color={L.bounceC} position={[6, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      {/* the floor's warm glow from below, and a paper lantern's round of light */}
      <Lightformer form="rect" intensity={L.floor} color="#c98a4a" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      <Lightformer form="circle" intensity={L.lantern} color="#ffc27a" position={[0, 3, -5]} scale={1.6} />
    </Environment>
  )
}
