// Shapes of game state shared between the shops, the screens and App.
import type { PlateKind } from './plateSize'

/** an AI customer as App shows them: seated and waiting, eating, or gone (with their rating) */
export type GuestView = { id: number; state: 'waiting' | 'eating' | 'done' | 'angry'; rating: number | null; items: number;
  /** what they've eaten so far (for their stomach) */
  ate: string[]
  /** their stool at the bar, where their plate is set */
  seat?: number
  /** the one they came in with, if they're a couple */
  partner?: number
  /** that one a grown-up and their child, not a couple (item 377: the early evening's pairs) */
  family?: boolean
  /** the plate their order's served on (game/plateSize, item 228): the long one, a round one or a little one */
  plate?: PlateKind }

/** how one try at a food went: how good, how far cooked, what went on it */
/** one try at a dish: how good it was, how done, what went on it — and, at the grill, when each went on — and when */
export type Try = { taste: number; doneness?: number; dabs?: Record<string, number>; steps?: Step[]; dip?: string[]; at: number }
/** a seasoning put on, and at what point of the cooking */
export type Step = { k: string; at: Stage }
/** before it goes on the fire, while it's cooking, just before it's done, or once it's off */
export type Stage = 'before' | 'early' | 'late' | 'after'
export type Notes = Record<string, { name: string; tries: Try[] }>

/** one thing said in the talk with the second chef: by the owner or by him */
export type Talk = { id: number; from: 'me' | 'chef'; text: string }
