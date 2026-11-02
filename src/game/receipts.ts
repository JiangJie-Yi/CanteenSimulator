// The receipt paper (the owner's: a consumable, as the tissues and the charcoal are): rolls of it in stock, one in the register's printer, a
// slip off it for every customer who pays (the cashier always gives one while the shop's open); the roll run out, the cashier puts in a
// spare; none spare, there's no receipt, and the customer's put out a little (game/reputation's 'receipt'). Bought by the pack.

/** the spare rolls in stock */
export const RECEIPT = 'supply:receipt'
/** how many slips a roll gives (a 57 mm thermal roll, a slip a customer) */
export const ROLL_SLIPS = 100
/** a pack of rolls: how many, and what it costs */
export const RECEIPT_PACK = { rolls: 10, cost: 150 }
/** a new shop's spare rolls (its printer has a full one in it besides) */
export const RECEIPT_START = 5
/** a stock keeper orders a pack once the spares are down to fewer than this */
export const RECEIPT_LOW = 3

/**
 * A slip printed: off the roll in the printer (`roll`, slips left on it); the roll out, a spare put in first (one fewer of `spares`); none
 * spare, nothing printed and nothing used
 */
export function printSlip(roll: number, spares: number): { roll: number; spares: number; printed: boolean; changed: boolean } {
  if (roll >= 1) return { roll: roll - 1, spares, printed: true, changed: false }
  if (spares >= 1) return { roll: ROLL_SLIPS - 1, spares: spares - 1, printed: true, changed: true }
  return { roll, spares, printed: false, changed: false }
}

/** packs of rolls bought in: how many rolls, what they cost */
export const receiptOrder = (packs: number) => ({ rolls: packs * RECEIPT_PACK.rolls, cost: packs * RECEIPT_PACK.cost })
