import { createElement, memo, useInsertionEffect, useRef, type ComponentType } from 'react'
import * as THREE from 'three'

/**
 * A component's props held steady from one render of its parent to the next (item 374): a big component under a parent drawn a few times a
 * second is drawn again each time it's handed a new callback or a new object of the same values, though nothing it shows has changed (the
 * kitchen, Roasting: the page drew it about three times a second, handing it its callbacks made afresh and its crew, its servings, its names
 * as new objects; and with it everything under it that isn't memoised).
 *
 * - each callback: one function of its own for that prop, always calling the latest one given (so what it calls is never out of date);
 * - each value: kept as it was while it's alike to what comes (the same; an array or a plain object of alike items, two levels down; a
 *   vector at the same place).
 *
 * Only for components whose function props are callbacks (called from effects, frames and events, not during their render: there they'd
 * get the one before), and whose object props aren't changed in place.
 */
type Fn = (...a: unknown[]) => unknown
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype

/** the same for drawing: equal, or an array or plain object of alike items (two levels down), or a vector at the same place */
export function alike(a: unknown, b: unknown, depth = 0): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof THREE.Vector3 && b instanceof THREE.Vector3) return a.equals(b)
  if (depth > 1) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => alike(x, b[i], depth + 1))
  if (plain(a) && plain(b)) {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => k in b && alike(a[k], b[k], depth + 1))
  }
  return false
}

export function useSteady<P extends object>(props: P): P {
  const latest = useRef(props)
  // (the latest props for the callbacks to call, set as the render's committed, before anything under it runs its effects)
  useInsertionEffect(() => { latest.current = props })
  const calls = useRef(new Map<string, Fn>())
  const was = useRef<P | null>(null)
  const prev = was.current as Record<string, unknown> | null
  const next = props as Record<string, unknown>
  const out: Record<string, unknown> = {}
  let same = !!prev && Object.keys(prev).length === Object.keys(next).length
  for (const k of Object.keys(next)) {
    const v = next[k]
    if (typeof v === 'function') {
      let f = calls.current.get(k)
      if (!f) {
        f = (...a: unknown[]) => {
          const now = (latest.current as Record<string, unknown>)[k]
          return typeof now === 'function' ? (now as Fn)(...a) : undefined
        }
        calls.current.set(k, f)
      }
      out[k] = f
    } else out[k] = prev && alike(prev[k], v) ? prev[k] : v
    if (!prev || !Object.is(out[k], prev[k])) same = false
  }
  if (same) return was.current!
  was.current = out as P
  return out as P
}

/** the component drawn again only when its props, held steady (useSteady), have changed */
export function steady<P extends object>(C: ComponentType<P>): ComponentType<P> {
  const M = memo(C) as unknown as ComponentType<P>
  const S = (props: P) => createElement(M, useSteady(props))
  S.displayName = `Steady(${C.displayName || C.name || 'anon'})`
  return S
}
