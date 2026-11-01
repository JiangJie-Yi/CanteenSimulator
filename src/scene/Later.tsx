import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Mounts its children a stage after the first picture: stage 1 a moment after it (the decor), 2 later (the fixtures with big
 * models: fridges, barrels, cats), 3 last (the customers, the heaviest of all). Each waits for the browser to be idle as well,
 * so building one never lands in the middle of a frame. The loading veil waits for them all (laterPending): what's on screen when it
 * lifts is the whole shop, nothing popping in after it (the stools, the fridges, the crates came in seconds after it had gone).
 */
const DELAY = [0, 600, 1500, 2600]
/** the stages mounted but not yet in (still waiting their turn, or their models still loading), and anything else the veil should wait
 * for (holdVeil: a piece not yet measured and shown) */
const pending = new Set<symbol>()
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())
/** whether the scene's staged parts have begun at all (before they mount there's nothing pending, and that isn't "all in") */
let seen = false
/** how many stages (and held things) are still to come in */
export const laterPending = () => pending.size
export const laterSeen = () => seen
export function onLater(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
// (in development, what the veil is waiting for: __veilWait())
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __veilWait?: () => string[] }).__veilWait = () => [...pending].map((s) => s.description ?? '?')
/** something the loading veil should wait for, till the release it returns is called (or it goes) */
export function holdVeil(what = 'held') {
  const me = Symbol(what)
  pending.add(me); tell()
  return () => { if (pending.delete(me)) tell() }
}

export function Later({ stage, children }: { stage: 1 | 2 | 3; children: ReactNode }) {
  const [on, setOn] = useState(false)
  const id = useRef(Symbol(`later-${stage}`))
  useLayoutEffect(() => {
    const me = id.current
    seen = true
    pending.add(me); tell()
    return () => { pending.delete(me); tell() }
  }, [])
  useEffect(() => {
    const t = window.setTimeout(() => {
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
      if (idle) idle(() => setOn(true), { timeout: 1500 })
      else setOn(true)
    }, DELAY[stage])
    return () => window.clearTimeout(t)
  }, [stage])
  // (its last child mounts only once everything before it in the same Suspense has: then the stage is in)
  return on ? <Suspense fallback={null}>{children}<StageIn id={id.current} /></Suspense> : null
}
function StageIn({ id }: { id: symbol }) {
  useEffect(() => { pending.delete(id); tell() }, [id])
  return null
}
