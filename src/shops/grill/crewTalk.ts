/**
 * Who of the crew says what, and when (item 324, the owner's, 2026-11-18: 「老闆與員工說的話還是很不自然，然後員工多半沉默?」): over their
 * heads (StaffWords, from game/shopState's STAFF_TALK), from the lines in data/crewLines. A customer in: the owner calls the welcome and two
 * or three more of those in pass it on, one after another; out of the door: thanks from one or two; an order taken: said back; busy: a
 * call; quiet, now and then two of them have a word, warm or curt as they get on (game/affinity's pairs), oftener as the air's warmer. Only
 * those in the shop just now speak (clocked in and not gone home: ON_DUTY); never the same line twice running.
 *
 * (item 372, the owner's, 2026-11-19: 「員工都沒說話很怪」: measured, 90 s of a busy evening at x2, the owner 61 lines, one every 1.5 s, and
 * each of the staff 2 to 16, all of them the welcome and thanks passed on; not a word between them, busy. Now the welcome's called first by
 * the floor, who see the door, the owner joining it now and then; an order's said back by the second cook as often as the owner; busy, two
 * of them call to each other at their work (CREW_BUSY) every 8 to 14 s; and each of those in has a word to themselves now and then, of
 * their own job or the part of the night it is (CREW_SELF, CREW_SELF_TIME).)
 */
import { CREW_ANSWER, CREW_BUSY, CREW_CHAT, CREW_COAL, CREW_ECHO, CREW_PLATES, CREW_SELF, CREW_SELF_TIME, CREW_THANKS, CREW_WELCOME, OWNER_LIFT } from '@/data/crewLines'
import type { Lang } from '@/data/i18n'
import type { Role } from '@/data/staff'
import { pairKey } from '@/game/affinity'
import { ATMOS, CREW_ROLES, moodFor, ON_DUTY, STAFF_TALK } from '@/game/shopState'
import { talkPart } from '@/game/talkTime'
import { replaces } from '@/scene/hot'

/** those in the shop and at work just now, the owner first */
export const inShop = () => ['owner', ...[...ON_DUTY.in.keys()].filter((id) => !ON_DUTY.out.has(id))]
/** each one's job (App's CREW_ROLES), the owner his own */
const roleOf = (id: string): Role | 'owner' | undefined => (id === 'owner' ? 'owner' : CREW_ROLES.get(id))
/** who's out on the floor and sees the door, who's in the kitchen */
const onFloor = (id: string) => { const r = roleOf(id); return r === 'server' || r === 'cashier' }
const aCook = (id: string) => { const r = roleOf(id); return r === 'chef' || r === 'sous' }

const lastPick = new Map<string, number>()
/** one of a list, not the one picked last time from it */
function pick<T>(key: string, list: readonly T[]): T {
  let k = Math.floor(Math.random() * list.length)
  if (list.length > 1 && k === lastPick.get(key)) k = (k + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
  lastPick.set(key, k)
  return list[k]
}
const shuffled = <T,>(a: readonly T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])
// (the timers of what's to be said, cleared with the module on a hot update)
const timers = new Set<number>()
replaces(import.meta.hot, () => { for (const t of timers) window.clearTimeout(t); timers.clear() })
/** till when each one's word is showing (a second one from them waits for it: the owner's welcome came over his echo of an order a tenth
 * of a second after it) */
const speaking = new Map<string, number>()
/** when each one last began a word (performance.now()) */
const spoke = new Map<string, number>()
/** said over `id`'s head `after` ms on (or once their word before is done), for `hold` ms */
function sayOver(id: string, text: string, after = 0, hold = 2400) {
  const now0 = performance.now()
  after = Math.max(after, (speaking.get(id) ?? 0) - 500 - now0)
  speaking.set(id, now0 + after + hold)
  spoke.set(id, now0 + after)
  const push = () => { const now = performance.now(); STAFF_TALK.push({ key: now + Math.random(), id, text, until: now + hold }) }
  if (after <= 0) { push(); return }
  const t = window.setTimeout(() => { timers.delete(t); push() }, after)
  timers.add(t)
}
const lastAt = new Map<string, number>()
/** not more often than every `ms` for this kind */
const due = (kind: string, ms: number) => { const now = performance.now(); if (now - (lastAt.get(kind) ?? -1e9) < ms) return false; lastAt.set(kind, now); return true }

/** a customer in: the welcome, called first by one on the floor (who see the door; the owner only with nobody else in), passed on by one
 * or two more, the owner among them a third of the time, each their own way of calling it */
export function crewWelcome(lang: Lang) {
  if (!due('welcome', 2500)) return
  const all = inShop()
  const floor = shuffled(all.filter(onFloor))
  const first = floor[0] ?? shuffled(all.filter((id) => id !== 'owner'))[0] ?? 'owner'
  const more = shuffled(all.filter((id) => id !== first && id !== 'owner')).slice(0, Math.random() < 0.5 ? 1 : 2)
  if (first !== 'owner' && Math.random() < 0.35) more.splice(Math.floor(Math.random() * (more.length + 1)), 0, 'owner')
  sayOver(first, pick('welcome', CREW_WELCOME[lang]), 0, 2600)
  more.forEach((id, k) => sayOver(id, pick('welcome', CREW_WELCOME[lang]), 280 + k * (260 + Math.random() * 260), 2400))
}
/** a customer out of the door: thanks from one or two (not `except`, who's said theirs) */
export function crewThanks(lang: Lang, except?: string) {
  if (!due('thanks', 2000)) return
  const who = shuffled(inShop().filter((id) => id !== except)).slice(0, 1 + (Math.random() < 0.5 ? 1 : 0))
  who.forEach((id, k) => sayOver(id, pick('thanks', CREW_THANKS[lang]), 500 + k * 380, 2400))
}
/** an order taken, said back by the kitchen: the second cook, who takes its makings out, six times in ten when there's one in; else the
 * owner at the grill (or `by`); not oftener than every 2.5 s (two orders a second apart, both said back, was the owner never quiet) */
export function crewEcho(lang: Lang, dish: string, by?: string) {
  if (!dish || !due('echo', 2500)) return
  const cook = shuffled(inShop().filter((id) => roleOf(id) === 'chef'))[0]
  sayOver(by ?? (cook && Math.random() < 0.6 ? cook : 'owner'), pick('echo', CREW_ECHO[lang])(dish), 350, 2400)
}
/** a dish called ready at the grill (the owner's call: Roasting): one on the floor answers it, half the time, not oftener than every 3 s */
export function crewAnswer(lang: Lang) {
  if (Math.random() < 0.5) return
  const id = shuffled(inShop().filter(onFloor))[0]
  if (!id || !due('answer', 3000)) return
  sayOver(id, pick('answer', CREW_ANSWER[lang]), 700, 1800)
}
/** busy: a call from `id` (the plates short, the fire wanting coal), not oftener than every half a minute each */
export function crewCall(lang: Lang, kind: 'plates' | 'coal', id: string) {
  if (!id || !due(kind, 30000)) return
  sayOver(id, pick(kind, (kind === 'plates' ? CREW_PLATES : CREW_COAL)[lang]), 0, 2400)
}

const chat = { wait: 12, self: 6 }
/** how long since one last had a word (ms): none of the staff says a thing to themselves within this of their last */
const SELF_GAP = 14000
/**
 * A second of the shop's (App's tick), at the game's `minute`: one of those in has a word to themselves every 5 to 10 s (none within
 * SELF_GAP of their last word), of their own job six times in ten, else of the part of the night it is. Busy, two of them call to each
 * other at their work every 8 to 14 s (the floor asking the kitchen, the kitchen calling the floor, the cooks to each other); quiet (`busy`
 * false), now and then two of those in have a word, the second answering, as warm or curt as they get on (`pairs`); oftener as the air's
 * warmer (every 12 to 26 s, a cold shop's half as often); the air gone cold, now and then the owner says a word to lift it
 */
export function crewChatTick(lang: Lang, dt: number, busy: boolean, pairs: Record<string, number>, minute: number) {
  chat.wait -= dt
  chat.self -= dt
  if (chat.self <= 0) {
    chat.self = 5 + Math.random() * 5
    const now = performance.now()
    const id = shuffled(inShop().filter((x) => x !== 'owner' && now - (spoke.get(x) ?? -1e9) > SELF_GAP))[0]
    const role = id ? roleOf(id) : undefined
    if (id) {
      const part = talkPart(minute)
      const own = role && role !== 'owner' && Math.random() < 0.6
      sayOver(id, own ? pick(`self-${role}`, CREW_SELF[role][lang]) : pick(`self-${part}`, CREW_SELF_TIME[part][lang]), 0, 2600)
    }
  }
  if (chat.wait > 0) return
  const warm = ATMOS.value
  if (busy) {
    chat.wait = 8 + Math.random() * 6
    const all = inShop()
    const floor = shuffled(all.filter(onFloor))
    const cooks = shuffled(all.filter(aCook))
    const kinds: ('ask' | 'call' | 'kitchen')[] = floor.length ? ['ask', 'call', ...(cooks.length ? ['kitchen' as const] : [])] : cooks.length ? ['kitchen'] : []
    if (!kinds.length) return
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    const kitchen = cooks[0] ?? 'owner'
    const [a, b] = kind === 'ask' ? [floor[0], kitchen] : kind === 'call' ? [kitchen, floor[0]] : [cooks[0], cooks[1] ?? 'owner']
    const [said, answer] = pick(`busy-${kind}`, CREW_BUSY[kind][lang])
    sayOver(a, said, 0, 2400)
    sayOver(b, answer, 1300, 2200)
    return
  }
  chat.wait = (12 + Math.random() * 14) * (warm < 35 ? 2 : warm > 65 ? 0.75 : 1)
  if (warm < 35 && Math.random() < 0.35) { sayOver('owner', pick('lift', OWNER_LIFT[lang]), 0, 3200); return }
  const staff = shuffled(inShop().filter((id) => id !== 'owner'))
  if (staff.length < 2) return
  const [a, b] = staff
  const v = pairs[pairKey(a, b)] ?? 50
  const tone = v >= 65 ? 'warm' : v <= 35 ? 'cold' : 'usual'
  const [said, answer] = pick(`chat-${tone}`, CREW_CHAT[tone][lang])
  sayOver(a, said, 0, 2800)
  sayOver(b, answer, 1700, 2800)
  // (and their faces as they say it (item 368): glad between two who get on, cross between two who don't)
  if (tone !== 'usual') { moodFor(a, tone === 'warm' ? 'happy' : 'mad', 4600); moodFor(b, tone === 'warm' ? 'happy' : 'mad', 4600) }
}
