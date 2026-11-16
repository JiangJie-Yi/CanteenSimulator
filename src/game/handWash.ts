// Washing up by hand at the sink as a flow of its own (item 103, the owner's, 2026-11-14: "make it a flow you work through"): water to wash
// in, then each plate scrubbed (a click on the basin or the stack: the owner comes over) and stood in the draining basket. Pointed at, the
// basin says what's next. Item 217 (the owner's, 2026-11-16: 「這洗碗的流程定的太死也不好玩，誰說一定要裝滿25%才能洗?」): the plug, a basin a
// quarter full waited for, the liquid and the sponge were each a gate, in a fixed order. Now only water's needed, the tap running (the plug
// in or not) or some standing in the basin; the rest is the player's to choose: the liquid washes faster (and with suds), the plug keeps the
// water in (left running with it out, the water's metered all the while). Said as advice, not asked for.
import { CLEAN_AT, DRAIN_CAP, type Drain } from './plates'

/** how much standing water counts as some to wash in (0 empty .. 1 at the overflow): a little, no more (item 217: it was a quarter full) */
export const WASH_WET = 0.02
/** how much longer a plate takes to scrub with no washing-up liquid (the grease shifted by the sponge and the water alone; item 217) */
export const NO_SOAP_SLOW = 1.6
/** a squeeze of the liquid washes this many plates; the water holds no more than this many's worth (item 196, the owner's 「我還是沒法用流理台桌
 * 來手動洗碗」: a squeeze washed three, and with ten or twenty dirty in the sink in the evening the owner was sent back to the bottle every
 * three plates, the boss walking back to his fire between; a squeeze into a basin of water does a sink-load) */
export const SOAP_PUMP = 10
export const SOAP_MAX = 30

export type HandStep = 'none' | 'basketFull' | 'water' | 'scrub'
/** (`tap`: whether the tap's running (item 215)) */
export type HandSink = { dirty: number; drain: Drain; plug: boolean; water: number; soap: number; sponge: boolean; tap?: boolean }

/** whether there's water to wash in: the tap running (under it, the plug in or not), or some standing in the basin (item 217) */
export const hasWater = (s: Pick<HandSink, 'water' | 'tap'>) => !!s.tap || s.water >= WASH_WET

/** what's to be done next: only water's needed (item 217) */
export function handStep(s: HandSink): HandStep {
  if (s.dirty <= 0) return 'none'
  if (s.drain.n >= DRAIN_CAP) return 'basketFull'
  return hasWater(s) ? 'scrub' : 'water'
}
/** advice on the washing as it's set up, not a step (item 217): without the sponge or the liquid, slower; left running with the plug out,
 * more water */
export function washTips(s: HandSink): string[] {
  const out: string[] = []
  if (!s.sponge) out.push('拿著菜瓜布刷得快一倍')
  else if (s.soap <= 0) out.push('擠一點洗碗精刷得更快')
  if (s.tap && !s.plug) out.push('開著水沖著洗比較費水，塞住水槽可以存水')
  return out
}

/**
 * Washing up by hand, the player's own (item 224, the owner's, 2026-11-16: 「自己洗盤子的時候老闆不用來，可以拖曳盤子泡水or給水龍頭直接沖，用菜瓜布+洗碗精清潔
 * 更快」, and 「這個遊戲體驗要好、要直覺」): the top dirty plate taken up off the stack in the sink and held under the running tap or in the
 * water standing in the basin comes clean as it's held there, a rinse the quicker; the sponge in the other hand twice as fast, washing-up
 * liquid (on the sponge, or in the water the plate's in) faster again, scrubbed to and fro (the pointer moving) faster still; clean, stood in
 * the draining basket. Rates: how much of a plate's dirt (0 clean .. 1) goes in a second of the shop's clock.
 */
export const RINSE_RATE = 0.2
export const SOAK_RATE = 0.08
export const SPONGE_X = 2
export const SOAP_X = 1.6
export const SCRUB_X = 0.6
/** where the plate in hand is: under the running tap, in the water standing in the basin, or neither (dry) */
export type HandAt = 'tap' | 'water' | null
/** the plate in hand `dt` seconds on (`scrub`: how hard it's being scrubbed to and fro, 0..1) */
export function handClean(dirt: number, dt: number, at: HandAt, o: { sponge: boolean; soap: boolean; scrub: number }) {
  if (!at) return dirt
  const rate = (at === 'tap' ? RINSE_RATE : SOAK_RATE) * (o.sponge ? SPONGE_X : 1) * (o.soap ? SOAP_X : 1) * (1 + SCRUB_X * Math.min(1, Math.max(0, o.scrub)))
  return Math.max(0, dirt - rate * dt)
}
/** what's said of the plate in hand as it's washed (item 234): where it is and how dirty, and the one thing that would make it go faster */
export function handSays(at: HandAt, dirt: number, o: { sponge: boolean; soap: boolean; basketFull: boolean }): string {
  if (dirt <= CLEAN_AT) return o.basketFull ? '乾淨了｜瀝水籃滿了，先把乾的收回碗盤架' : '乾淨了，放進瀝水籃'
  const left = `還有 ${Math.max(1, Math.round(Math.min(1, dirt) * 100))}% 髒`
  if (!at) return `${left}｜沒有水：打開水龍頭`
  const head = at === 'tap' ? `沖水中，${left}` : `泡在水裡，${left}`
  const next = !o.sponge ? '拿著菜瓜布刷得快一倍' : !o.soap ? '擠一點洗碗精刷得更快' : '按著來回刷洗得更快'
  return `${head}｜${next}`
}
/** a squeeze of the liquid into the water (what's in it so far kept, up to the most it holds) */
export const pumpSoap = (soap: number) => Math.min(SOAP_MAX, soap + SOAP_PUMP)
/** a plate scrubbed: a plate's worth of the soap used */
export const scrubbed = (soap: number) => Math.max(0, soap - 1)
/** the soap goes with the water: the basin let out (it had water standing, and has none now), none left; squeezed with none standing (onto
 * the sponge, washing under the tap: item 217), it's kept till it's used */
export const soapWith = (soap: number, was: number, water: number) => (was >= WASH_WET && water < WASH_WET ? 0 : soap)

/** what the basin says of the next step (item 215, the owner's 「我還是不會洗，教我否?」: it said what to do, never which thing to click, and the
 * tap was a thin rod at the back of the basin: each step's thing lights up now (GUIDE_OF), and the hint says so) */
export const HAND_STEP_SAYS: Record<HandStep, string> = {
  none: '沒有髒盤子',
  basketFull: '瀝水籃滿了，點瀝水籃把乾的收回碗盤架',
  // (item 234, the owner's 「流理台洗碗玩法還是很不順」: pressed, a plate's taken up and washed where the water is, the tap turned on if there's
  // none: nothing to aim, nothing to carry)
  water: '按住髒盤子就開始洗，水龍頭會自己打開',
  scrub: '按住髒盤子就開始洗，按著來回刷',
}
/** the thing that lights up for each step, to be clicked next (none: there's nothing to click but the dirty plates themselves) */
export const GUIDE_OF: Record<HandStep, 'tap' | 'basket' | null> = { none: null, basketFull: 'basket', water: null, scrub: null }
/** said under the next step while there's washing to be done (item 234): how the washing goes on */
export const WASH_FLOW_SAYS = '洗好自己放進瀝水籃，按著不放就接著洗下一個'

/**
 * Washing up by hand is the owner's to do (item 166, the owner's, 2026-11-15: "isn't the owner meant to take it over?"): the player's click
 * on the basin (or the dirty stack) with water to wash in sends him over; he scrubs plate after plate with the sponge, a plate's worth of the
 * liquid each while there's some (without, slower: item 217), till there's nothing left to wash, or no water, and walks back. Why he stops,
 * from the sink as it is after a plate (null: he goes on).
 */
export function handStops(s: HandSink): 'done' | 'basketFull' | 'water' | null {
  if (s.dirty <= 0) return 'done'
  if (s.drain.n >= DRAIN_CAP) return 'basketFull'
  if (!hasWater(s)) return 'water'
  return null
}
/** what he says as he comes over, and as he stops */
export const HAND_WASH_LINES = {
  start: { zh: ['盤子我來洗。'], ja: ['皿はわしが洗おう。'], en: ["I'll do the plates."] },
  done: { zh: ['洗好了。'], ja: ['洗い終わった。'], en: ['All washed.'] },
  basketFull: { zh: ['瀝水籃滿了，先收一收。'], ja: ['水切りかごがいっぱいだ。'], en: ["The draining basket's full."] },
  water: { zh: ['沒水了。'], ja: ['水がない。'], en: ['No water.'] },
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
/** each beat's length, the scrub's for a plate as dirty as `dirt` (0 clean .. 1), longer with no washing-up liquid (`soapy` false, item 217) */
export const beatLength = (beat: WashBeat, dirt: number, soapy = true) =>
  beat === 'take' ? 0.45 : beat === 'bring' ? 0.35 : beat === 'scrub' ? (0.8 + 0.9 * Math.min(1, Math.max(0, dirt))) * (soapy ? 1 : NO_SOAP_SLOW)
    : beat === 'rinse' ? 0.65 : 0.6
/** a plate's washing, all its beats */
export const washPlateS = (dirt: number, soapy = true) => WASH_BEATS.reduce((s, b) => s + beatLength(b, dirt, soapy), 0)
/** the sponge taken up off its dish, and put back */
export const SPONGE_S = 0.5
/** which beat of a plate's washing it is `t` seconds into it, and how far through that beat (0 .. 1); past the end, the rack's end */
export function washBeat(t: number, dirt: number, soapy = true): { beat: WashBeat; k: number } {
  let at = Math.max(0, t)
  for (const beat of WASH_BEATS) {
    const d = beatLength(beat, dirt, soapy)
    // (a hair short of a beat's end is its end: the sum of the lengths taken off one by one comes out a hair under)
    if (at < d - 1e-9) return { beat, k: at / d }
    at = Math.max(0, at - d)
  }
  return { beat: 'rack', k: 1 }
}
