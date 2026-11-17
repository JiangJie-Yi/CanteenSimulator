/**
 * The two bins by the sink (item 208, the owner's, 2026-11-16: 「垃圾桶及資源回收桶不好看，然後它們也得運作」): what's cleared off the
 * customers' places goes into them as the plates go into the sink: the bamboo sticks, the fish's bones and the crumpled tissues into the
 * rubbish bin; the empty bottles and cans into the recycling bin. Each fills by what goes in (of 1: its bag full); once it's EMPTY_AT
 * full the stock keeper (or, with none hired, a server with nothing else to do) ties up its bag, carries it out by the staff door and puts
 * a new bag in. A full one takes more heaped up (pressed down), no more than OVER; what's in them at the night's end is put out after
 * closing (the next day starts with them empty).
 */
export type BinKind = 'rubbish' | 'recycle'
/** how full each is (of 1), and the bottles and cans in the recycling one (each drawn) */
export type Bins = { rubbish: number; recycle: number; cans: number; bottles: number }
/** how much of its bin each thing takes (of 1: a 45-litre bag; a stick next to nothing, a whole fish's bones a good handful, a bottle twice a can) */
export const TAKES = { stick: 0.004, bone: 0.03, tissue: 0.012, can: 0.035, bottle: 0.07 } as const
export type Waste = keyof typeof TAKES
/** which bin a thing goes in */
export const binOf = (w: Waste): BinKind => (w === 'can' || w === 'bottle' ? 'recycle' : 'rubbish')
/** a bin's gone to once it's this full */
export const EMPTY_AT = 0.85
/** as full as a bin gets, heaped and pressed down */
export const OVER = 1.1
export const emptyBins = (): Bins => ({ rubbish: 0, recycle: 0, cans: 0, bottles: 0 })
/** `n` of a thing put in its bin */
export function toss(b: Bins, w: Waste, n = 1): Bins {
  if (n <= 0) return b
  const k = binOf(w)
  const next = { ...b, [k]: Math.min(OVER, b[k] + TAKES[w] * n) }
  if (w === 'can') next.cans += n
  if (w === 'bottle') next.bottles += n
  return next
}
/** whether a bin wants emptying */
export const wantsEmptying = (b: Bins, k: BinKind) => b[k] >= EMPTY_AT
/** a bin's bag taken out and a new one put in */
export const bagOut = (b: Bins, k: BinKind): Bins => (k === 'rubbish' ? { ...b, rubbish: 0 } : { ...b, recycle: 0, cans: 0, bottles: 0 })
/**
 * Where a bin's full bag goes (item 318, the owner's, 2026-11-18: 「我發現營業時，有人跑去開員工專用門」: the stock keeper carried each one out
 * through the staff door and up the stair while customers ate): while there are customers about, tied up and stowed in the cupboard under
 * the sink beside the bins (a new bag taken out of it), to be put out after closing with the rest; with none, out by the staff door
 */
export const bagGoes = (customersAbout: boolean): 'underSink' | 'out' => (customersAbout ? 'underSink' : 'out')
/** the bin that wants emptying first (the fuller), or none */
export const binToEmpty = (b: Bins): BinKind | null => {
  const r = wantsEmptying(b, 'rubbish'), c = wantsEmptying(b, 'recycle')
  if (r && c) return b.rubbish >= b.recycle ? 'rubbish' : 'recycle'
  return r ? 'rubbish' : c ? 'recycle' : null
}
