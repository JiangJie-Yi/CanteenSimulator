// Washing up by hand at the sink as a flow of its own (item 103, the owner's, 2026-11-14: "make it a flow you work through"): the plug in,
// the basin filled from the tap, a squeeze of washing-up liquid into the water, the sponge taken up, then each plate scrubbed (a click on the
// basin) and stood in the draining basket. Pointed at, the basin says what's next.
import { DRAIN_CAP, type Drain } from './plates'

/** how full the basin must be to wash in (0 empty .. 1 at the overflow) */
export const WASH_WATER = 0.25
/** a squeeze of the liquid washes this many plates; the water holds no more than this many's worth (item 196, the owner's 「我還是沒法用流理台桌
 * 來手動洗碗」: a squeeze washed three, and with ten or twenty dirty in the sink in the evening the owner was sent back to the bottle every
 * three plates, the boss walking back to his fire between; a squeeze into a basin of water does a sink-load) */
export const SOAP_PUMP = 10
export const SOAP_MAX = 30

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

/**
 * One plate washed by the owner's hands, in its beats (item 174, the owner's, 2026-11-15: 「別再讓我看到這麼低水平的動畫」: the plates went out
 * of the stack and into the basket by themselves, a plate a second, while his hands circled somewhere inside the counter): his hand to the
 * stack and the top plate taken up (`take`), brought over the water (`bring`), scrubbed with the sponge (`scrub`: the longer the dirtier it
 * is, as it always took), rinsed (`rinse`), stood in the basket's next slot (`rack`). In the game's seconds. Before the first plate the sponge
 * is taken up off its dish, after the last put back (SPONGE_S each).
 */
export type WashBeat = 'take' | 'bring' | 'scrub' | 'rinse' | 'rack'
export const WASH_BEATS: readonly WashBeat[] = ['take', 'bring', 'scrub', 'rinse', 'rack']
/** each beat's length, the scrub's for a plate as dirty as `dirt` (0 clean .. 1) */
export const beatLength = (beat: WashBeat, dirt: number) =>
  beat === 'take' ? 0.45 : beat === 'bring' ? 0.35 : beat === 'scrub' ? 0.8 + 0.9 * Math.min(1, Math.max(0, dirt)) : beat === 'rinse' ? 0.65 : 0.6
/** a plate's washing, all its beats */
export const washPlateS = (dirt: number) => WASH_BEATS.reduce((s, b) => s + beatLength(b, dirt), 0)
/** the sponge taken up off its dish, and put back */
export const SPONGE_S = 0.5
/** which beat of a plate's washing it is `t` seconds into it, and how far through that beat (0 .. 1); past the end, the rack's end */
export function washBeat(t: number, dirt: number): { beat: WashBeat; k: number } {
  let at = Math.max(0, t)
  for (const beat of WASH_BEATS) {
    const d = beatLength(beat, dirt)
    // (a hair short of a beat's end is its end: the sum of the lengths taken off one by one comes out a hair under)
    if (at < d - 1e-9) return { beat, k: at / d }
    at = Math.max(0, at - d)
  }
  return { beat: 'rack', k: 1 }
}
