import { paceBoost, paceOf, TIRED_AT, type SkillId } from '@/data/staff'

/**
 * Where the shop is in closing (App writes it, the scenes read it): `closing` once the owner has shut up for the day, so no
 * new customer comes in while those still here finish; `leaving` once the last has gone, the staff walking out (home by the front door,
 * or upstairs by the staff door: game/commute). `openedAt` when it last opened (performance.now()), the staff walking in for a while
 * after; `day` how many times it's opened (each one's moment to set off is their own each day); `walking` who's still on their way out
 * (the shop's shut once nobody is).
 */
/** `inRoom`: the customers still in the room (at their stools, paying, at the toilet, walking out: GuestBar3D counts them): the shop shuts
 * only once it's 0 (the owner's: they used to vanish all at once as it did, the ones paying and walking out with them) */
/** `counted`: today's opening counted in `day` (between its opening and shutting): the shift on duty is `day`'s then, else the next one's
 * (dutyDay) */
/** (`hurry`: half an hour past closing time and customers still in (App's closing deadlines): those with nothing before them pay for what
 * they've had and go, those eating eat up quickly) */
export const SHOP = { closing: false, leaving: false, openedAt: -1e9, day: 0, walking: new Set<string>(), inRoom: 0, counted: false, hurry: false }
/** the business day whose shift is on (game/shifts): the one open (once counted), or the one coming; the same number either side of the
 * opening, so nobody's swapped for a frame as the shop opens */
export const dutyDay = (open: boolean) => (open && SHOP.counted ? SHOP.day : SHOP.day + 1)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shop?: typeof SHOP }).__shop = SHOP
/** the staff worn out just now (data/staff's isTired, App keeps it): at half pace in the 3D, a badge beside them */
export const STAFF_TIRED = new Set<string>()
/** each of the staff's special skills (data/staff's SKILLS), and whether it's the deep night (game/hours' isLate): App keeps both */
export const STAFF_SKILLS = new Map<string, SkillId[]>()
export const LATE = { on: false }
/** the last half hour before closing (game/hours' lastCall): no one more sat down, takeaways only (App keeps it) */
export const LAST_CALL = { on: false }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __staffState: { STAFF_SKILLS, STAFF_TIRED, LATE } })
/** how fast this one of the staff gets about and gets things done: half, worn out, and as their skills make it now (data/staff's paceOf) */
export const paceOfStaff = (id: string | null | undefined) =>
  !id ? 1 : paceOf(STAFF_TIRED.has(id) ? TIRED_AT : 0, paceBoost({ skills: STAFF_SKILLS.get(id) }, LATE.on))

/** a word said by one of the staff (or the owner, 'owner'), shown over their head till `until` (performance.now()) */
export type StaffWord = { key: number; id: string; text: string; until: number }
export const STAFF_TALK: StaffWord[] = []
/** the room's light switch by the way in (DiningRoom's, the world's: where it is and the way its face looks out into the room), and who's
 * gone to switch the lights on (one coming in at the opening, the room dark: commuteWalk), since when */
export const SWITCH_SPOT = { at: null as { x: number; y: number; z: number } | null, front: { x: 0, y: 0, z: 1 }, by: '', since: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __switchSpot: SWITCH_SPOT })
/** each speaker's tag over their words (the owner's: every bubble says who): a staff member's id, 'owner', 'role:cashier' (whoever's at the
 * till) to their role and name (老闆 江老闆, 外場 小美…); App keeps it up to date with who's hired and the owner's name */
export const SPEAKERS = new Map<string, string>()
/** when a customer last complained of the wait (performance.now(), shops/grill/bar's gripe): the owner and the staff look alarmed a moment
 * (the owner's: Overcooked's panic as the orders pile up) */
export const RUSH = { at: -1e9 }
