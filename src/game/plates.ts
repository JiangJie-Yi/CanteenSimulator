// The plates: all of them kept on the dish racks (碗盤櫃). The kitchen (the third cook; with none, the second; with neither, the owner) brings
// a few at a time across to the chef's plating place on the cook table, beside him, and he plates what's grilled there; a server comes into
// the kitchen to him for each plate ready and carries it to its customer (no pass on the bar between: the owner's), clears the plates
// they've done with to the sink (the sticks left on them into the bin beside it), and rinse them, put them in the dish washer under it (洗碗機;
// a dryer (烘碗機) until 2026-11-10, the owner's) and, washed, take them back to the racks (the owner's: the kitchen plates, the floor only
// carries; one server clears, the other washes). The player can work the washer by hand too (Sink: its door, its basket).

/** how many plates the racks hold when full (and how many the shop has) */
export const RACK_FULL = 50
/** the clean plates stacked at the chef's plating place for plating on, at most, and the fewest before the kitchen goes for more */
export const STACK_CAP = 4
export const STACK_LOW = 2
/** how many plates one person carries at a time (a stack in the hands or on the tray) */
export const CARRY = 5
/** the dirty plates at the sink are washed once there are this many (or straight away when the racks have run out) */
export const WASH_AT = 5
/** the dish washer-dryer under the sink: how many plates it takes (the owner's, 2026-11-10: six to eight), and how long a load takes to wash
 * and dry (seconds: about eight, the owner's; it was a dryer, thirty) */
export const DRYER_CAP = 8
export const DRY_S = 8

/** the dish dryer: how many plates are in it, and its time left drying (null: not running, empty or being loaded; 0: done, the plates dry) */
export type Dryer = { n: number; left: number | null }

/** whether the kitchen goes for plates now: the plating place's stack (with what's on its way to it) running low, and the racks not bare */
export const platerGoes = (stock: number, coming: number, rack: number) => stock + coming < STACK_LOW && rack > 0
/** how many it brings: up to the plating place's stack full, no more than it carries or the racks have */
export const platesToBring = (stock: number, rack: number) => Math.max(0, Math.min(STACK_CAP - stock, CARRY, rack))

/** the racks' count once plates are put back: as many as there's room for */
export const putBack = (rack: number, n: number, full = RACK_FULL) => Math.min(full, rack + n)

/** whether the sink's dirty plates are washed now: a batch of them, or any at all once the racks are bare; never while the dryer's drying or
 * has dried plates in it still (they come out first), nor with it full */
export const washNow = (dirty: number, rack: number, dryer: Dryer) =>
  dirty > 0 && dryer.left === null && dryer.n < DRYER_CAP && (dirty >= WASH_AT || rack === 0)
/** a plate washed: out of the sink into the dryer (not while it's full) */
export const washOne = (dirty: number, dryer: Dryer): { dirty: number; dryer: Dryer } =>
  dirty > 0 && dryer.n < DRYER_CAP && dryer.left === null ? { dirty: dirty - 1, dryer: { n: dryer.n + 1, left: null } } : { dirty, dryer }
/** whether the dryer's shut and started now: what's in it, once the sink's washed empty or it's full */
export const dryerStarts = (dirty: number, dryer: Dryer) => dryer.left === null && dryer.n > 0 && (dirty === 0 || dryer.n >= DRYER_CAP)
/** the dryer, a moment on: counting down while it dries, done at 0 */
export const dryerTick = (dryer: Dryer, dt: number): Dryer => (dryer.left !== null && dryer.left > 0 ? { n: dryer.n, left: Math.max(0, dryer.left - dt) } : dryer)
/** a trip's worth of the dried plates out of the dryer (as many as one carries); emptied, it's free for the next load */
export const unload = (dryer: Dryer) => {
  const take = dryer.left === 0 ? Math.min(CARRY, dryer.n) : 0
  const n = dryer.n - take
  return { take, dryer: { n, left: n > 0 ? dryer.left : null } as Dryer }
}

/** what the washer's doing, as it's seen: empty, plates in it waiting, washing, done (the plates clean in it) */
export type DryerPhase = 'idle' | 'loaded' | 'washing' | 'clean'
export const dryerPhase = (d: Dryer): DryerPhase => (d.left === null ? (d.n > 0 ? 'loaded' : 'idle') : d.left > 0 ? 'washing' : 'clean')
/** its door: not to be opened while it washes */
export const canOpen = (d: Dryer) => dryerPhase(d) !== 'washing'
/** the player loading it, its door down (the owner's: click to put the sink's dirty plates in its basket): as many of the sink's as there's
 * room for; none while it washes, nor while it's still got clean ones in it (they come out first) */
export const playerLoad = (dirty: number, d: Dryer) => (d.left === null ? Math.max(0, Math.min(dirty, DRYER_CAP - d.n)) : 0)
/** shut by the player with plates in it, not yet started: it starts */
export const shutStarts = (d: Dryer) => d.left === null && d.n > 0

/** a server's part of the work (the owner's: one clears, the other washes; a lone server does it all) */
export type Duty = 'floor' | 'dish' | 'all'
/** what a free server does next */
export type Chore = 'serve' | 'clear' | 'wash' | 'unload' | null
/**
 * What a free server does next, by their duty. Food plated at the chef's plating place for a seated customer goes to them first, whoever carries it; then the
 * floor's server clears the plates left dirty at the seats to the sink, and the dishes' server takes the dried plates out of the dryer back to
 * the racks (first of all, when the racks are bare), or washes what's in the sink into the dryer. `dirty`: plates left at the seats; `sink`:
 * in the sink, waiting to be washed.
 */
export function nextChore({ duty, serve, dirty, sink, rack, dryer }: { duty: Duty; serve: boolean; dirty: number; sink: number; rack: number; dryer: Dryer }): Chore {
  if (serve) return 'serve'
  const dish = duty !== 'floor', floor = duty !== 'dish'
  const dried = dryer.left === 0 && dryer.n > 0
  if (dish && dried && rack === 0) return 'unload'
  if (dish && washNow(sink, rack, dryer)) return 'wash'
  if (floor && dirty > 0) return 'clear'
  if (dish && dried) return 'unload'
  return null
}
/** each server's duty: two or more, the first on the floor and the second at the dishes (any more on the floor); one alone does both */
export const dutyOf = (k: number, servers: number): Duty => (servers < 2 ? 'all' : k === 1 ? 'dish' : 'floor')
