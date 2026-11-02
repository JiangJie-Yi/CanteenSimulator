import type { Sky } from './clock'

/*
 * The shop's lights, on the wall switch by the door: on or off. Off, the lamps (the paper pendants, the string of bulbs, the warm spot over
 * the fire) give no light, and the room falls dark: by day the sky through the windows still lights it a little, by night hardly at all.
 */
export type RoomLights = { on: boolean }

export const LIGHTS_DEFAULT: RoomLights = { on: true }

/** the switch pressed: on goes off, off goes on */
export const switchLights = (s: RoomLights): RoomLights => ({ on: !s.on })

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

/** the switch as it was left (on, if nothing's kept or it can't be read) */
export function readLights(text: string | null): RoomLights {
  try {
    const raw = JSON.parse(text ?? 'null') as { on?: unknown } | null
    return raw && typeof raw.on === 'boolean' ? { on: raw.on } : { ...LIGHTS_DEFAULT }
  } catch {
    return { ...LIGHTS_DEFAULT }
  }
}
