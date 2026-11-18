// What a customer's plate says when pointed at (item 279, the owner's, 2026-11-17: 「這兩hover也得有提示」, a plate left with its bones
// and sticks, and a clean round plate): its name, and where it is in its round: whose, being eaten off or done with (what's left on it),
// whom it waits for. Pure: GuestBar3D asks it as the pointer comes onto a plate; ui's tip shows it in the page's language (data/tipText).
import type { PlateKind } from './plateSize'

/** where a plate is in its round (GuestBar3D's PlateRun): laid at the plating place with its food, carried to its seat (by a server, or by
 * itself with nobody on the floor), set before its customer, left dirty till a server clears it, on the server's tray, cleared by itself,
 * washed and going back to the racks */
export type PlatePhase = 'ready' | 'serve' | 'carry' | 'set' | 'dirty' | 'taken' | 'clear' | 'home'

/** each of the shop's plates by its name (game/plateSize's kinds) */
export const PLATE_NAME: Record<PlateKind, string> = { long: '長角皿', round: '丸皿', mame: '豆皿' }

/** what's left on a plate done with: the fish's bones, the skewers, the tissue they wiped their mouth with, their emptied drink beside it */
export type PlateLeft = { bones?: number; sticks?: number; tissue?: boolean; drink?: boolean }

/** what's left on it, its pieces between ・ (none: '') */
export function leftOn(p: PlateLeft): string {
  const parts: string[] = []
  if (p.bones) parts.push(`魚骨 ${p.bones} 副`)
  if (p.sticks) parts.push(`竹籤 ${p.sticks} 根`)
  if (p.tissue) parts.push('用過的紙巾')
  if (p.drink) parts.push('喝完的飲料')
  return parts.join('・')
}

/** a plate's state in a line or three (between ｜): whose (its seat, numbered from 1 as the seats' discs are), and what's next for it */
export function plateSays(p: PlateLeft & { phase: PlatePhase; seat: number }): string {
  const n = p.seat + 1
  const lines = (...l: string[]) => l.filter(Boolean).join('｜')
  switch (p.phase) {
    case 'ready': return lines('裝好盤了', `等外場端到 ${n} 號座`)
    case 'serve':
    case 'carry': return `端去 ${n} 號座`
    case 'set': return `${n} 號座的客人在吃`
    case 'dirty': return lines(`${n} 號座吃完了`, leftOn(p), '等外場來收')
    case 'taken': return lines(`${n} 號座的，外場收走了`, leftOn(p), '送去洗')
    case 'clear': return lines(`${n} 號座的，收去洗`, leftOn(p))
    case 'home': return '洗好了，放回碗盤架'
  }
}
