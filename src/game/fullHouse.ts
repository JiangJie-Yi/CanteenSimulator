/**
 * A full house (大入り; item 209, the owner's, 2026-11-16: 「我要讓這遊戲看起來覺得好玩」): every stool at the bar taken by a customer sat at it
 * (waiting for their food or eating), the shop's good night marked as a Japanese shop marks it, with a red 大入 stamp. Told once as it fills;
 * again only after it's emptied by REARM stools and filled up again (not every time one gets up and the next sits down).
 */
export const REARM = 2
/** whether this moment's a full house to be told (`full`), and whether the next one may be (`armed`) */
export function fullHouse(was: { armed: boolean }, seated: number, seats: number): { armed: boolean; full: boolean } {
  const full = was.armed && seats > 0 && seated >= seats
  return { full, armed: full ? false : was.armed || seated <= seats - REARM }
}
