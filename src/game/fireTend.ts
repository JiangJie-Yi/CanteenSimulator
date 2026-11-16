/**
 * The fire kept by the third cook (三廚, the owner's: a robata's kitchen split three ways). Each moment the grill looks at its fire and does
 * one of these: asks the third cook for charcoal (the fire's low) or water (it's run too hot a while), waits for what it asked for, drops a
 * handful of charcoal in itself (no one to send, or the one sent away too long with the fire nearly out), or nothing.
 */
export type FireAsk = null | 'coal' | 'water'
export type FireCall = 'ask-coal' | 'ask-water' | 'drop-coal' | 'wait' | 'none'

/** below this (0..1) the fire wants charcoal */
export const FIRE_LOW = 0.35
/** with this many skewers on the fire or waiting for it the kitchen's busy, and keeps its fire up: charcoal on once it's under BUSY_LOW (item
 * 207: let fall to 0.35 all evening, it ran at half its strength, and everything took twice as long) */
export const BUSY_AT = 4
export const BUSY_LOW = 0.62
/** how low the fire's let go before charcoal goes on, as busy as the kitchen is (`load`: the skewers on it or waiting for it) */
export const fireLow = (load: number) => (load >= BUSY_AT ? BUSY_LOW : FIRE_LOW)
/** busy, how long the grill waits for the third cook's charcoal before it tosses a handful in itself (he's away on the rice, the bowls, the
 * plates: in a rush the fire sat at half strength waiting for him) */
export const BUSY_WAIT_S = 8
/** how fast what's on the fire cooks, by the fire's strength: barely on dying embers, and much faster as it's built up (a strong
 * binchotan fire grills fast: the owner's, item 207); about 1.3 at the half, 3.5 full */
export const roastRate = (fire: number) => 0.25 + 1.25 * fire + 2.0 * fire * fire
/** below this it's nearly out */
export const FIRE_OUT = 0.12
/** past this for HOT_S seconds it's too hot: a splash of water */
export const HOT_AT = 0.9
export const HOT_S = 6
/** how long (seconds) the grill waits for charcoal asked for with the fire nearly out before it drops some in itself */
export const COAL_WAIT_S = 20

/**
 * What the grill does about its fire now. `tender`: someone to send (the third cook walking, the shop open); `want`: what it's already
 * asked for; `hotFor`: how long (seconds) the fire's been past HOT_AT; `askedFor`: how long since it asked for charcoal.
 */
export function fireCall(s: { fire: number; tender: boolean; want: FireAsk; hotFor: number; askedFor: number; low?: number }): FireCall {
  // (`low`: how low it's let go before charcoal goes on (fireLow: higher when the kitchen's busy))
  const low = s.low ?? FIRE_LOW
  if (!s.tender) return s.fire < low ? 'drop-coal' : 'none'
  if (!s.want && s.hotFor > HOT_S) return 'ask-water'
  if (s.fire >= low) return 'none'
  // (asked and not come: the grill tosses it in itself, near out after COAL_WAIT_S; busy, under its mark after BUSY_WAIT_S)
  if (s.want === 'coal') return (s.fire < FIRE_OUT && s.askedFor > COAL_WAIT_S) || (low > FIRE_LOW && s.askedFor > BUSY_WAIT_S) ? 'drop-coal' : 'wait'
  return s.want ? 'wait' : 'ask-coal'
}
