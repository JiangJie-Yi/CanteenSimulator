/**
 * The fire kept by the third cook (三廚, the owner's: a robata's kitchen split three ways). Each moment the grill looks at its fire and does
 * one of these: asks the third cook for charcoal (the fire's low) or water (it's run too hot a while), waits for what it asked for, drops a
 * handful of charcoal in itself (no one to send, or the one sent away too long with the fire nearly out), or nothing.
 */
export type FireAsk = null | 'coal' | 'water'
export type FireCall = 'ask-coal' | 'ask-water' | 'drop-coal' | 'wait' | 'none'

/** below this (0..1) the fire wants charcoal */
export const FIRE_LOW = 0.35
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
export function fireCall(s: { fire: number; tender: boolean; want: FireAsk; hotFor: number; askedFor: number }): FireCall {
  if (!s.tender) return s.fire < FIRE_LOW ? 'drop-coal' : 'none'
  if (!s.want && s.hotFor > HOT_S) return 'ask-water'
  if (s.fire >= FIRE_LOW) return 'none'
  if (s.want === 'coal') return s.fire < FIRE_OUT && s.askedFor > COAL_WAIT_S ? 'drop-coal' : 'wait'
  return s.want ? 'wait' : 'ask-coal'
}
