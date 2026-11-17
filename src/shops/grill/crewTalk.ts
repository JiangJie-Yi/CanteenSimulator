/**
 * Who of the crew says what, and when (item 324, the owner's, 2026-11-18: 「老闆與員工說的話還是很不自然，然後員工多半沉默?」): over their
 * heads (StaffWords, from game/shopState's STAFF_TALK), from the lines in data/crewLines. A customer in: the owner calls the welcome and two
 * or three more of those in pass it on, one after another; out of the door: thanks from one or two; an order taken: said back; busy: a
 * call; quiet, now and then two of them have a word, warm or curt as they get on (game/affinity's pairs), oftener as the air's warmer. Only
 * those in the shop just now speak (clocked in and not gone home: ON_DUTY); never the same line twice running.
 */
import { CREW_CHAT, CREW_COAL, CREW_ECHO, CREW_PLATES, CREW_THANKS, CREW_WELCOME, OWNER_LIFT } from '@/data/crewLines'
import type { Lang } from '@/data/i18n'
import { pairKey } from '@/game/affinity'
import { ATMOS, ON_DUTY, STAFF_TALK } from '@/game/shopState'
import { replaces } from '@/scene/hot'

/** those in the shop and at work just now, the owner first */
export const inShop = () => ['owner', ...[...ON_DUTY.in.keys()].filter((id) => !ON_DUTY.out.has(id))]

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
/** said over `id`'s head `after` ms on (or once their word before is done), for `hold` ms */
function sayOver(id: string, text: string, after = 0, hold = 2400) {
  const now0 = performance.now()
  after = Math.max(after, (speaking.get(id) ?? 0) - 500 - now0)
  speaking.set(id, now0 + after + hold)
  const push = () => { const now = performance.now(); STAFF_TALK.push({ key: now + Math.random(), id, text, until: now + hold }) }
  if (after <= 0) { push(); return }
  const t = window.setTimeout(() => { timers.delete(t); push() }, after)
  timers.add(t)
}
const lastAt = new Map<string, number>()
/** not more often than every `ms` for this kind */
const due = (kind: string, ms: number) => { const now = performance.now(); if (now - (lastAt.get(kind) ?? -1e9) < ms) return false; lastAt.set(kind, now); return true }

/** a customer in: the owner's welcome, passed on by one or two of those in, each their own way of calling it */
export function crewWelcome(lang: Lang) {
  if (!due('welcome', 2500)) return
  const others = shuffled(inShop().filter((id) => id !== 'owner')).slice(0, 1 + (Math.random() < 0.5 ? 1 : 0))
  sayOver('owner', pick('welcome', CREW_WELCOME[lang]), 0, 2600)
  others.forEach((id, k) => sayOver(id, pick('welcome', CREW_WELCOME[lang]), 280 + k * (260 + Math.random() * 260), 2400))
}
/** a customer out of the door: thanks from one or two (not `except`, who's said theirs) */
export function crewThanks(lang: Lang, except?: string) {
  if (!due('thanks', 2000)) return
  const who = shuffled(inShop().filter((id) => id !== except)).slice(0, 1 + (Math.random() < 0.5 ? 1 : 0))
  who.forEach((id, k) => sayOver(id, pick('thanks', CREW_THANKS[lang]), 500 + k * 380, 2400))
}
/** an order taken, said back by `by` (the owner, or whoever took it) */
export function crewEcho(lang: Lang, dish: string, by = 'owner') {
  if (!dish || !due('echo', 1200)) return
  sayOver(by, pick('echo', CREW_ECHO[lang])(dish), 350, 2400)
}
/** busy: a call from `id` (the plates short, the fire wanting coal), not oftener than every half a minute each */
export function crewCall(lang: Lang, kind: 'plates' | 'coal', id: string) {
  if (!id || !due(kind, 30000)) return
  sayOver(id, pick(kind, (kind === 'plates' ? CREW_PLATES : CREW_COAL)[lang]), 0, 2400)
}

const chat = { wait: 12 }
/**
 * A second of the shop's (App's tick): quiet (`busy` false), now and then two of those in have a word, the second answering, as warm or
 * curt as they get on (`pairs`); oftener as the air's warmer (every 20 to 45 s, a cold shop's half as often); the air gone cold, now and
 * then the owner says a word to lift it
 */
export function crewChatTick(lang: Lang, dt: number, busy: boolean, pairs: Record<string, number>) {
  chat.wait -= dt
  if (chat.wait > 0 || busy) return
  const warm = ATMOS.value
  chat.wait = (20 + Math.random() * 25) * (warm < 35 ? 2 : warm > 65 ? 0.75 : 1)
  if (warm < 35 && Math.random() < 0.35) { sayOver('owner', pick('lift', OWNER_LIFT[lang]), 0, 3200); return }
  const staff = shuffled(inShop().filter((id) => id !== 'owner'))
  if (staff.length < 2) return
  const [a, b] = staff
  const v = pairs[pairKey(a, b)] ?? 50
  const tone = v >= 65 ? 'warm' : v <= 35 ? 'cold' : 'usual'
  const [said, answer] = pick(`chat-${tone}`, CREW_CHAT[tone][lang])
  sayOver(a, said, 0, 2800)
  sayOver(b, answer, 1700, 2800)
}
