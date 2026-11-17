/**
 * A module's running state handed on through a hot update while the game's being worked on (item 337, mine, from 328 and 332). A change to
 * a module of shared state (shops/grill/bar.ts, game/shopState.ts) runs a fresh copy of it, its objects made anew and empty, while what's
 * on the screen goes on with what it had: the components above keep their own state through the update, and theirs no longer matched the
 * new copy's (six customers left sat on the waiting bench into the next day, none of them on its new list; the shop kept from shutting by
 * them till its last minute). Each copy of a module shares `hot.data`: the copy before's object is found there and handed on, any field the
 * new code has that it lacked put in from the fresh one (a field added in the update).
 *
 * Only for what changes as the game runs, never for a measurement or a place (a kept one would hide an edit to it till the page is
 * reloaded). In a build, or the tests, `hot` is undefined: the fresh one, as before.
 */
export function keep<T>(hot: ImportMeta['hot'] | undefined, name: string, fresh: T): T {
  if (!hot) return fresh
  const was = hot.data[name] as T | undefined
  if (was === undefined || was === null) {
    hot.data[name] = fresh
    return fresh
  }
  // (a plain object: the fields the new code adds put in; a Set, a Map, a list, as it was)
  if (isPlain(was) && isPlain(fresh)) {
    const into = was as Record<string, unknown>, from = fresh as Record<string, unknown>
    for (const k of Object.keys(from)) if (!(k in into)) into[k] = from[k]
  }
  return was
}

const isPlain = (v: unknown): v is object => typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype
