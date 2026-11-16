import { memo, useEffect, useRef, useState } from 'react'
import { coinSound } from './uiSound'

/**
 * The cash, top right (item 209, the owner's, 2026-11-16: 「我要讓這遊戲看起來覺得好玩」): money coming in is seen coming in: the figure counts
 * up to it over a moment rather than jumping, bobbing as it does, a coin's ping heard, and what came in floats up out of it (+NT$…); money
 * going out (a purchase) only counts down to it. Drawn again by itself as it counts, not the page. A click opens the ledger (App's), as it did.
 */
export const CashChip = memo(function CashChip({ cash, title, open, onClick }: { cash: number; title: string; open: boolean; onClick: () => void }) {
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
    <button type="button" className="money-chip" onClick={onClick} aria-expanded={open} title={title}>
      {/* (each its own key: the figure drawn afresh for its bob, the float for its rise, at each sum come in) */}
      <b key={`sum-${gain?.key ?? 0}`} className={`money${gain ? ' is-up' : ''}`}><small className="money-cur">NT$</small>{Math.round(shown).toLocaleString()}</b>
      {gain && <span key={`in-${gain.key}`} className="cash-up" aria-hidden="true">+NT${gain.n.toLocaleString()}</span>}
    </button>
  )
})
