// Shapes of game state shared between the shops, the screens and App.

/** an AI customer as App shows them: seated and waiting, eating, or gone (with their rating) */
export type GuestView = { id: number; state: 'waiting' | 'eating' | 'done' | 'angry'; rating: number | null; items: number;
  /** what they've eaten so far (for their stomach) */
  ate: string[]
  /** their stool at the bar, where their plate is set */
  seat?: number }

/** how one try at a food went: how good, how far cooked, what went on it */
export type Try = { taste: number; doneness?: number; dabs?: Record<string, number>; dip?: string[]; at: number }
export type Notes = Record<string, { name: string; tries: Try[] }>
