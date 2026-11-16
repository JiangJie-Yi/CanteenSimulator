// Where the shop is, and what that costs (the owner's, 2026-11-16: 「店當然在大阪，故事都有」, data/story: 大阪天滿). The books are kept in
// NT$ (the owner's), so everything that's paid in yen in Osaka is taken in at one rate: the minimum wage, the rent, the tariffs
// (game/utilities), the card company's fee and the delivery platform's cut.

/** NT$ a yen: the books' rate (about the year's, 2025-26) */
export const YEN = 0.21
/** a sum in yen as NT$ (to the cent: the tariffs' rates are fractions of a dollar) */
export const yen = (n: number) => Math.round(n * YEN * 100) / 100

/** Osaka's minimum wage (大阪府最低賃金: ¥1,231 an hour from 2026-10-01; ¥1,177 before it), no one paid under it */
export const MIN_WAGE_YEN = 1231
/** the same, NT$ an hour */
export const MIN_WAGE = Math.round(MIN_WAGE_YEN * YEN)

/** the rent a month (家賃と共益費): a ten-tsubo ground-floor counter shop off the Tenjinbashi-suji arcade in Tenma, about ¥240,000 */
export const RENT_YEN_MONTH = 240000
/** the same, NT$ a day (a month's thirty days), booked a day at a time (game/costs' rentDue) */
export const RENT_PER_DAY = Math.round((RENT_YEN_MONTH * YEN) / 30)

/** what the card company keeps of a bill paid by card (決済手数料: Visa and Mastercard on the common terminals, 3.24%) */
export const CARD_FEE = 0.0324
/** what the delivery platform keeps of an order a rider takes out (配達込みの手数料: about 35%) */
export const PLATFORM_CUT = 0.35
