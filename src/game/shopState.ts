/**
 * Where the shop is in closing (App writes it, the scenes read it): `closing` once the owner has shut up for the day, so no
 * new customer comes in while those still here finish; `leaving` once the last has gone, the staff walking out (home by the front door,
 * or upstairs by the staff door: game/commute). `openedAt` when it last opened (performance.now()), the staff walking in for a while
 * after; `day` how many times it's opened (each one's moment to set off is their own each day); `walking` who's still on their way out
 * (the shop's shut once nobody is).
 */
export const SHOP = { closing: false, leaving: false, openedAt: -1e9, day: 0, walking: new Set<string>() }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shop?: typeof SHOP }).__shop = SHOP

/** a word said by one of the staff (or the owner, 'owner'), shown over their head till `until` (performance.now()) */
export type StaffWord = { key: number; id: string; text: string; until: number }
export const STAFF_TALK: StaffWord[] = []
