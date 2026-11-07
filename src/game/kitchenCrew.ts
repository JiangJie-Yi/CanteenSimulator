/**
 * Who does what in the kitchen while the shop's open (the owner's three-way split): the owner, the head chef (大廚), is at the fire, taking
 * things on and off it; the second cook (二廚) fetches each order out of its store and skewers it at the board; the third cook (三廚) plates,
 * keeps the fire's charcoal and water, the rice and the skewers' washing. With no third cook, the second does that too, between his rounds.
 */
type Cook = { role: string }

/** who plates and keeps the fire: the third cook; with none, the second (hired, or `house`, the shop's own) */
export function platerOf<T extends Cook>(crew: T[], house: T): T {
  return crew.find((w) => w.role === 'sous') ?? crew.find((w) => w.role === 'chef') ?? house
}

/** whether the plater may go off now (for plates, charcoal, the rice): not the second cook while he's on a round with an order */
export const platerFree = (isFetcher: boolean, fetching: boolean) => !(isFetcher && fetching)
