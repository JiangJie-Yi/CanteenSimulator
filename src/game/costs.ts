/**
 * What the shop pays beyond the food, the charcoal, the wages and the meters (the owner's, 2026-11-16: a shop in Osaka, data/story, "every
 * day's costs high"): the rent, a day at a time (data/osaka's RENT_PER_DAY), due for every day since it was last paid, booked as the day's
 * business starts (a day shut is paid for too, with the next day open: the rent's owed whether the door opens or not); what the card company
 * keeps of a bill paid by card; and what the delivery platform keeps of an order a rider takes out.
 */
import { CARD_FEE, PLATFORM_CUT, RENT_PER_DAY } from '@/data/osaka'

/** the rent owed opening on `today`, the last day paid for being `paid` (0: none yet): how many days and how much */
export function rentDue(paid: number, today: number) {
  const days = Math.max(0, Math.floor(today) - Math.floor(paid))
  return { days, amount: days * RENT_PER_DAY }
}
/** what the card company keeps of a bill of `amount` paid by card */
export const cardFee = (amount: number) => Math.max(0, amount) * CARD_FEE
/** what the delivery platform keeps of an order of `price` a rider takes out */
export const platformCut = (price: number) => Math.max(0, price) * PLATFORM_CUT
