import { Suspense, useEffect, useState, type ReactNode } from 'react'

/**
 * Mounts its children a stage after the first picture: stage 1 a moment after it (the decor), 2 later (the fixtures with big
 * models: fridges, barrels, cats), 3 last (the customers, the heaviest of all). Each waits for the browser to be idle as well,
 * so building one never lands in the middle of a frame, and the shop is on screen and responding long before it's all in.
 */
const DELAY = [0, 600, 1500, 2600]
export function Later({ stage, children }: { stage: 1 | 2 | 3; children: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {

    const t = window.setTimeout(() => {
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
      if (idle) idle(() => setOn(true), { timeout: 1500 })
      else setOn(true)
    }, DELAY[stage])
    return () => window.clearTimeout(t)
  }, [stage])
  return on ? <Suspense fallback={null}>{children}</Suspense> : null
}
