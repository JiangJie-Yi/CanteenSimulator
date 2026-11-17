// The back office's line to the game (item 184, the owner's, 2026-11-16: "build the back office next; I'll leave its flow to you"): a
// game is only ever in its own page's memory (a reload starts it over), so the back office (admin.html) is a console on a running game, as
// a game server's admin page is: the game's page tells it what's going on, a snapshot a second, and does the few things it asks. Over a
// BroadcastChannel: two tabs of the same browser, the same site's pages only. The game posts nothing till a back office has said hello (it
// says so every two seconds), and stops five seconds after the last.
import type { Lang } from '@/data/i18n'
import type { DayRecord } from '@/game/daySummary'
import type { Rating, Visit } from '@/game/reputation'

export const ADMIN_CHANNEL = 'jgs-admin-1'
/** what the game's page tells the back office, once a second */
export type AdminSnap = {
  /** when it was taken (the page's clock, ms) */
  at: number
  lang: Lang
  /** the game's day and minute of the day (game/clock) */
  clock: { day: number; minute: number }
  speed: number
  /** open for business (the customers coming in) */
  open: boolean
  owner: string
  cash: number
  /** what the game began with (game/economy's CAPITAL) */
  capital: number
  /** each dish's name, by its id (for the orders and the best sellers) */
  names: Record<string, string>
  /** the books since the game began (App's ledger: revenue, food, fuel, wage, bought, ...) */
  ledger: Record<string, number>
  rating: Rating
  /** every visit scored, and the latest of them, newest first */
  visits: number
  reviews: Visit[]
  /** each day's closing sheet */
  days: DayRecord[]
  /** the customers in the shop just now */
  guests: { id: number; state: string; seat?: number; items: number; rating: number | null }[]
  /** what's been ordered and not yet served, dish by dish */
  orders: { id: string; name: string; n: number }[]
  /** the staff taken on, and whether each is on shift */
  staff: { id: string; role: string; name: string; on: boolean }[]
  /** the day's log, the latest last */
  log: { id: number; who: string; text: string }[]
  /** (items 311 and 317) the servers' trays, in their hands and at the pass; the pieces on the square tray by the fire (none: put away) */
  ware?: { hands: number; pass: number; kakubat: number | null }
}
/** what the back office can ask the game to do */
export type AdminCmd = { kind: 'speed'; x: number } | { kind: 'clock'; day: number; minute: number }
export type AdminMsg = { type: 'hello' } | { type: 'snap'; snap: AdminSnap } | { type: 'cmd'; cmd: AdminCmd }

/** how long after the back office's last hello the game keeps telling it (ms) */
const HEARD_FOR = 5000

/** the game's side: a snapshot posted once a second while a back office is listening, and its commands done; returns its undoing */
export function startAdminLink(snap: () => AdminSnap, run: (c: AdminCmd) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(ADMIN_CHANNEL)
  let heard = 0
  const post = () => { try { ch.postMessage({ type: 'snap', snap: snap() } satisfies AdminMsg) } catch { /* (a snapshot that couldn't be copied: the next one) */ } }
  ch.onmessage = (e: MessageEvent<AdminMsg>) => {
    const m = e.data
    if (m?.type === 'hello') {
      // (a back office just opened: told at once, not a second later)
      const fresh = Date.now() - heard > HEARD_FOR
      heard = Date.now()
      if (fresh) post()
    } else if (m?.type === 'cmd') run(m.cmd)
  }
  const t = window.setInterval(() => { if (Date.now() - heard < HEARD_FOR) post() }, 1000)
  return () => { window.clearInterval(t); ch.close() }
}

/** the back office's side: hello every two seconds, every snapshot handed on, and a way to ask; returns the asking and the undoing */
export function listenToGame(onSnap: (s: AdminSnap) => void): { ask: (c: AdminCmd) => void; stop: () => void } {
  if (typeof BroadcastChannel === 'undefined') return { ask: () => {}, stop: () => {} }
  const ch = new BroadcastChannel(ADMIN_CHANNEL)
  ch.onmessage = (e: MessageEvent<AdminMsg>) => { if (e.data?.type === 'snap') onSnap(e.data.snap) }
  const hello = () => ch.postMessage({ type: 'hello' } satisfies AdminMsg)
  hello()
  const t = window.setInterval(hello, 2000)
  return { ask: (cmd) => ch.postMessage({ type: 'cmd', cmd } satisfies AdminMsg), stop: () => { window.clearInterval(t); ch.close() } }
}
