/**
 * Where the shop is in closing (App writes it, the scenes read it): `closing` once the owner has shut up for the day, so no
 * new customer comes in while those still here finish; `leaving` once the last has gone, the staff walking out by the staff door.
 */
export const SHOP = { closing: false, leaving: false }
