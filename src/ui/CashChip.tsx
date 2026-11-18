import { memo, useEffect, useRef, useState } from 'react'
import { coinSound } from './uiSound'
import { TillGlyph } from './TillPanel'

/**
 * The cash, top right (item 209, the owner's, 2026-11-16: 「我要讓這遊戲看起來覺得好玩」): money coming in is seen coming in: the figure counts
 * up to it over a moment rather than jumping, bobbing as it does, a coin's ping heard, and what came in floats up out of it (+NT$…); money
 * going out (a purchase) only counts down to it. Drawn again by itself as it counts, not the page. A click opens the ledger (App's), as it did.
 * (item 366: the till's chip beside it, one capsule with it: what's in the register's drawer, counting up as cash customers pay, a click
 * opening the till's own panel (ui/TillPanel))
 */
export const CashChip = memo(function CashChip({ cash, title, open, onClick, tillRead, tillOpen = false, onTill, tillTitle = '' }: { cash: number; title: string
  open: boolean; onClick: () => void
  /** what's in the till's drawer (read a few times a second), whether its panel's open, opening it */
  tillRead?: () => number; tillOpen?: boolean; onTill?: () => void; tillTitle?: string }) {
  const [shown, setShown] = useState(cash)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const was = useRef(cash)
  const raf = useRef(0)
  useEffect(() => {
    const from = was.current, to = cash
    was.current = cash
    if (Math.round(from) === Math.round(to)) { setShown(to); return }
    // (a coin's worth or more come in: told; a purchase or the ledger's own moves: just counted)
    if (to - from >= 1) { setGain({ n: Math.round(to - from), key: performance.now() }); coinSound() }
    const t0 = performance.now(), dur = 650
    cancelAnimationFrame(raf.current)
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - k) ** 3
      setShown(from + (to - from) * e)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [cash])
  // (the float gone once it's risen and faded)
  useEffect(() => {
    if (!gain) return
    const t = window.setTimeout(() => setGain(null), 1500)
    return () => window.clearTimeout(t)
  }, [gain])
  return (
    <div className="cash-pair">
      {tillRead && onTill && <TillChip read={tillRead} open={tillOpen} onClick={onTill} title={tillTitle} />}
      <button type="button" className="money-chip" onClick={onClick} aria-expanded={open} title={title}>
        {/* (each its own key: the figure drawn afresh for its bob, the float for its rise, at each sum come in) */}
        <b key={`sum-${gain?.key ?? 0}`} className={`money${gain ? ' is-up' : ''}`}><small className="money-cur">NT$</small>{Math.round(shown).toLocaleString()}</b>
        {gain && <span key={`in-${gain.key}`} className="cash-up" aria-hidden="true">+NT${gain.n.toLocaleString()}</span>}
      </button>
    </div>
  )
})

/** the till's chip (item 366): the register drawn small and what's in its drawer, counting up as cash comes in (what came in rising out of
 * it in the coins' gold), counting down as it's taken out; read from the room a few times a second, drawn again only as it changes */
const TillChip = memo(function TillChip({ read, open, onClick, title }: { read: () => number; open: boolean; onClick: () => void; title: string }) {
  const [sum, setSum] = useState(read)
  const [shown, setShown] = useState(sum)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const was = useRef(sum)
  const raf = useRef(0)
  useEffect(() => {
    const t = window.setInterval(() => setSum(read()), 300)
    return () => window.clearInterval(t)
  }, [read])
  useEffect(() => {
    const from = was.current, to = sum
    was.current = sum
    if (Math.round(from) === Math.round(to)) return
    if (to - from >= 1) setGain({ n: Math.round(to - from), key: performance.now() })
    const t0 = performance.now(), dur = 650
    cancelAnimationFrame(raf.current)
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - k) ** 3
      setShown(from + (to - from) * e)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [sum])
  useEffect(() => {
    if (!gain) return
    const t = window.setTimeout(() => setGain(null), 1500)
    return () => window.clearTimeout(t)
  }, [gain])
  return (
    <button type="button" className="till-chip" onClick={onClick} aria-expanded={open} title={title}>
      <TillGlyph size={20} />
      <b key={`till-${gain?.key ?? 0}`} className={`till-chip-sum${gain ? ' is-up' : ''}`}>{Math.round(shown).toLocaleString()}</b>
      {gain && <span key={`in-${gain.key}`} className="cash-up is-till" aria-hidden="true">+{gain.n.toLocaleString()}</span>}
    </button>
  )
})
