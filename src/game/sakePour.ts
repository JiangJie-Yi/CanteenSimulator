// A customer's tokkuri of sake poured by hand at the sake station on the serving counter (item 177, the owner's, 2026-11-15: "that sake stand:
// the way it goes looks odd, and not professional"): the stand on the cook table stood out of everyone's reach (between the hearth and the bar),
// its bottle lifting and pouring by itself while the third cook stood two metres off, and the tokkuri appeared at the customer's place with
// nobody bringing it. Now the open bottle is kept at the pass, the one pouring stands at it and pours with both hands, and a server carries the
// tokkuri and its cup out on their tray. Pure: the beats and their times (GuestBar3D poses the hands and the bottle from them).

/** the pour's beats, in order: a tokkuri set out on the counter, both hands to the bottle, lifted and brought over it, poured, set back
 * upright in its place, and a cup set down beside it */
export type PourBeat = 'jug' | 'grip' | 'lift' | 'pour' | 'back' | 'cup'
export const POUR_BEATS: readonly PourBeat[] = ['jug', 'grip', 'lift', 'pour', 'back', 'cup']
/** how long each takes (seconds of the shop's clock) */
export const POUR_S: Readonly<Record<PourBeat, number>> = { jug: 0.55, grip: 0.4, lift: 0.5, pour: 1.3, back: 0.5, cup: 0.45 }
/** the whole pour, start to finish */
export const POUR_TOTAL = POUR_BEATS.reduce((s, b) => s + POUR_S[b], 0)
/** how long the server takes to lift the tokkuri and cup onto their tray, and to set them down at the customer's place */
export const SAKE_UP_S = 0.45
export const SAKE_SET_S = 0.45

/** where in the pour `t` seconds is: its beat and how far through it (0..1); null before it begins or once it's done */
export function pourBeat(t: number): { beat: PourBeat; k: number } | null {
  if (!(t >= 0) || t >= POUR_TOTAL) return null
  let at = t
  for (const beat of POUR_BEATS) {
    const d = POUR_S[beat]
    if (at < d) return { beat, k: at / d }
    at -= d
  }
  return null
}

/** when the sake runs (s from the pour's start): from a little into the pour beat, the bottle tipped far enough, to a little before its end */
export const STREAM_FROM = POUR_S.jug + POUR_S.grip + POUR_S.lift + 0.22
export const STREAM_TO = POUR_S.jug + POUR_S.grip + POUR_S.lift + POUR_S.pour - 0.12
/** how much of the tokkuri's sake has run in by `t` (0..1): none before the stream, all of it once it's stopped */
export function pouredBy(t: number) {
  return Math.max(0, Math.min(1, (t - STREAM_FROM) / (STREAM_TO - STREAM_FROM)))
}
/** whether the sake's running into the tokkuri just now */
export const streaming = (t: number) => t >= STREAM_FROM && t < STREAM_TO
