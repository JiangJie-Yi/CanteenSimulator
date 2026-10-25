/**
 * The till's cash register, as a pure state machine: the keys pressed in turn, what the displays read, what it rings up, and what it
 * does besides (the drawer, the receipt, a beep). The 3D register (shops/grill) only shows this and passes the keys in.
 *
 * As an ordinary electronic register works: figures typed are the entry; a department key rings the entry up (or that department's set
 * price if nothing's typed), X/TIME first makes it so many of them; CASH takes the entry as what was handed over (or exact money), shows
 * the change, opens the drawer and prints the receipt. The mode lock: OFF dead, REG selling, X the day's takings read, Z read and reset.
 */

export type RegMode = 'OFF' | 'REG' | 'X' | 'Z'
export const REG_MODES: RegMode[] = ['OFF', 'REG', 'X', 'Z']
export type RegKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'DOT'
  | 'CLEAR' | 'D1' | 'D2' | 'D3' | 'D4' | 'PLU' | 'XTIME' | 'RCPT' | 'FEED' | 'VOID' | 'RETURN' | 'CANCEL' | 'TAX' | 'CLERK'
  | 'PCTMINUS' | 'PCTPLUS' | 'NOSALE' | 'CALC' | 'RA' | 'PO' | 'CHECK' | 'CHARGE' | 'SUBTOTAL' | 'CASH'

/** the department keys: what each is for, and its set price (rung up when nothing's typed) */
export const DEPTS = [
  { name: '燒烤', price: 380 },
  { name: '飲料', price: 320 },
  { name: '定食', price: 500 },
  { name: '小菜', price: 100 },
]
/** price look-up codes: typed, then PLU */
export const PLUS: Record<number, { name: string; price: number }> = {
  1: { name: '鹽烤香魚', price: 420 },
  2: { name: '烤秋刀魚', price: 380 },
  3: { name: '烤飯糰', price: 160 },
  4: { name: '生啤酒', price: 180 },
  5: { name: '烏龍茶', price: 120 },
}
/** the consumption tax, included in the prices */
export const TAX_RATE = 0.1
/** the most figures the entry takes */
const MAX_DIGITS = 7

export interface RegLine { label: string; amount: number; qty: number }
export interface Receipt {
  kind: 'CASH' | 'CHECK' | 'CHARGE' | 'NOSALE' | 'RA' | 'PO' | 'X' | 'Z'
  lines: RegLine[]
  total: number
  tender: number
  change: number
  tax: number
  clerk: number
  /** the receipt's number, and when it was printed */
  no: number
  at: string
}
export interface RegEffect {
  drawer?: boolean
  receipt?: Receipt
  /** the paper fed on a little, blank */
  feed?: boolean
  beep?: 'ok' | 'error'
}
export interface RegState {
  mode: RegMode
  /** figures typed and not yet used */
  entry: string
  /** how many of the next item (X/TIME) */
  qty: number
  /** the next item a refund (RETURN) */
  refund: boolean
  /** the sale being rung up */
  lines: RegLine[]
  /** the sale just settled: the next figure typed starts a new one */
  done: boolean
  /** what the displays read */
  display: string
  receiptOn: boolean
  clerk: number
  /** the calculator, while it's on: the running figure and the operation waiting for the next */
  calc: { acc: number; op: '+' | '-' | '*' | null } | null
  /** the day's takings and customers, and the cash put in and paid out besides */
  sales: number
  count: number
  float: number
  receiptNo: number
}

export const newRegister = (): RegState => ({
  mode: 'REG', entry: '', qty: 1, refund: false, lines: [], done: false, display: '0', receiptOn: true, clerk: 1, calc: null,
  sales: 0, count: 0, float: 0, receiptNo: 1,
})

/** the figures as the displays show them: thousands commas, a minus in front */
export const regFigure = (n: number) => (n < 0 ? '-' : '') + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
export const subtotalOf = (s: RegState) => s.lines.reduce((a, l) => a + l.amount, 0)
/** the tax inside a tax-included amount */
export const taxIn = (amount: number) => Math.round((amount * TAX_RATE) / (1 + TAX_RATE))
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const stamp = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${clock(d)}`

const error = (s: RegState) => ({ state: { ...s, display: 'E' }, effect: { beep: 'error' } as RegEffect })
const ok = (s: RegState, effect: RegEffect = {}) => ({ state: s, effect: { beep: 'ok', ...effect } as RegEffect })

/** turn the mode lock: OFF blanks the displays, X and Z show the day's takings, REG starts afresh */
export function setMode(s: RegState, mode: RegMode): RegState {
  const base = { ...s, mode, entry: '', qty: 1, refund: false, calc: null }
  if (mode === 'OFF') return { ...base, display: '' }
  if (mode === 'X' || mode === 'Z') return { ...base, display: regFigure(s.sales) }
  return { ...base, display: s.lines.length && !s.done ? regFigure(subtotalOf(s)) : '0' }
}

/** a sale settled (by a customer at the till, or rung up by hand): its receipt, and the takings counted */
export function settle(s: RegState, lines: RegLine[], tender: number, kind: 'CASH' | 'CHECK' | 'CHARGE', now: Date) {
  const total = lines.reduce((a, l) => a + l.amount, 0)
  const receipt: Receipt = { kind, lines, total, tender, change: Math.max(0, tender - total), tax: taxIn(total), clerk: s.clerk, no: s.receiptNo, at: stamp(now) }
  const state: RegState = { ...s, lines, entry: '', qty: 1, refund: false, done: true, display: regFigure(receipt.change), sales: s.sales + total,
    count: s.count + 1, receiptNo: s.receiptNo + 1 }
  return { state, receipt }
}

/** what pressing one key does */
export function pressKey(s0: RegState, key: RegKey, now: Date = new Date()): { state: RegState; effect: RegEffect } {
  if (s0.mode === 'OFF') return { state: s0, effect: {} }
  // (after a sale's settled, its lines stay to be seen until the next figure or item starts another)
  const s: RegState = s0.done && key !== 'FEED' && key !== 'RCPT' ? { ...s0, lines: [], done: false } : s0
  const entryNum = s.entry === '' ? null : Number(s.entry)
  const digit = /^\d+$/.test(key)

  // the reports: in X or Z, CASH prints the day's takings (Z then clears them); the figures do nothing
  if (s.mode === 'X' || s.mode === 'Z') {
    if (key === 'CASH') {
      const receipt: Receipt = { kind: s.mode, lines: [], total: s.sales, tender: 0, change: 0, tax: taxIn(s.sales), clerk: s.clerk, no: s.receiptNo, at: stamp(now) }
      const next = s.mode === 'Z' ? { ...s, sales: 0, count: 0, float: 0, display: '0' } : { ...s }
      return ok({ ...next, receiptNo: s.receiptNo + 1 }, { receipt })
    }
    if (key === 'FEED') return ok(s, { feed: true })
    return ok(s)
  }

  // the calculator: the figures, + − × and =, none of it rung up
  if (s.calc) {
    const c = s.calc
    const apply = (acc: number, op: '+' | '-' | '*' | null, v: number) => (op === '+' ? acc + v : op === '-' ? acc - v : op === '*' ? acc * v : v)
    if (digit || key === 'DOT') {
      if (key === 'DOT' && s.entry.includes('.')) return error(s)
      const entry = (s.entry === '' && key === 'DOT' ? '0' : s.entry) + (key === 'DOT' ? '.' : key)
      if (entry.replace('.', '').length > MAX_DIGITS) return error(s)
      return ok({ ...s, entry, display: entry })
    }
    const ops: Partial<Record<RegKey, '+' | '-' | '*'>> = { PCTPLUS: '+', PCTMINUS: '-', XTIME: '*' }
    if (ops[key]) {
      const acc = entryNum === null ? c.acc : apply(c.acc, c.op, entryNum)
      return ok({ ...s, entry: '', calc: { acc, op: ops[key]! }, display: regFigureCalc(acc) })
    }
    if (key === 'SUBTOTAL' || key === 'CASH') {
      const acc = entryNum === null ? c.acc : apply(c.acc, c.op, entryNum)
      return ok({ ...s, entry: '', calc: { acc, op: null }, display: regFigureCalc(acc) })
    }
    if (key === 'CLEAR') return ok(s.entry ? { ...s, entry: '', display: regFigureCalc(c.acc) } : { ...s, calc: { acc: 0, op: null }, display: '0' })
    if (key === 'CALC') return ok({ ...s, calc: null, entry: '', display: s.lines.length ? regFigure(subtotalOf(s)) : '0' })
    return error(s)
  }

  if (digit) {
    const entry = (s.entry === '0' ? '' : s.entry) + key
    if (entry.length > MAX_DIGITS) return error(s)
    return ok({ ...s, entry, display: regFigure(Number(entry)) })
  }
  const ring = (label: string, price: number) => {
    const amount = price * s.qty * (s.refund ? -1 : 1)
    const lines = [...s.lines, { label: (s.refund ? '退 ' : '') + label, amount, qty: s.qty }]
    return ok({ ...s, lines, entry: '', qty: 1, refund: false, display: regFigure(amount) })
  }
  const sub = subtotalOf(s)
  switch (key) {
    case 'DOT':
      // (yen have no fractions)
      return error(s)
    case 'CLEAR':
      return ok({ ...s, entry: '', qty: 1, refund: false, display: s.lines.length ? regFigure(sub) : '0' })
    case 'D1': case 'D2': case 'D3': case 'D4': {
      const d = DEPTS[Number(key[1]) - 1]
      return ring(d.name, entryNum ?? d.price)
    }
    case 'PLU': {
      const p = entryNum === null ? undefined : PLUS[entryNum]
      if (!p) return error(s)
      return ring(p.name, p.price)
    }
    case 'XTIME':
      if (entryNum === null) return ok({ ...s, display: clock(now) })
      if (entryNum < 1) return error(s)
      return ok({ ...s, qty: entryNum, entry: '', display: `${entryNum} X` })
    case 'PCTMINUS': case 'PCTPLUS': {
      const last = s.lines[s.lines.length - 1]
      if (!last) return error(s)
      const pct = entryNum ?? 10
      const off = Math.round((last.amount * pct) / 100) * (key === 'PCTMINUS' ? -1 : 1)
      const lines = [...s.lines, { label: `${key === 'PCTMINUS' ? '−' : '+'}${pct}%`, amount: off, qty: 1 }]
      return ok({ ...s, lines, entry: '', display: regFigure(off) })
    }
    case 'VOID': {
      if (!s.lines.length) return error(s)
      const lines = s.lines.slice(0, -1)
      return ok({ ...s, lines, entry: '', display: regFigure(subtotalOf({ ...s, lines })) })
    }
    case 'RETURN':
      return ok({ ...s, refund: true, display: 'rF' })
    case 'CANCEL':
      return ok({ ...s, lines: [], entry: '', qty: 1, refund: false, display: '0' })
    case 'SUBTOTAL':
      return ok({ ...s, entry: '', display: regFigure(sub) })
    case 'TAX':
      return ok({ ...s, entry: '', display: regFigure(taxIn(sub)) })
    case 'CASH': case 'CHECK': case 'CHARGE': {
      if (!s.lines.length) return error(s)
      const tender = key === 'CASH' && entryNum !== null ? entryNum : sub
      if (tender < sub) return error(s)
      const { state, receipt } = settle(s, s.lines, tender, key, now)
      return ok(state, { drawer: key !== 'CHARGE', receipt: s.receiptOn ? receipt : undefined })
    }
    case 'NOSALE': {
      if (s.lines.length) return error(s)
      const receipt: Receipt = { kind: 'NOSALE', lines: [], total: 0, tender: 0, change: 0, tax: 0, clerk: s.clerk, no: s.receiptNo, at: stamp(now) }
      return ok({ ...s, entry: '', display: '0', receiptNo: s.receiptNo + 1 }, { drawer: true, receipt: s.receiptOn ? receipt : undefined })
    }
    case 'RA': case 'PO': {
      if (entryNum === null || s.lines.length) return error(s)
      const amount = key === 'RA' ? entryNum : -entryNum
      const receipt: Receipt = { kind: key, lines: [], total: amount, tender: 0, change: 0, tax: 0, clerk: s.clerk, no: s.receiptNo, at: stamp(now) }
      return ok({ ...s, entry: '', float: s.float + amount, display: regFigure(amount), receiptNo: s.receiptNo + 1 },
        { drawer: true, receipt: s.receiptOn ? receipt : undefined })
    }
    case 'CLERK':
      if (entryNum === null || entryNum < 1 || entryNum > 99) return error(s)
      return ok({ ...s, clerk: entryNum, entry: '', display: `C-${String(entryNum).padStart(2, '0')}` })
    case 'RCPT':
      return ok({ ...s, receiptOn: !s.receiptOn, display: s.receiptOn ? 'rc OFF' : 'rc on' })
    case 'FEED':
      return ok(s, { feed: true })
    case 'CALC':
      return ok({ ...s, entry: '', calc: { acc: 0, op: null }, display: '0' })
  }
  return error(s)
}

/** the calculator's figure: as many places as it needs, up to four */
const regFigureCalc = (n: number) => (Number.isInteger(n) ? regFigure(n) : String(Math.round(n * 1e4) / 1e4))

/** several keys in turn; the effects of all of them together (the last receipt, the drawer if any opened it) */
export function pressKeys(s: RegState, ks: RegKey[], now: Date = new Date()) {
  let state = s
  const effect: RegEffect = {}
  for (const k of ks) {
    const r = pressKey(state, k, now)
    state = r.state
    if (r.effect.drawer) effect.drawer = true
    if (r.effect.receipt) effect.receipt = r.effect.receipt
    if (r.effect.feed) effect.feed = true
    if (r.effect.beep) effect.beep = r.effect.beep
  }
  return { state, effect }
}
