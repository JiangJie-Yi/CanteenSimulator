/**
 * What a module sets going by itself as it's first run (a listener on the window, a timer, an observer, its own audio), undone when it's
 * run again. A hot update while the game's being worked on runs a fresh copy of a module, and Vite only tells the module that takes the
 * update (the component above it), not this one, so its `dispose` is never called: the copy before was left going, one more with every
 * edit (the key G heard by every copy, each with a developer mode of its own; the old fire hissing on under the new one; the round window
 * repainted for every copy at each turn of the day). Each copy of a module shares `hot.data`, so the copy before's undoing is found there.
 *
 * Called once in a module (a second call would undo the first), with its `import.meta.hot`; in a build that's undefined, and it does
 * nothing.
 */
export function replaces(hot: ImportMeta['hot'], undo: () => void) {
  if (!hot) return
  const was = hot.data.undo as (() => void) | undefined
  hot.data.undo = undo
  was?.()
}
