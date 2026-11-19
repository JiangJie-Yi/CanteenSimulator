/**
 * How each of the staff feels just now, and what of it shows (item 381, the owner's, 2026-11-19: 「員工也得有情緒」, after items 183, 347 and
 * 368: their faces changed, but only for a few seconds after a word of praise or a cut, and a face is a few pixels across from where the
 * game's watched; the customers grow cross and steam, the staff never showed a thing). Pure: the figure asks it each frame (scene/
 * StaffFigure) with what the shop knows of them, and draws what it says: an emote over their head, their bearing, their face.
 *
 * What they feel comes from what's already there: how hard pressed the shop is (the customers waiting for their food, and how near the end of
 * their patience: CREW_LOAD), whether they're worn out, what's just been said or done to them (a word of praise, a raise or a cut, a word with
 * a colleague: CREW_MOOD; urged on: URGED), a customer's complaint (RUSH), and how they get on with the owner and the rest (their bond, the
 * shop's atmosphere). One thing shows at a time, the most pressing first:
 *
 * - alarm (a customer's just complained, or they've been startled): a "!" over them
 * - anger (a cut, a curt word with a colleague, or cold with the owner and pressed hard): the anger mark, steam off the top
 * - shy (praised): blush lines; happy, proud (a raise, the staff meal, a good word with a friend): sparkles, a spring in their step
 * - gloom (worn out): the gloom lines over them, their shoulders down, slower
 * - sweat (the shop hard pressed, or just urged on): sweat flying off them, leaning into it, quicker
 * - note (getting on well and not pressed): now and then humming, a note over them
 * - a sigh (cold with the owner, not pressed): now and then the gloom lines, a moment
 */

export type CrewEmote = 'none' | 'alarm' | 'anger' | 'shy' | 'sparkle' | 'gloom' | 'sweat' | 'note'

export type CrewFeel = 'shy' | 'happy' | 'mad' | 'proud' | 'surprised'

export type CrewMoodIn = {
  /** the time (ms, as performance.now) */
  now: number
  /** worn out (data/staff's isTired: STAFF_TIRED) */
  tired: boolean
  /** how hard pressed the shop is for them (0..1: CREW_LOAD) */
  load: number
  /** their bond with the owner (0..100), and the shop's atmosphere (0..100) */
  bond: number
  atmos: number
  /** when a customer last complained of the wait (ms: RUSH.at) */
  rushAt: number
  /** when they were last urged on (ms: URGED), if ever */
  urgedAt?: number
  /** a feeling put on them a while (CREW_MOOD): what, and till when (ms) */
  feel?: { face: CrewFeel; until: number }
}

/** what they carry from one frame to the next: whether they're feeling pressed (and since when the load's been up), their next hum or sigh */
export type CrewMoodState = { loadSince: number; pressed: boolean; nextAt: number; spellUntil: number; spell: 'none' | 'note' | 'gloom' }

export const newCrewMood = (now: number, seed: number): CrewMoodState => ({ loadSince: -1, pressed: false, nextAt: now + spellGap(seed, 0), spellUntil: 0, spell: 'none' })

/** what shows, how strongly (0..1), and their bearing: `slump` (shoulders down, slower), `bounce` (a spring in their step), `hurry` (leaning in,
 * quicker) */
export type CrewMoodOut = { emote: CrewEmote; level: number; slump: number; bounce: number; hurry: number }

/** the load from which they feel pressed (held this long, ms), and below which it passes: a gap between, so it doesn't flicker on and off.
 * Measured (tests/e2e/_load381.mjs, an evening at x2, busy or as usual): five to eight are always waiting for their food (a grilled fish
 * takes its time), the most impatient a fifth to nearly half way through their patience; pressed from about two fifths of it, a little before
 * the customers themselves start to show it (their anger mark from 0.55, item 347) */
export const PRESS_ON = 0.55
export const PRESS_OFF = 0.4
export const PRESS_HOLD = 1500
/** how long a customer's complaint startles them (ms); how long after being urged they hurry (ms) */
export const ALARM_MS = 1600
export const URGE_MS = 6000
/** bonds (0..100): from this, getting on well (humming now and then, with the atmosphere as warm: friendly and up, game/affinity's bands);
 * below this, cold (a sigh now and then) */
export const WARM_BOND = 60
export const COLD_BOND = 25
/** a hum's or a sigh's length (ms), and the time between them: 12 to 26 s, each their own */
export const SPELL_MS = 2600
const spellGap = (seed: number, n: number) => 12000 + 14000 * frac(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453)
const frac = (x: number) => x - Math.floor(x)

/** the shop's load from its waiting customers (CREW_LOAD): the most impatient one's patience used (0..1, item 347's FUMING; from a tenth of it
 * to seven tenths, the most of it), and a little how many are waiting for their food (eight or more, all of the rest: some are always waiting
 * at a grill, so it counts for little) */
export function loadOf(patienceUsed: readonly number[]) {
  const waiting = patienceUsed.filter((v) => v > 0)
  if (!waiting.length) return 0
  const top = Math.max(...waiting)
  return Math.min(1, 0.75 * Math.min(1, Math.max(0, (top - 0.1) / 0.6)) + 0.25 * Math.min(1, waiting.length / 8))
}

export function crewMood(s: CrewMoodState, i: CrewMoodIn, seed: number): CrewMoodOut {
  const { now } = i
  // (pressed: the load up past PRESS_ON a moment; it passes once it's down under PRESS_OFF)
  if (i.load >= PRESS_ON) { if (s.loadSince < 0) s.loadSince = now } else s.loadSince = -1
  if (!s.pressed && s.loadSince >= 0 && now - s.loadSince >= PRESS_HOLD) s.pressed = true
  if (s.pressed && i.load < PRESS_OFF) s.pressed = false
  const urged = i.urgedAt !== undefined && now - i.urgedAt < URGE_MS
  const feel = i.feel && i.feel.until > now ? i.feel : undefined
  const left = feel ? Math.min(1, (feel.until - now) / 1200) : 0
  // (now and then, not pressed and not worn out: a hum (getting on well) or a sigh (cold with the owner))
  const warm = i.bond >= WARM_BOND && i.atmos >= 50
  const cold = i.bond < COLD_BOND
  if (s.spell !== 'none' && now >= s.spellUntil) s.spell = 'none'
  if (now >= s.nextAt) {
    s.nextAt = now + spellGap(seed, now / 1000)
    if (!s.pressed && !i.tired && !urged && (warm || cold)) { s.spell = warm ? 'note' : 'gloom'; s.spellUntil = now + SPELL_MS }
  }
  if (s.pressed || i.tired || urged) s.spell = 'none'

  const out: CrewMoodOut = { emote: 'none', level: 0, slump: i.tired ? 1 : 0, bounce: 0, hurry: s.pressed || urged ? 1 : 0 }
  if (now - i.rushAt < ALARM_MS || feel?.face === 'surprised') return { ...out, emote: 'alarm', level: 1 }
  if (feel?.face === 'mad') return { ...out, emote: 'anger', level: Math.max(0.6, left) }
  // (cold with the owner and pressed hard: cross with it, the anger mark, a little)
  if (cold && s.pressed && i.load >= 0.8) return { ...out, emote: 'anger', level: 0.6 }
  if (feel?.face === 'shy') return { ...out, emote: 'shy', level: Math.max(0.6, left), bounce: 0.5 }
  if (feel?.face === 'happy' || feel?.face === 'proud') return { ...out, emote: 'sparkle', level: Math.max(0.6, left), bounce: 1 }
  if (i.tired) return { ...out, emote: 'gloom', level: 1 }
  if (s.pressed || urged) return { ...out, emote: 'sweat', level: s.pressed ? Math.min(1, 0.5 + i.load * 0.5) : 0.6 }
  if (s.spell === 'note') return { ...out, emote: 'note', level: 1, bounce: 0.6 }
  if (s.spell === 'gloom') return { ...out, emote: 'gloom', level: 0.5, slump: 0.4 }
  return out
}
