// How the people in the 3D rooms carry themselves, as plain data (no React, no three): the moods their faces show,
// and how each kind of them walks. Person3D draws them by these.

/** how a customer's taking it, on their face: pleased (eyes squeezed shut, brows up, a big grin), cross, let down */
export type Mood = 'joy' | 'mad' | 'sad'
export const MOODS: Mood[] = ['joy', 'mad', 'sad']
/** the face's parts for each mood (the plain brows too: they're swapped out for a mood's) */
export function MOOD_PARTS() {
  return ['brows', 'eyesJoy', ...MOODS.flatMap((m) => [`brows${cap(m)}`, `mouth${cap(m)}`])]
}
export const cap = (m: string) => m[0].toUpperCase() + m.slice(1)
/** a customer's mood from how they rated it (or that they walked out): none while they've not said */
export const moodOf = (g: { rating: number | null; state: string }): Mood | null =>
  g.state === 'angry' ? 'mad' : g.rating === null ? null : g.rating >= 65 ? 'joy' : g.rating < 45 ? 'sad' : null

/**
 * How each kind walks (the model's own actions): the women their own way, quick light steps; the middle-aged uncle a
 * heavier tread; the old folk a slow stooped shuffle; the rest a man's easy stride. And how fast, for the same.
 */
export const walkOf = (kind: string) => kind === 'grandma' || kind === 'grandpa' ? 'WalkO' : kind === 'uncle' ? 'WalkU'
  : ['officeLady', 'highSchoolGirl', 'yukata', 'maid', 'gyaru', 'staffF'].includes(kind) ? 'WalkF' : 'Walk'
export const walkSpeedOf = (kind: string) => ({ WalkO: 0.55, WalkU: 0.82, WalkF: 0.92, Walk: kind === 'kid' ? 1.12 : 1 })[walkOf(kind)]
