import { paceBoost, paceOf, SLACK_AFTER, TIRED_AT, type Role, type SkillId } from '@/data/staff'
import { keep } from './hotKeep'

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
/** (`open`: the shop's open (App's `ai`), for what isn't told it otherwise: the sake stand's pouring (item 363)) */
/** those of the staff living upstairs (game/lodging, item 361: each one's own matter, not their job's): App keeps it to the rotas' `lives` */
export const LODGERS = keep(import.meta.hot, 'LODGERS', new Set<string>())
export const SHOP = keep(import.meta.hot, 'SHOP', { closing: false, leaving: false, openedAt: -1e9, day: 0, walking: new Set<string>(), inRoom: 0, counted: false, hurry: false, open: false })
/** the business day whose shift is on (game/shifts): the one open (once counted), or the one coming; the same number either side of the
 * opening, so nobody's swapped for a frame as the shop opens */
export const dutyDay = (open: boolean) => (open && SHOP.counted ? SHOP.day : SHOP.day + 1)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shop?: typeof SHOP }).__shop = SHOP
/**
 * Who of the staff is clocked in (item 336): each one from when they're in at their place as the shop opens (the game's minutes from day 0;
 * their walk in done, commuteWalk, or there at once when there's no walk: Roasting's crew, GuestBar3D's servers and stock keeper), till
 * they're out of the door or up the stair at its shutting (`out`). App pays each by it (game/hours' crewPay) and begins it afresh as the
 * shop opens
 */
export const ON_DUTY = keep(import.meta.hot, 'ON_DUTY', { in: new Map<string, number>(), out: new Set<string>() })
/** in at their place (the first time since the opening counts) */
export const clockIn = (id: string, at: number) => { if (!ON_DUTY.in.has(id)) ON_DUTY.in.set(id, at) }
/** gone home */
export const clockOut = (id: string) => { ON_DUTY.out.add(id) }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __onDuty: ON_DUTY })
/** the staff worn out just now (data/staff's isTired, App keeps it): at half pace in the 3D, a badge beside them */
export const STAFF_TIRED = keep(import.meta.hot, 'STAFF_TIRED', new Set<string>())
/** each of the staff's special skills (data/staff's SKILLS), and whether it's the deep night (game/hours' isLate): App keeps both */
export const STAFF_SKILLS = keep(import.meta.hot, 'STAFF_SKILLS', new Map<string, SkillId[]>())
export const LATE = keep(import.meta.hot, 'LATE', { on: false })
/** the last half hour before closing (game/hours' lastCall): no one more sat down, takeaways only (App keeps it) */
export const LAST_CALL = keep(import.meta.hot, 'LAST_CALL', { on: false })
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __staffState: { STAFF_SKILLS, STAFF_TIRED, LATE } })
/** how fast this one of the staff gets about and gets things done: half, worn out, and as their skills make it now (data/staff's paceOf) */
/** each of the staff's pace for how they feel for the owner (game/affinity's bondPace), and the shop's atmosphere's on them all (moodPace):
 * App keeps both (item 323) */
export const STAFF_BOND = keep(import.meta.hot, 'STAFF_BOND', new Map<string, number>())
export const ATMOS = keep(import.meta.hot, 'ATMOS', { value: 50, pace: 1 })
export const paceOfStaff = (id: string | null | undefined) =>
  !id ? 1 : paceOf(STAFF_TIRED.has(id) ? TIRED_AT : 0, paceBoost({ skills: STAFF_SKILLS.get(id) }, LATE.on)) * (STAFF_BOND.get(id) ?? 1) * ATMOS.pace

/** a word said by one of the staff (or the owner, 'owner'), shown over their head till `until` (performance.now()) */
export type StaffWord = { key: number; id: string; text: string; until: number }
export const STAFF_TALK: StaffWord[] = keep(import.meta.hot, 'STAFF_TALK', [])
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __staffTalk: STAFF_TALK })
/** a word from one of the staff or the owner from inside the scene, over their head and in the day's log (App sets it to its own sayStaff) */
export const STAFF_SAY: { say: (id: string, pool: { zh: readonly string[]; ja: readonly string[]; en: readonly string[] }) => void } = { say: () => {} }
/** the room's light switch by the way in (DiningRoom's, the world's: where it is and the way its face looks out into the room), and who's
 * gone to switch the lights on (one coming in at the opening, the room dark: commuteWalk), since when */
export const SWITCH_SPOT = keep(import.meta.hot, 'SWITCH_SPOT', { at: null as { x: number; y: number; z: number } | null, front: { x: 0, y: 0, z: 1 }, by: '', since: 0 })
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __switchSpot: SWITCH_SPOT })
/** each speaker's tag over their words (the owner's: every bubble says who): a staff member's id, 'owner', 'role:cashier' (whoever's at the
 * till) to their role and name (老闆 江老闆, 外場 小美…); App keeps it up to date with who's hired and the owner's name */
export const SPEAKERS = keep(import.meta.hot, 'SPEAKERS', new Map<string, string>())
/** each of the staff's job, by id (the shop's own server 'house-server' a server): who calls the welcome, who answers an order, who asks the
 * kitchen (shops/grill/crewTalk, item 372). App keeps it with SPEAKERS */
export const CREW_ROLES = keep(import.meta.hot, 'CREW_ROLES', new Map<string, Role>())
/** a face one of the staff makes for a while (item 368): shy at a word of praise, glad of a raise or the staff meal, cross at a cut or a
 * curt word with a colleague (App, crewTalk set it; StaffFigure shows it over what their work says, till `until`, performance.now()) */
export const CREW_MOOD = keep(import.meta.hot, 'CREW_MOOD', new Map<string, { face: 'shy' | 'happy' | 'mad' | 'proud' | 'surprised'; until: number }>())
export const moodFor = (id: string, face: 'shy' | 'happy' | 'mad' | 'proud' | 'surprised', ms = 3000) => { CREW_MOOD.set(id, { face, until: performance.now() + ms }) }
/** when a customer last complained of the wait (performance.now(), shops/grill/bar's gripe): the owner and the staff look alarmed a moment
 * (the owner's: Overcooked's panic as the orders pile up) */
export const RUSH = keep(import.meta.hot, 'RUSH', { at: -1e9 })
/** what the shop's name brings in today (game/reputation's flowOf, taken as the day's business opens: App): how many more customers come
 * (the gap between them divided by it), how patient they are */
export const RATING_FLOW = keep(import.meta.hot, 'RATING_FLOW', { more: 1, patience: 1 })
/** how long (the game's seconds) each of the staff has had nothing to do just now (none: at something), kept by whoever draws them at work
 * (GuestBar3D's servers, stock keeper and plater; Roasting's second cook; App's cashier): App tires them by it (data/staff's activityOf) */
export const STAFF_IDLE = keep(import.meta.hot, 'STAFF_IDLE', new Map<string, number>())
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __staffIdle: STAFF_IDLE })
// (only the stock keeper slacks, his game out (the owner's, 2026-11-10): the rest, with nothing to do, only ever stand by, their idle time
// held short of SLACK_AFTER)
export const idleTick = (id: string | undefined, idle: boolean, dt: number, slacks = false) => {
  if (!id) return
  if (idle) STAFF_IDLE.set(id, Math.min(slacks ? Infinity : SLACK_AFTER - 1, (STAFF_IDLE.get(id) ?? 0) + dt))
  else STAFF_IDLE.delete(id)
}
