import type { Sky } from './clock'

/*
 * The shop's lights, on its wall switches (the owner's): the room's, by the way in (the paper pendants, the bar's cove light, the warm spot
 * over the fire: off, the room falls dark, by day the sky through the windows still lighting it a little, by night hardly at all); beside it
 * the lanterns at the door's; and one by each toilet's door, its lights. The exit sign is the emergency light: no switch puts it out.
 */
export type RoomLights = { on: boolean; door: boolean; wc: { m: boolean; f: boolean } }
/** the switches: the room's, the door's lanterns', the men's toilet's, the women's */
export type Circuit = 'room' | 'door' | 'wcM' | 'wcF'

export const LIGHTS_DEFAULT: RoomLights = { on: true, door: true, wc: { m: true, f: true } }

/** whether this switch's lights are on */
export const lightOn = (s: RoomLights, c: Circuit) => (c === 'room' ? s.on : c === 'door' ? s.door : s.wc[c === 'wcM' ? 'm' : 'f'])

/** a switch pressed: its lights on go off, off go on; the others as they were */
export function switchLights(s: RoomLights, c: Circuit = 'room'): RoomLights {
  if (c === 'room') return { ...s, on: !s.on }
  if (c === 'door') return { ...s, door: !s.door }
  const k = c === 'wcM' ? 'm' : 'f'
  return { ...s, wc: { ...s.wc, [k]: !s.wc[k] } }
}

/** whether the door's lanterns are lit by the shop's own doing (the owner's: shut, or the room's lights off for the night, they still shone
 * on): from its opening till its last order, as a shop lights its lanterns to open and takes them in to close; their switch by the way in
 * puts them out or lights them in between */
export const lanternsLit = (open: boolean, closing: boolean) => open && !closing

/** the exit sign: the emergency light, lit whatever the switches are */
export const exitSignLit = (_s: RoomLights) => true

/** how much of their glow the lamps give (their haloes and pools of light; how strong that is by day and by night is each lamp's own): all
 * of it with the switch on, none off */
export const lampGlow = (on: boolean) => (on ? 1 : 0)

/** how much of the room's usual light is left (1: all of it): with the lights off, the daylight by day, little by night */
export const roomDim = (on: boolean, night: boolean) => (on ? 1 : night ? 0.3 : 0.75)

/** how the room is for the customers: lit, dim (the lights off by day: the daylight's enough, just), or dark (off by night) */
export type RoomMood = 'lit' | 'dim' | 'dark'
export const roomMood = (on: boolean, night: boolean): RoomMood => (on ? 'lit' : night ? 'dark' : 'dim')

/** whether anyone comes in: nobody walks into a dark shop (it looks shut) */
export const comesIn = (m: RoomMood) => m !== 'dark'

/** how long the customers will wait in it, against as long as they would (1): a dim room wears on them a little, a dark one a lot */
export const patienceIn = (m: RoomMood) => (m === 'dark' ? 0.35 : m === 'dim' ? 0.8 : 1)

/** how much of the bright studio polished metal reflects (scene/studio): all of it by day with the lights on, less by night, little with the
 * lights off, hardly any by night with them off (else the gold and brass shone in the dark with nothing to shine with) */
export const studioLight = (on: boolean, night: boolean) => (on ? (night ? 0.6 : 1) : night ? 0.1 : 0.5)
/**
 * How dark the key light's shadows fall (1: black where its light's cut off). By day the room's full of light, the sky's through the windows
 * and the lamps' besides, so the sun's shadows are light, what's in them still showing (black, they looked cut out of the picture); with the
 * lamps off a little deeper. By night the lamps fill the moon's shadows in, faint; with them off the moon's are plain.
 */
export const shadowDepth = (on: boolean, night: boolean) => (night ? (on ? 0.28 : 0.75) : on ? 0.5 : 0.62)
/** how far the shadows' edges blur (in the shadow map's texels, about 1.4 cm each across the shop): soft, as light falls indoors; by day
 * softer still, the noon sun's shadows no more than a soft darkening under things */
export const shadowSoft = (night: boolean) => (night ? 5 : 8)
/**
 * Where the key light shines from (a unit vector toward it). By day the sun at noon, straight overhead (90 degrees): every shadow falls
 * right under what casts it, none thrown across the room. By night the moon, high up out past the round window (`window`: which way the
 * window faces out, level; none found, straight down too), its shadows short and falling away from the window. At dusk the evening sun,
 * lower, in through the round window too, its shadows long; at dawn the early sun from the room's other side, a little higher than dusk's
 * (low enough to throw the shadows across the floor, high enough that the room's still lit, not all in its walls' shade).
 */
const KEY_RISE: Record<Sky, [out: number, up: number]> = { day: [0, 1], night: [6, 18], dusk: [14, 11], dawn: [-11, 12] }
export function keyLightFrom(sky: Sky, window: [number, number] | null): [number, number, number] {
  if (sky === 'day' || !window) return [0, 1, 0]
  const [out, up] = KEY_RISE[sky]
  const l = Math.hypot(window[0], window[1]) || 1
  const v = [(window[0] / l) * out, up, (window[1] / l) * out]
  const n = Math.hypot(v[0], v[1], v[2])
  return [v[0] / n, v[1] / n, v[2] / n]
}
/**
 * What a lamp looks like switched off, its paper or frosted glass (a colour laid over a plain paper picture): grey-white in the daylight by day,
 * a dim grey by night; never the warm yellow of its light (once its lit picture was only darkened, and stayed yellow).
 */
export const unlitShade = (night: boolean) => (night ? '#58585b' : '#d4d2cd')

export const writeLights = (s: RoomLights) => JSON.stringify(s)

/** the switches as they were left (each on, if nothing's kept for it or it can't be read; an old browser kept only the room's) */
export function readLights(text: string | null): RoomLights {
  const fresh = (): RoomLights => ({ ...LIGHTS_DEFAULT, wc: { ...LIGHTS_DEFAULT.wc } })
  try {
    const raw = JSON.parse(text ?? 'null') as { on?: unknown; door?: unknown; wc?: { m?: unknown; f?: unknown } } | null
    if (!raw || typeof raw.on !== 'boolean') return fresh()
    const b = (v: unknown) => (typeof v === 'boolean' ? v : true)
    return { on: raw.on, door: b(raw.door), wc: { m: b(raw.wc?.m), f: b(raw.wc?.f) } }
  } catch {
    return fresh()
  }
}
