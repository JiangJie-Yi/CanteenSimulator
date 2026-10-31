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
