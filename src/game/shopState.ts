/**
 * Where the shop is in closing (App writes it, the scenes read it): `closing` once the owner has shut up for the day, so no
 * new customer comes in while those still here finish; `leaving` once the last has gone, the staff walking out (home by the front door,
 * or upstairs by the staff door: game/commute). `openedAt` when it last opened (performance.now()), the staff walking in for a while
 * after; `day` how many times it's opened (each one's moment to set off is their own each day); `walking` who's still on their way out
 * (the shop's shut once nobody is).
 */
/** `inRoom`: the customers still in the room (at their stools, paying, at the toilet, walking out: GuestBar3D counts them): the shop shuts
 * only once it's 0 (the owner's: they used to vanish all at once as it did, the ones paying and walking out with them) */
export const SHOP = { closing: false, leaving: false, openedAt: -1e9, day: 0, walking: new Set<string>(), inRoom: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shop?: typeof SHOP }).__shop = SHOP

/** a word said by one of the staff (or the owner, 'owner'), shown over their head till `until` (performance.now()) */
export type StaffWord = { key: number; id: string; text: string; until: number }
export const STAFF_TALK: StaffWord[] = []
/** each speaker's tag over their words (the owner's: every bubble says who): a staff member's id, 'owner', 'role:cashier' (whoever's at the
 * till) to their role and name (老闆 江老闆, 外場 小美…); App keeps it up to date with who's hired and the owner's name */
export const SPEAKERS = new Map<string, string>()
/** when a customer last complained of the wait (performance.now(), shops/grill/bar's gripe): the owner and the staff look alarmed a moment
 * (the owner's: Overcooked's panic as the orders pile up) */
export const RUSH = { at: -1e9 }
