// Washing up by hand at the sink as a flow of its own (item 103, the owner's, 2026-11-14: "make it a flow you work through"): the plug in,
// the basin filled from the tap, a squeeze of washing-up liquid into the water, the sponge taken up, then each plate scrubbed (a click on the
// basin) and stood in the draining basket. Pointed at, the basin says what's next.
import { DRAIN_CAP, type Drain } from './plates'

/** how full the basin must be to wash in (0 empty .. 1 at the overflow) */
export const WASH_WATER = 0.25
/** a squeeze of the liquid washes this many plates; the water holds no more than this many's worth */
export const SOAP_PUMP = 3
export const SOAP_MAX = 9

export type HandStep = 'none' | 'basketFull' | 'plug' | 'water' | 'soap' | 'sponge' | 'scrub'
export type HandSink = { dirty: number; drain: Drain; plug: boolean; water: number; soap: number; sponge: boolean }

/** what's to be done next */
export function handStep(s: HandSink): HandStep {
  if (s.dirty <= 0) return 'none'
  if (s.drain.n >= DRAIN_CAP) return 'basketFull'
  if (s.water < WASH_WATER) return s.plug ? 'water' : 'plug'
  if (s.soap <= 0) return 'soap'
  if (!s.sponge) return 'sponge'
  return 'scrub'
}
/** a squeeze of the liquid into the water (what's in it so far kept, up to the most it holds) */
export const pumpSoap = (soap: number) => Math.min(SOAP_MAX, soap + SOAP_PUMP)
/** a plate scrubbed: a plate's worth of the soap used */
export const scrubbed = (soap: number) => Math.max(0, soap - 1)
/** the soap goes with the water: the basin emptied, none left */
export const soapWith = (soap: number, water: number) => (water <= 0 ? 0 : soap)

/** what the basin says of the next step */
export const HAND_STEP_SAYS: Record<HandStep, string> = {
  none: '沒有髒盤子',
  basketFull: '瀝水籃滿了，先把乾的收回碗盤架',
  plug: '洗碗：先塞上塞子（點水槽底的排水孔）',
  water: '洗碗：打開水龍頭放水',
  soap: '洗碗：按一下洗碗精，擠一點到水裡',
  sponge: '洗碗：拿起菜瓜布',
  scrub: '點一下刷一個盤子，刷好放進瀝水籃',
}

/**
 * Washing up by hand is the owner's to do (item 166, the owner's, 2026-11-15: "isn't the owner meant to take it over?"): the player's click
 * on the basin (or the dirty stack) once it's all ready sends him over; he scrubs plate after plate with the sponge, a plate's worth of the
 * liquid each, till there's nothing left to wash, or nothing to wash with, and walks back. Why he stops, from the sink as it is after a plate
 * (null: he goes on).
 */
export function handStops(s: HandSink): 'done' | 'basketFull' | 'soap' | 'water' | null {
  if (s.dirty <= 0) return 'done'
  if (s.drain.n >= DRAIN_CAP) return 'basketFull'
  if (s.water < WASH_WATER) return 'water'
  if (s.soap <= 0) return 'soap'
  return null
}
/** what he says as he comes over, and as he stops */
export const HAND_WASH_LINES = {
  start: { zh: ['盤子我來洗。'], ja: ['皿はわしが洗おう。'], en: ["I'll do the plates."] },
  done: { zh: ['洗好了。'], ja: ['洗い終わった。'], en: ['All washed.'] },
  basketFull: { zh: ['瀝水籃滿了，先收一收。'], ja: ['水切りかごがいっぱいだ。'], en: ["The draining basket's full."] },
  soap: { zh: ['洗碗精用完了，再擠一點。'], ja: ['洗剤が切れた。'], en: ['Out of washing-up liquid.'] },
  water: { zh: ['水不夠了。'], ja: ['水が足りない。'], en: ['Not enough water.'] },
} as const
