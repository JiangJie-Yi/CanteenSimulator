import { GRILL_COUNTERS as C, GRILL_SEATS, BAR_GATES, gateOf, gateCut, seatAlong } from '@/shops/grill/bar'
const [c0, c1] = C
for (const [i, c] of C.entries()) {
  const g = gateOf(c, BAR_GATES[i])
  console.log(`counter ${i}: length ${c.length.toFixed(3)} top ±${((c.length + 0.3) / 2).toFixed(3)} gate hinge ${g.hinge.toFixed(3)} (end ${BAR_GATES[i].end}, cut ${gateCut(BAR_GATES[i])}) seats`, Array.from({ length: c.seats }, (_, n) => seatAlong(c, n).toFixed(3)).join(' '))
}
// the side counter in the long one's frame, and the reverse
const rel = (a: typeof c0, p: any) => { const d = p.clone().sub(a.at); return `along ${d.dot(a.along).toFixed(3)} lay ${d.dot(a.lay).toFixed(3)}` }
console.log('side counter middle in c0:', rel(c0, c1.at), ' long counter middle in c1:', rel(c1, c0.at))
for (const [k, s] of GRILL_SEATS.entries()) console.log(k, 'stool in c0', rel(c0, s.stool), '| in c1', rel(c1, s.stool))
