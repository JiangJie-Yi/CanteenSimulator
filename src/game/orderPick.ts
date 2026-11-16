/**
 * What a customer picks off the menu (item 203: two picks at random, and with those two sold out (or the fire full) they went out with
 * "nothing to be had", one star, though the menu still had dishes to be had): each of the `n` dishes they want is one at random among those
 * not yet found unavailable to them, tried (`tryOne` orders it, true if it could be had) till one can be had or none is left; one found
 * unavailable isn't tried again for them. The same dish can be had twice.
 */
export const pickOrders = <T>(menu: readonly T[], n: number, tryOne: (t: T) => boolean, rand: () => number = Math.random): T[] => {
  const got: T[] = []
  const off = new Set<T>()
  for (let j = 0; j < n; j++) {
    for (;;) {
      const open = menu.filter((t) => !off.has(t))
      if (!open.length) return got
      const t = open[Math.min(open.length - 1, Math.floor(rand() * open.length))]
      if (tryOne(t)) { got.push(t); break }
      off.add(t)
    }
  }
  return got
}

/**
 * How the price puts a customer off (item 210: whatever was asked was paid, a dish at any price ordered as often): at the dish's going price
 * (its parts' own prices, game/economy's fairPrice) or under it, they'll have it; dearer, the likelier they pass it over (one in five more
 * than it's worth, three in ten pass it by; half again, three in four; two thirds over, nobody has it)
 */
export const PRICE_SHY = 1.5
export const takesAt = (price: number, fair: number) => (fair <= 0 ? 1 : Math.max(0, Math.min(1, 1 - PRICE_SHY * (price / fair - 1))))
