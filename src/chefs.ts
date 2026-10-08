// The chefs who can be put in charge of the grill in the AI simulation. They differ the way real cooks do: how
// quickly they get round the fire, when they judge a piece done, whether they remember to season it, and what
// they're paid.

export type Chef = {
  id: string
  zh: string
  ja: string
  /** seconds between one thing and the next at the grill */
  pace: number
  /** how far past done (1 = just done) they take a piece off */
  pullAt: number
  /** how often they season a piece with what suits it */
  seasonChance: number
  /** NT$ an hour */
  wagePerHour: number
}

export const CHEFS: Chef[] = [
  { id: 'rookie', zh: '阿明・學徒', ja: 'アキラ・見習い', pace: 1.6, pullAt: 1.2, seasonChance: 0.45, wagePerHour: 183 },
  { id: 'veteran', zh: '老陳・師傅', ja: '陳さん・板前', pace: 0.8, pullAt: 1.05, seasonChance: 1, wagePerHour: 260 },
  { id: 'master', zh: '山田・大將', ja: '山田・大将', pace: 0.45, pullAt: 1.0, seasonChance: 1, wagePerHour: 420 },
]
