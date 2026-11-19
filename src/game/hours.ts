/**
 * The shop's hours (the owner's: fixed, 16:30 to 04:30 the next morning, twelve hours, over midnight): opened by hand or by the
 * auto-run only within them; at their end the shop's shut up as by hand (last orders, those here finish and walk out, the staff go home, the day's sheet).
 * Minutes from midnight, as the game's clock (game/clock) keeps them.
 */
export const OPEN_AT = 16 * 60 + 30
export const CLOSE_AT = 4 * 60 + 30
/** whether the shop may be open at this minute of the day */
export const inHours = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= OPEN_AT || m < CLOSE_AT
}
/** the hours just begun between the minute before and now (the clock moved on from `was` to `now`) */
export const hoursBegin = (was: number, now: number) => !inHours(was) && inHours(now)
/** the hours just over between the minute before and now */
export const hoursEnd = (was: number, now: number) => inHours(was) && !inHours(now)
/**
 * Deep night (深夜, the owner's): from midnight till the sky lightens (05:00, game/clock's dawn): the staff tire faster (data/staff's
 * LATE_TIRE, but for the night owls), and they order more (data/guests' LATE_MORE); who comes in is by the part of the night (data/guests'
 * crowdPart and comesAt, item 377).
 */
export const LATE_FROM = 0
export const LATE_TO = 5 * 60
export const isLate = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= LATE_FROM && m < LATE_TO
}
/** the last half hour before closing (the owner's): no one more sat down to eat in, only takeaways and deliveries */
export const LAST_CALL_MIN = 30
export const lastCall = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return inHours(m) && ((CLOSE_AT - m + 1440) % 1440) <= LAST_CALL_MIN
}
/** whether a customer's let in to sit down and eat at this minute: in the hours, before the last half hour */
export const seatsOpen = (minute: number) => inHours(minute) && !lastCall(minute)
/** how many minutes after its hour something happened (the shop opened after OPEN_AT, shut after CLOSE_AT; before it, less than 0), the
 * day's clock going round: the nearer way, within twelve hours either side (the owner's, 2026-11-10: the day's sheet says how late) */
export const lateBy = (hour: number, at: number) => {
  const d = ((((Math.round(at) - hour) % 1440) + 1440) % 1440)
  return d > 720 ? d - 1440 : d
}
/** "HH:MM" read back as minutes from midnight (null if it isn't one) */
export const minutesOf = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
/** the hours as they read: 16:30–04:30 */
export const hoursText = () => `${hm(OPEN_AT)}–${hm(CLOSE_AT)}`
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/**
 * The staff's pay through the day as Japan's labour law has it (the owner's, 2026-11-16: the shop's in Osaka, data/story; 労働基準法第 37 条):
 * a quarter more for the hours past eight in the day's work (時間外労働: 第 32 条's eight hours a day), a quarter more for the hours between
 * 22:00 and 05:00 (深夜労働), half more for both at once. Everyone on the day's shift comes in as the shop opens and goes home after it's shut,
 * so the hours they've worked are the shop's since it opened: opened at 16:30, the night's quarter from 22:00, the eight hours up at 00:30,
 * half more from then till 05:00, a quarter after.
 * (Not counted: the breaks the law asks for (休憩, 第 34 条: an hour in a day over eight hours), taken in turns in a real shop and not paid,
 * the counter never left without its people: the game sends no one off for one; the week's forty hours (each crew works every other day,
 * game/shifts, so its regular hours are under them); the month's overtime past sixty hours at half more (every other day's four hours over
 * come to about sixty).)
 */
export const PAY = { day: 8 * 60, over: 0.25, nightFrom: 22 * 60, nightTo: 5 * 60, night: 0.25 } as const
/** whether this minute of the day is the night's (深夜: 22:00 to 05:00) */
export const isNightWork = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= PAY.nightFrom || m < PAY.nightTo
}
/** what an hour's pay is multiplied by at this minute of the day, `worked` minutes into the day's work: 1, 1.25 or 1.5 */
export const payRate = (minute: number, worked: number) => 1 + (worked > PAY.day ? PAY.over : 0) + (isNightWork(minute) ? PAY.night : 0)
/** what the staff on duty (`perHour`: their hourly wages together) are paid for `minutes` of the shop's clock at this minute of the day,
 * `worked` minutes into the day's work: the pay, and of it the two premiums apart (over eight hours, the night's), for the books */
export function payFor(perHour: number, minutes: number, minute: number, worked: number) {
  const base = (perHour * minutes) / 60
  const over = worked > PAY.day ? base * PAY.over : 0, night = isNightWork(minute) ? base * PAY.night : 0
  return { pay: base + over + night, over, night }
}
/**
 * What the staff on duty are paid for the `minutes` of the shop's clock up to `now` (the game's minutes from day 0), each by their own
 * clocking in (item 336, the owner's, 2026-11-18: 「員工扣薪水是算時薪嗎?沒來上班也扣?」: everyone on the day's shift was paid from the moment
 * the shop opened, those who live out and came in at the door a while later as well): `since` when they came in to their place (none: not
 * in yet, nothing), `gone` once they've gone home; their own eight hours counted from their own coming in; one in part way through the
 * minutes paid only for the part since
 */
export function crewPay(crew: readonly { wage: number; since?: number; gone?: boolean }[], minutes: number, now: number) {
  const minute = ((now % 1440) + 1440) % 1440
  let pay = 0, over = 0, night = 0
  for (const w of crew) {
    if (w.since === undefined || w.gone || w.since >= now) continue
    const p = payFor(w.wage, Math.min(minutes, now - w.since), minute, now - w.since)
    pay += p.pay; over += p.over; night += p.night
  }
  return { pay, over, night }
}
/** a whole day's pay at the hours (16:30 to 04:30) for wages of `perHour` together, the premiums in: what a shift costs */
export function dayPay(perHour: number) {
  let pay = 0
  for (let k = 0, n = (CLOSE_AT - OPEN_AT + 1440) % 1440; k < n; k++) pay += payFor(perHour, 1, OPEN_AT + k, k + 1).pay
  return pay
}
