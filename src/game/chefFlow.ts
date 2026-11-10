// The head chef's round with each order in the open shop (the owner's: nothing just appears on the board or the fire): off to where the
// food is kept, takes it out, back to the big board with it in hand, preps it there (salted, scored, its skewer pushed through), and only
// then onto the fire; while it grills the chef fans the salted ones, and fetches the next order meanwhile. Pure rules; Roasting walks it.
import { storageOf } from '@/data/storage'

/** where the chef goes for a food: the freezer for fish and seafood, the fridge under the cook table for what's chilled, the rice tub on
 * the table for the rice balls' rice, the sacks on the kitchen floor for what keeps at room temperature (the potatoes) */
export type Store = 'freezer' | 'cubby' | 'ricetub' | 'sacks'
export const storeOf = (id: string): Store => {
  if (id === 'Onigiri') return 'ricetub'
  const s = storageOf(id)
  return s === 'frozen' ? 'freezer' : s === 'ambient' ? 'sacks' : 'cubby'
}

/** a trip's parts, in order: walking there, taking it out (a lid or a door opened and shut), walking back with it, preparing it on the board */
export type ChefPhase = 'idle' | 'toStore' | 'taking' | 'toBoard' | 'prepping'
/** seconds: taking it out of where it's kept; preparing it on the board */
export const TAKE_S = 0.7
export const PREP_S = 1.6
/** how many the chef brings at once: the first order waiting, and the next ones after it kept in the same place (one trip, not three) */
export const CARRY_MAX = 3
/** the chef's walking pace, a metre and a half a second (the crew's own) */
export const CHEF_PACE = 1.6

/** an order waiting to be fetched: its own key, its food, and when it was ordered (first come, first fetched) */
export type Waiting = { key: string; id: string; at: number }
/**
 * The next trip, if any: to wherever the first order waiting (by when it was ordered) is kept, bringing that one and the next few waiting
 * that are kept in the same place, in the order they came, up to CARRY_MAX.
 */
export function nextTrip(queue: readonly Waiting[], room = CARRY_MAX): { store: Store; keys: string[] } | null {
  // (none while the board's full (fireSlots' BOARD_SLOTS): he waits by it with what he's brought; no more than it has room for)
  if (!queue.length || room <= 0) return null
  const byTime = [...queue].sort((a, b) => a.at - b.at)
  const store = storeOf(byTime[0].id)
  return { store, keys: byTime.filter((w) => storeOf(w.id) === store).slice(0, Math.min(CARRY_MAX, room)).map((w) => w.key) }
}

/** the step after this one once it's finished (the walks end on arriving; taking it out and the prep by their own times) */
export const afterPhase = (p: ChefPhase): ChefPhase =>
  p === 'toStore' ? 'taking' : p === 'taking' ? 'toBoard' : p === 'toBoard' ? 'prepping' : 'idle'

/** how far through the grilling the chef comes to tend it */
export const TEND_AT = 0.5
/** the glazes, brushed on: what's grilled with one of these is brushed, not fanned */
const GLAZES = new Set(['soy', 'miso', 'milk'])
/** how the chef tends a piece half way through: a glaze brushed on (when it's to have one), else the coals under it fanned */
export const tendOf = (plan: readonly string[]): 'brush' | 'fan' => (plan.some((k) => GLAZES.has(k)) ? 'brush' : 'fan')
