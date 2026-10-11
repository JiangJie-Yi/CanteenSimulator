// Working out the menu: what a shop's foods could be made into, and how good each ought to come out.
import type { Dish } from '@/data/menu'
import type { Seasoning, Topping } from '@/data/recipes'
import { breadTaste, PAIRING, PAIRING_DEFAULT } from '@/game/taste'

export type Idea = { id: string; dabs: Seasoning[]; taste: number }

/**
 * Every dish a cook could try at a shop, with how good it ought to come out made well: at the grill each food plain
 * and with each seasoning that suits it; at the bakery each dough plain and with each filling that suits it;
 * elsewhere each soup, bowl and side as it comes.
 */
export function trialIdeas(d: Dish): Idea[] {
  const ideas: Idea[] = []
  if (d.roast) {
    for (const it of d.items) {
      if (!(it.id in d.roast.times)) continue
      ideas.push({ id: it.id, dabs: [], taste: 62 })
      for (const k of ['salt', 'soy', 'milk', 'peanut'] as const) {
        const w = PAIRING[k][it.id] ?? PAIRING_DEFAULT[k]
        if (w > 5) ideas.push({ id: it.id, dabs: [k], taste: 62 + w })
      }
    }
  } else if (d.bake) {
    for (const it of d.items) {
      ideas.push({ id: it.id, dabs: [], taste: breadTaste(d.bake, it.id, [], 1.1) })
      for (const [k, w] of Object.entries(d.bake.pairing[it.id] ?? {})) {
        if ((w ?? 0) > 5) ideas.push({ id: it.id, dabs: [k as Topping], taste: breadTaste(d.bake, it.id, [k as Topping], 1.1) })
      }
    }
  } else {
    for (const it of [...d.bases.filter((b) => !b.includes || d.id === 'beefnoodle'), ...d.items]) ideas.push({ id: it.id, dabs: [], taste: 72 })
  }
  return ideas
}
