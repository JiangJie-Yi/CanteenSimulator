// The grill drawn flat, for phones: no 3D at all (to save the phone's memory and battery). The same game as the 3D
// grill (Roasting) — what's ordered comes out raw on the tray, goes on the fire, browns and chars, is seasoned, taken
// off, eaten by you (shop shut) or served to the customers (shop open), the AI chef and the customers working the same
// way — drawn as a fire pit seen from above in SVG, with the customers' bar (GuestCounter) over it.
import { canCookByHand, modeOf } from '@/game/mode'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { CHEFS, type Chef } from '@/data/chefs'
import { LINES } from '@/data/lines'
import type { Lang } from '@/data/i18n'
import { kindOf, type GuestKind } from '@/data/guests'
import { ROAST_STAGES, type Roast, type Seasoning } from '@/data/menu'
import { bestStage, PAIRING, PAIRING_DEFAULT, stageOf as seasonStage, timingLoss } from '@/game/taste'
import type { GuestView, Step } from '@/game/types'
import { SHOP } from '@/game/shopState'
import { GAME_SPEED } from '@/scene/speed'
import { drinkFor, GRILL_SEATS, type DrinkId } from './bar'
import { COAL_GLOW, COAL_STICKS, DEFS, FIRE_LIFE, FoodArt, NET, COAL_X, COAL_Y, PIT_ART, PIT_X, PIT_Y, Plate, Soup, TABLE, Tag, ToolIcon, Tray, VIEW_H, VIEW_W } from './Grill2DArt'

const EAT_SECONDS = 3
const PATIENCE = 150
const BAR_SEATS = GRILL_SEATS.length
const FIRE_SKEWERS = 16
const NET_SPOTS = 3
const SIPS = 3
const SOUP_TASTE = 78
const DABS = ['salt', 'soy', 'milk', 'peanut', 'miso', 'wasabi', 'shichimi', 'yuzu', 'lemon'] as const
const COUPLE_HIM = new Set<GuestKind>(['salaryman', 'student', 'highSchoolBoy', 'yankee', 'tourist'])
const COUPLE_HER = new Set<GuestKind>(['officeLady', 'highSchoolGirl', 'yukata', 'maid', 'student', 'gyaru'])
const roastRate = (fire: number) => 0.25 + 1.75 * fire
const stageOf = (r: number) => ROAST_STAGES.find((s) => r < s.until)!
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

type Piece = {
  key: string; id: string; copy: number; loose: boolean; net: boolean
  wasPresent: boolean; staged: boolean; stagedAt: number; onFire: boolean; collected: boolean
  progress: number; dabs: Record<Seasoning, number>; steps: Step[]
  eat: number; eaten: boolean; byGuest: boolean; guest: number
  want: { id: string; dabs: string[]; name: string } | null
  follow?: boolean; seasonOk?: boolean
}
type Guest = { id: number; orders: string[]; ate: string[]; eaten: number[]; since: number; state: GuestView['state']; seat: number
  partner?: number; leftAt?: number; cleared?: boolean }

const freshDabs = () => ({ salt: 0, soy: 0, milk: 0, peanut: 0, miso: 0, wasabi: 0, shichimi: 0, yuzu: 0, lemon: 0, water: 0 }) as Record<Seasoning, number>

/** each food's colour raw (it browns from there), for anything without a picture of its own */
const FOOD_COLOR: [RegExp, string][] = [
  [/Salmon|Nodoguro/, '#f08a5a'], [/Shrimp/, '#f2a0a0'], [/Onigiri|Mochi/, '#f6f0e2'], [/SweetPotato/, '#b0485a'], [/Potato/, '#c8c4bc'],
  [/Corn/, '#f2d04a'], [/Shiitake|KingOyster/, '#b89a78'], [/Shishito|Okra|Asparagus/, '#6aa04a'], [/Sausage|BloodCake/, '#b8584a'],
  [/Yakitori|PorkBelly|Squid|Scallop/, '#f0d8c0'], [/Fish|Saury|Mackerel|Aji|Iwashi|Shishamo|Hokke|Buri|Gindara/, '#a8b4c0'],
]
const colorOf = (id: string) => FOOD_COLOR.find(([r]) => r.test(id))?.[1] ?? '#d8b890'
const DAB_COLOR: Record<string, string> = { salt: '#ffffff', soy: '#5a2a10', milk: '#fff2d0', peanut: '#d8a860', miso: '#a86a2a', wasabi: '#8ac04a',
  shichimi: '#d8401c', yuzu: '#c8d04a', lemon: '#f2e04a', water: '#8ad0f0' }
const DAB_NAME: Record<Lang, Record<string, string>> = {
  zh: { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉', miso: '味噌', wasabi: '山葵', shichimi: '七味', yuzu: '柚子胡椒', lemon: '檸檬', water: '水' },
  ja: { salt: '塩', soy: '醤油', milk: '練乳', peanut: 'きな粉', miso: '味噌', wasabi: 'わさび', shichimi: '七味', yuzu: '柚子胡椒', lemon: 'レモン', water: '水' },
}

export type Grill2DProps = {
  roast: Roast
  itemIds: string[]
  quantities: Record<string, number>
  active: boolean
  fire?: RefObject<number>
  onOffFire?: (count: number, loose: number) => void
  onEat?: (id: string, taste: number, how?: { doneness?: number; dabs?: Record<string, number>; steps?: Step[] }) => void
  notes?: Record<string, { doneness?: number; dabs?: Record<string, number> }>
  onNotice?: (what: 'notCooked' | 'burnt' | 'waste' | 'fireFull') => void
  ai?: boolean
  onOrder?: (id: string, guest?: number) => boolean
  onAddCharcoal?: () => boolean
  onSay?: (who: 'chef' | 'guest', text: string) => void
  space?: 'closed' | 'open'
  lang?: Lang
  names?: Record<string, string>
  onWalkOut?: (ids: string[], guest: number) => void
  entries?: { key: string; name: string; parts: { id: string; dabs: string[]; name: string }[] }[]
  onOrderEntry?: (key: string, guest: number) => boolean
  crowd?: number
  blessed?: boolean
  onDrink?: (guest: number, drink: DrinkId) => void
  chef?: Chef
  onGuests?: (guests: GuestView[]) => void
  /** the customers' bar over the fire (GuestCounter), drawn by the app */
  top?: React.ReactNode
}

export function Grill2D({ roast, itemIds, quantities, active, fire, onOffFire, onEat, notes = {}, onNotice, ai = false, onOrder,
  onAddCharcoal, onSay, space = 'closed', lang = 'zh', names = {}, onWalkOut, entries,
  onOrderEntry, crowd = 1, blessed = false, onDrink, chef = CHEFS[1], onGuests, top }: Grill2DProps) {
  const L = () => LINES[lang]
  const nameOf = (id: string) => names[id] ?? roast.names[id] ?? id
  const menuIds = useMemo(() => new Set(itemIds), [itemIds])
  // the latest props, read by the loop
  const live = useRef({ quantities, fire, ai, active, space, notes, chef, crowd, blessed, entries, lang })
  live.current = { quantities, fire, ai, active, space, notes, chef, crowd, blessed, entries, lang }
  const cb = useRef({ onOffFire, onEat, onNotice, onOrder, onAddCharcoal, onSay, onWalkOut, onOrderEntry, onDrink, onGuests })
  cb.current = { onOffFire, onEat, onNotice, onOrder, onAddCharcoal, onSay, onWalkOut, onOrderEntry, onDrink, onGuests }

  // the pieces, the shut table's and the open shop's apart (as at the 3D grill, each keeps its own food)
  const tables = useRef(new Map<string, Piece[]>([['closed', []], ['open', []]]))
  const pieces = () => tables.current.get(live.current.space)!
  const seq = useRef(0)
  const wants = useRef<{ id: string; dabs: string[]; name: string }[]>([])
  const guests = useRef<Guest[]>([])
  const guestSeq = useRef(0)
  const clocks = useRef({ ai: 0, chef: 0, guest: 0, guestTime: 0, said: 0 })
  const drank = useRef(new Set<number>())
  const sips = useRef(new Map<string, number>())
  const lastOff = useRef(-1)
  const [, setTick] = useState(0)
  const [tool, setTool] = useState<Seasoning | null>(null)
  const [pops, setPops] = useState<{ id: number; key: string; text: string; good: boolean }[]>([])
  const popId = useRef(0)
  /** the drink just taken from the fridge (its shelf lights up a moment) */
  const [, setTaken] = useState<{ id: DrinkId; at: number } | null>(null)

  const present = (p: Piece) => !menuIds.has(p.id) || p.copy < (live.current.quantities[p.id] ?? 0)
  const tasteOf = (p: Piece) => {
    const r = p.progress / roast.times[p.id]
    let t = r < 0.5 ? 10 + r * 20 : r < 1 ? 20 + (r - 0.5) * 70 : r < 1.3 ? 55 + (r - 1) * 30 : r < 2.2 ? 64 - (r - 1.3) * 26 : 12
    for (const k of DABS) {
      const n = p.dabs[k]
      if (!n) continue
      const w = PAIRING[k][p.id] ?? PAIRING_DEFAULT[k]
      const amount = n === 1 ? 1 : n === 2 ? 1.4 : 1.4 - (n - 2) * 0.9
      t += w > 0 ? w * amount : w * n
      const first = p.steps.find((x) => x.k === k)
      if (first) t -= timingLoss(k, first.at)
    }
    t -= p.dabs.water * 6
    return Math.round(clamp(t, 0, 100))
  }
  const pop = (key: string, delta: number) => {
    if (!delta) return
    const id = ++popId.current
    setPops((all) => [...all, { id, key, text: delta > 0 ? `美味 +${delta}` : `美味 ${delta}`, good: delta > 0 }])
    window.setTimeout(() => setPops((all) => all.filter((x) => x.id !== id)), 1400)
  }
  const season = (p: Piece, k: Seasoning) => {
    const before = tasteOf(p)
    p.dabs[k]++
    if (k === 'water') p.progress = Math.max(0, p.progress - roast.times[p.id] * 0.15)
    else p.steps.push({ k, at: seasonStage(p.collected ? null : p.progress / roast.times[p.id]) })
    pop(p.key, tasteOf(p) - before)
  }
  const fresh = (p: Piece) => {
    Object.assign(p, { wasPresent: false, staged: false, onFire: false, collected: false, progress: 0, dabs: freshDabs(), steps: [], eat: 0,
      eaten: false, byGuest: false, guest: -1, want: null, follow: undefined, seasonOk: undefined })
  }
  const onFire = () => pieces().filter((q) => present(q) && q.onFire && !q.collected && !q.eaten)
  const putOnFire = (p: Piece) => {
    if (!p.staged) return false
    if (!p.loose && onFire().filter((q) => !q.loose).length >= FIRE_SKEWERS) {
      cb.current.onNotice?.('fireFull')
      return false
    }
    p.staged = false
    p.onFire = true
    return true
  }
  /** off the fire: onto the plate (shut), or out to the one who ordered it (open) */
  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    p.collected = true
    if (live.current.space === 'open') {
      const owner = guests.current.find((g) => (g.state === 'waiting' || g.state === 'eating') &&
        g.orders.filter((o) => o === p.id).length > pieces().filter((q) => q !== p && q.guest === g.id && q.id === p.id).length)
      p.guest = owner?.id ?? -1
    }
  }
  const eat = (p: Piece) => {
    if (!p.collected || p.eaten || p.eat > 0 || !present(p)) return
    const st = stageOf(p.progress / roast.times[p.id]).key
    if (st === 'raw' || st === 'half') return cb.current.onNotice?.('notCooked')
    if (st === 'burnt') return cb.current.onNotice?.('burnt')
    p.eat = 0.0001
  }
  const toss = (p: Piece) => {
    const stage = stageOf(p.progress / roast.times[p.id]).key
    if (stage === 'done') cb.current.onNotice?.('waste')
    p.eaten = true
    p.onFire = false
  }
  const report = () => cb.current.onGuests?.(guests.current.map((g) => ({ id: g.id, state: g.state, items: g.orders.length, ate: [...g.ate],
    rating: g.eaten.length ? g.eaten.reduce((a, b) => a + b, 0) / g.eaten.length : null, seat: g.seat, partner: g.partner })))

  const bestSeasoning = (id: string) => {
    let best: Exclude<Seasoning, 'water'> | null = null
    let score = 5
    for (const k of DABS) {
      const w = PAIRING[k][id] ?? PAIRING_DEFAULT[k]
      if (w > score) { score = w; best = k }
    }
    return best
  }
  /** the AI chef, one thing at a time (as at the 3D grill) */
  const runChef = () => {
    // (with the shop open the kitchen cooks by itself, as at the 3D grill)
    const hasChef = true, hasSous = true
    const { chef: who, notes: nts, fire: f } = live.current
    const say = (text: string) => {
      if (performance.now() - clocks.current.said > 2500) {
        clocks.current.said = performance.now()
        cb.current.onSay?.('chef', text)
      }
    }
    if (!hasChef && !hasSous) return
    if (f && f.current < 0.35) {
      if (cb.current.onAddCharcoal?.() === false) return
      say(L().addCharcoal)
      return
    }
    const all = pieces().filter((p) => present(p) && !p.eaten)
    const ratio = (p: Piece) => p.progress / roast.times[p.id]
    const burnt = all.find((p) => p.onFire && !p.collected && stageOf(ratio(p)).key === 'burnt')
    if (burnt && (hasSous || !hasChef)) {
      toss(burnt)
      say(L().burntAway)
      return
    }
    const follows = (p: Piece) => {
      const n = nts[p.id]
      if (!n) return null
      if (p.follow === undefined) p.follow = Math.random() < who.seasonChance * 0.85
      return p.follow ? n : null
    }
    const pullOf = (p: Piece) => { const n = follows(p); return n?.doneness !== undefined ? clamp(n.doneness, 0.95, 1.45) : who.pullAt }
    const planOf = (p: Piece): Exclude<Seasoning, 'water'>[] => {
      if (p.want) return p.want.dabs as Exclude<Seasoning, 'water'>[]
      if (p.seasonOk === undefined) p.seasonOk = Math.random() < who.seasonChance
      if (!p.seasonOk) return []
      const noted = follows(p)?.dabs
      const k = noted ? (Object.entries(noted).filter(([x, n]) => n > 0 && x !== 'water').sort((m, n) => n[1] - m[1])[0]?.[0] as Exclude<Seasoning, 'water'> | undefined) ?? null
        : bestSeasoning(p.id)
      return k ? [k] : []
    }
    const dueOnFire = (k: string, r: number) => { const at = bestStage(k); return at === 'before' || at === 'early' ? r < 0.6 : at === 'late' ? r >= 0.85 : false }
    const dab = (p: Piece, k: Exclude<Seasoning, 'water'>) => { season(p, k); say(L().seasoned(p.want?.name ?? nameOf(p.id), k)) }
    const ready = hasChef ? all.find((p) => p.onFire && !p.collected && ratio(p) >= pullOf(p)) : undefined
    if (ready) {
      collect(ready)
      say(L().done(ready.want?.name ?? nameOf(ready.id)))
      for (const k of planOf(ready)) if (!ready.dabs[k] && bestStage(k) === 'after') dab(ready, k)
      return
    }
    const toSeason = hasChef && all.find((p) => p.onFire && !p.collected && planOf(p).some((k) => !p.dabs[k] && dueOnFire(k, ratio(p))))
    if (toSeason) {
      for (const k of planOf(toSeason)) if (!toSeason.dabs[k] && dueOnFire(k, ratio(toSeason))) dab(toSeason, k)
      return
    }
    const next = all.filter((p) => p.staged).sort((a, b) => a.stagedAt - b.stagedAt)[0]
    if (next && putOnFire(next)) say(L().onFire(next.want?.name ?? nameOf(next.id)))
  }
  /** the AI customers (as at the 3D grill): in, order, eat what's theirs as it comes off, rate it, go */
  const runGuests = () => {
    const c = clocks.current
    c.guestTime += 0.8
    const now = c.guestTime
    c.guest += 0.8
    const { crowd: cr, blessed: bl, entries: es } = live.current
    const seated = guests.current.filter((g) => g.state === 'waiting' || g.state === 'eating')
    for (const g of seated) {
      if (g.state !== 'waiting' || drank.current.has(g.id) || Math.random() > 0.8 / 70 || !cb.current.onDrink) continue
      drank.current.add(g.id)
      const d = drinkFor(kindOf(g.id).kind, g.id)
      cb.current.onDrink(g.id, d)
      setTaken({ id: d, at: performance.now() })
    }
    if (cb.current.onOrder && !SHOP.closing && seated.length < BAR_SEATS && c.guest > (7 + Math.random() * 6) * cr) {
      c.guest = 0
      const used = new Set(guests.current.filter((g) => g.state === 'waiting' || g.state === 'eating' || !g.cleared).map((g) => g.seat))
      const free = (n: number) => n < BAR_SEATS && !used.has(n)
      const pairAt = Math.random() < 0.2
        ? Array.from({ length: BAR_SEATS - 1 }, (_, n) => n).find((n) => free(n) && free(n + 1) && GRILL_SEATS[n].counter === GRILL_SEATS[n + 1].counter)
        : undefined
      let ids = [guestSeq.current + 1]
      if (pairAt !== undefined) {
        let i = guestSeq.current + 1
        while (!(COUPLE_HIM.has(kindOf(i).kind) && COUPLE_HER.has(kindOf(i + 1).kind)) && i < guestSeq.current + 400) i++
        if (i < guestSeq.current + 400) ids = [i, i + 1]
      }
      const couple = ids.length === 2
      for (const [k, id] of ids.entries()) {
        const seatFor = couple ? pairAt! + k : Array.from({ length: BAR_SEATS }, (_, n) => n).find((n) => !used.has(n))
        if (seatFor === undefined || used.has(seatFor)) continue
        const want = 1 + Math.floor(Math.random() * 3) + (bl && Math.random() < 0.6 ? 1 : 0)
        const orders: string[] = []
        const said: string[] = []
        for (let j = 0; j < (es ? Math.min(want, bl ? 3 : 2) : want); j++) {
          if (es) {
            const e = es[Math.floor(Math.random() * es.length)]
            if (!e || !e.parts.every((pt) => pt.id in roast.times)) continue
            wants.current.push(...e.parts)
            if (cb.current.onOrderEntry?.(e.key, id)) {
              orders.push(...e.parts.map((pt) => pt.id))
              said.push(e.name)
            } else wants.current.splice(wants.current.length - e.parts.length, e.parts.length)
            continue
          }
          const can = itemIds.filter((x) => x in roast.times)
          const pick = can[Math.floor(Math.random() * can.length)]
          if (pick && cb.current.onOrder(pick, id)) {
            orders.push(pick)
            said.push(nameOf(pick))
          }
        }
        guestSeq.current = Math.max(guestSeq.current, id)
        if (orders.length) {
          used.add(seatFor)
          guests.current.push({ id, orders, ate: [], eaten: [], since: now, state: 'waiting', seat: seatFor, partner: couple ? ids[1 - k] : undefined })
          cb.current.onSay?.('guest', L().order(id, said))
        } else cb.current.onSay?.('guest', L().nothing(id))
      }
      if (couple && !ids.every((x) => guests.current.some((g) => g.id === x))) for (const g of guests.current) if (ids.includes(g.id)) g.partner = undefined
      guests.current = guests.current.filter((g, i, all) => g.state === 'waiting' || g.state === 'eating' || !g.cleared || i >= all.length - 12)
      report()
    }
    for (const g of seated) {
      if (g.eaten.length === 0 && now - g.since > PATIENCE) {
        g.state = 'angry'
        const owed = [...g.orders]
        for (const a of g.ate) owed.splice(owed.indexOf(a), 1)
        cb.current.onWalkOut?.(owed, g.id)
        cb.current.onSay?.('guest', L().angry(g.id))
        report()
      }
    }
    for (const g of guests.current) {
      if (g.state === 'waiting' || g.state === 'eating' || g.cleared) continue
      if (pieces().some((p) => p.guest === g.id && p.eat > 0 && !p.eaten)) continue
      g.leftAt ??= now
      if (now - g.leftAt < 1.6) continue
      g.cleared = true
      for (const p of pieces()) if (p.guest === g.id && p.collected) p.eaten = true
    }
    if (pieces().some((p) => p.eat > 0 && !p.eaten)) return
    for (const g of guests.current) {
      if (g.state !== 'waiting' && g.state !== 'eating') continue
      const owed = [...g.orders]
      for (const id of g.ate) owed.splice(owed.indexOf(id), 1)
      const dish = pieces().find((p) => present(p) && p.collected && !p.eaten && owed.includes(p.id) && (p.guest === g.id || p.guest < 0) &&
        stageOf(p.progress / roast.times[p.id]).key === 'done')
      if (!dish) continue
      const asOrdered = !dish.want || dish.want.dabs.slice().sort().join() ===
        Object.entries(dish.dabs).filter(([k, n]) => n > 0 && k !== 'water').map(([k]) => k).sort().join()
      const taste = Math.max(0, tasteOf(dish) - (asOrdered ? 0 : 15))
      dish.byGuest = true
      dish.guest = g.id
      eat(dish)
      g.eaten.push(taste)
      g.ate.push(dish.id)
      g.state = g.eaten.length >= g.orders.length ? 'done' : 'eating'
      const stars = taste >= 80 ? 5 : taste >= 65 ? 4 : taste >= 45 ? 3 : taste >= 25 ? 2 : 1
      window.setTimeout(() => {
        cb.current.onSay?.('guest', L().verdict(g.id, dish.want?.name ?? nameOf(dish.id), stars))
        report()
      }, EAT_SECONDS * 1000)
      return
    }
  }

  // the loop: on the game's clock (×2 too), a step no longer than a tenth of a second
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let redraw = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)) * GAME_SPEED.value
      last = t
      const { quantities: qty, fire: f, ai: isAi, active: on } = live.current
      const list = pieces()
      // a piece for every portion there could be
      for (const id of Object.keys(roast.times)) {
        const n = menuIds.has(id) ? qty[id] ?? 0 : (roast.drinks?.includes(id) ? 0 : 1)
        for (let c = 0; c < n; c++) if (!list.some((p) => p.id === id && p.copy === c)) {
          list.push({ key: `${id}#${c}`, id, copy: c, loose: roast.loose.includes(id), net: !!roast.net?.includes(id), wasPresent: false, staged: false,
            stagedAt: 0, onFire: false, collected: false, progress: 0, dabs: freshDabs(), steps: [], eat: 0, eaten: false, byGuest: false, guest: -1, want: null })
        }
      }
      let netUsed = 0
      for (const p of list) {
        if (present(p) && !p.wasPresent) {
          p.wasPresent = true
          if (live.current.space === 'open') {
            const i = wants.current.findIndex((w) => w.id === p.id)
            p.want = i >= 0 ? wants.current.splice(i, 1)[0] : null
          }
          if (menuIds.has(p.id)) { p.staged = true; p.stagedAt = ++seq.current } else p.onFire = true
        }
        if (!present(p)) {
          if (p.wasPresent) fresh(p)
          continue
        }
        if (!on || p.eaten) continue
        // (the grill net holds three; the rest wait, not cooking)
        const waiting = p.net && p.onFire && !p.collected && netUsed >= NET_SPOTS
        if (p.net && p.onFire && !p.collected && !waiting) netUsed++
        if (p.onFire && !p.collected && !waiting) p.progress += dt * roastRate(f?.current ?? 0.55)
        if (p.eat > 0) {
          p.eat = Math.min(1, p.eat + dt / EAT_SECONDS)
          if (p.eat >= 1) {
            p.eaten = true
            if (!p.byGuest) cb.current.onEat?.(p.id, tasteOf(p), { doneness: p.progress / roast.times[p.id], dabs: { ...p.dabs }, steps: [...p.steps] })
          }
        }
      }
      if (isAi && on) {
        const c = clocks.current
        c.ai += dt
        c.chef += dt
        if (c.chef > live.current.chef.pace) { c.chef = 0; runChef() }
        if (c.ai > 0.8) { c.ai = 0; runGuests() }
      }
      const off = list.filter((p) => present(p) && (p.collected || p.staged) && !p.eaten && !p.loose).length
      const loose = list.filter((p) => present(p) && p.loose && p.collected && !p.eaten).length
      if (off * 1000 + loose !== lastOff.current) {
        lastOff.current = off * 1000 + loose
        cb.current.onOffFire?.(off, loose)
      }
      redraw += dt
      if (redraw > 0.12) { redraw = 0; setTick((n) => n + 1) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // (the loop reads everything else through refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roast, menuIds])

  // the player's taps
  const tap = (p: Piece) => {
    if (tool) {
      if (!p.eaten) season(p, tool)
      return
    }
    if (p.staged) putOnFire(p)
    else if (!p.collected) collect(p)
    else if (live.current.space === 'closed') eat(p)
  }

  // ---- drawing (the pictures are in Grill2DArt)
  const list = pieces().filter((p) => present(p) && !p.eaten)
  const fireLv = fire?.current ?? 0.55
  const ring = list.filter((p) => p.onFire && !p.collected && !p.net && !p.loose)
  const ash = list.filter((p) => p.onFire && !p.collected && p.loose && !p.net)
  const net = list.filter((p) => p.onFire && !p.collected && p.net)
  const tray = list.filter((p) => p.staged).sort((a, b) => a.stagedAt - b.stagedAt)
  const served = list.filter((p) => p.collected)
  const soups = (roast.drinks ?? []).flatMap((id) => Array.from({ length: quantities[id] ?? 0 }, (_, c) => ({ key: `${id}#${c}`, id, c })))
  const CX = PIT_X, CY = PIT_Y
  const tag = (p: Piece) => {
    const s = stageOf(p.progress / roast.times[p.id])
    return { label: s.label, color: s.key === 'done' ? '#3a8a3a' : s.key === 'burnt' ? '#2a1e1a' : s.key === 'half' ? '#d0801a' : '#9a8a7a' }
  }
  const popOf = (key: string) => pops.find((x) => x.key === key)
  // (how done, rounded, and the seasonings as one digit each: what a food's picture is memoised on)
  const doneOf = (p: Piece) => Math.round((p.progress / roast.times[p.id]) * 40) / 40
  const dkOf = (p: Piece) => DABS.map((k) => Math.min(9, p.dabs[k])).join('')
  // (open, nothing's picked up or seasoned by hand: see game/mode)
  const down = (p: Piece) => (e: React.PointerEvent) => { e.stopPropagation(); if (canCookByHand(modeOf(live.current.ai))) tap(p) }
  const art = (p: Piece) => <FoodArt id={p.id} r={doneOf(p)} dk={dkOf(p)} foil={/Potato/.test(p.id) && !p.collected} fallback={colorOf(p.id)} />
  /** a skewer stuck in the ash round the fire, its food toward the coals (a fish kept right way up) */
  const skewer = (p: Piece, x: number, y: number, a: number) => (
    <g key={p.key} className="g2-piece" onPointerDown={down(p)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})`}>
      <rect x={-40} y={-13} width={62} height={26} fill="transparent" />
      <g transform={Math.cos((a * Math.PI) / 180) < 0 ? 'scale(1 -1)' : undefined}>{art(p)}</g>
    </g>
  )
  /** something lying flat: on the net, in the embers, waiting on the tray, or off the fire on the plate */
  const flat = (p: Piece, x: number, y: number, s = 0.6) => {
    const t = tag(p)
    const pp = popOf(p.key)
    return (
      <g key={p.key} className="g2-piece" onPointerDown={down(p)} transform={`translate(${x} ${y})`}>
        <rect x={-16} y={-14} width={32} height={28} fill="transparent" />
        <g transform={p.loose ? `scale(${s + 0.25})` : `rotate(-28) scale(${s}) translate(10 0)`}>{art(p)}</g>
        {p.eat > 0 && <circle r={12} fill="none" stroke="#e8862a" strokeWidth={2.4} strokeLinecap="round" strokeDasharray={`${p.eat * 75} 80`} transform="rotate(-90)" />}
        {!p.staged && <Tag label={t.label} color={t.color} x={0} y={-12} />}
        {pp && <text y={-20} textAnchor="middle" className={`g2-pop${pp.good ? ' is-good' : ''}`}>{pp.text}</text>}
      </g>
    )
  }
  const slots = Math.max(ring.length, 8)
  const spots = ring.map((p, i) => {
    const a = -Math.PI / 2 + (i / slots) * Math.PI * 2
    return { p, a, x: CX + Math.cos(a) * 104, y: CY + Math.sin(a) * 54 }
  })
  // (potatoes in foil pushed into the embers at the front of the coals)
  const EMBER = [[-52, 12], [52, 12], [-30, 20], [30, 20], [-64, 0], [64, 0], [0, 22], [-14, 24]]
  const fl = clamp(fireLv, 0, 1)
  return (
    <div className="grill2d">
      {top && <div className="grill2d-top">{top}</div>}
      <svg className="grill2d-pit" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
        {DEFS}
        {/* the cook's table; the soup bowls and the sake in its back corners */}
        {TABLE}
        {soups.map((s) => {
          const left = sips.current.get(s.key) ?? SIPS
          return (
            <g key={s.key} className="g2-piece" transform={s.id === 'Sake' ? `translate(${360 - s.c * 40} 22)` : `translate(${24 + s.c * 30} 24)`} onPointerDown={(e) => {
              e.stopPropagation()
              if (left <= 0) return
              sips.current.set(s.key, left - 1)
              if (left - 1 === 0) onEat?.(s.id, SOUP_TASTE)
              setTick((n) => n + 1)
            }}>
              <rect x={-18} y={-15} width={36} height={30} fill="transparent" />
              <Soup id={s.id} left={left} of={SIPS} />
            </g>
          )
        })}
        {/* the fire pit: stones round the white ash, the binchotan glowing as hot as the fire, sparks and smoke */}
        {PIT_ART}
        <ellipse cx={CX} cy={CY} rx={112} ry={50} fill="url(#g2-halo)" opacity={0.2 + 0.8 * fl} />
        <g opacity={0.45 + 0.55 * fl}><ellipse className="g2-flicker" cx={CX} cy={CY} rx={COAL_X - 2} ry={COAL_Y - 2} fill="url(#g2-glow)" /></g>
        {COAL_STICKS}
        <g opacity={0.35 + 0.65 * fl}><g className="g2-flicker">{COAL_GLOW}</g></g>
        {/* the net in the middle, and what's toasting on it */}
        {roast.net && NET}
        {net.map((p, i) => flat(p, CX - 26 + (i % 3) * 26, CY - 2 + Math.floor(i / 3) * 14, 0.75))}
        {ash.map((p, i) => flat(p, CX + EMBER[i % EMBER.length][0], CY + EMBER[i % EMBER.length][1], 0.6))}
        {/* the skewers round the coals, back ones first */}
        {[...spots].sort((m, n) => m.y - n.y).map((s) => skewer(s.p, s.x, s.y, (s.a * 180) / Math.PI))}
        <g opacity={0.2 + 0.8 * fl}>{FIRE_LIFE}</g>
        {/* the tray of what's waiting raw, bottom left; the plate of what's off the fire, bottom right */}
        <Tray x={6} y={172} w={172} h={44} label={lang === 'ja' ? '生（タップで火へ）' : '待烤（點一下上火）'} />
        {tray.slice(0, 10).map((p, i) => flat(p, 28 + (i % 5) * 32, 188 + Math.floor(i / 5) * 16, 0.64))}
        {tray.length > 10 && <text x={172} y={212} textAnchor="end" className="g2-label g2-more">+{tray.length - 10}</text>}
        <Plate cx={296} cy={193} rx={92} ry={23} label={space === 'open' ? (lang === 'ja' ? '出来上がり' : '烤好的') : (lang === 'ja' ? 'お皿（タップで食べる）' : '盤子（點一下吃）')} />
        {served.slice(0, 10).map((p, i) => flat(p, 296 + ((i % 5) - (Math.min(served.length, 5) - 1) / 2) * 32, 192 + Math.floor(i / 5) * 12, 0.66))}
        {/* each skewer's paper tag at its end, over everything, and how much a seasoning did */}
        {spots.map(({ p, a }) => {
          const t = tag(p)
          const pp = popOf(p.key)
          const x = CX + Math.cos(a) * 146, y = CY + Math.sin(a) * 70
          return (
            <g key={p.key} className="g2-piece" onPointerDown={down(p)}>
              <Tag name={(p.want?.name ?? nameOf(p.id)).slice(0, ring.length > 10 ? 4 : 5)} label={t.label} color={t.color} x={x} y={y} />
              {pp && <text x={x} y={y - 14} textAnchor="middle" className={`g2-pop${pp.good ? ' is-good' : ''}`}>{pp.text}</text>}
            </g>
          )
        })}
      </svg>
      {/* the seasonings: pick one, then tap the food to put it on (tap it again to put it down) */}
      {canCookByHand(modeOf(ai)) && <div className="grill2d-tools">
        {([...DABS, 'water'] as Seasoning[]).map((k) => (
          <button key={k} type="button" className={`g2-tool${tool === k ? ' is-on' : ''}`} style={{ ['--dab' as string]: DAB_COLOR[k] }}
            onClick={() => setTool((t) => (t === k ? null : k))}><ToolIcon k={k} /><span>{DAB_NAME[lang][k]}</span></button>
        ))}
      </div>}
    </div>
  )
}
