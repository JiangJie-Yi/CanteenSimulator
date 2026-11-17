import type { Look, Role } from './staff'

/*
 * How each of the staff looks (item 321, the owner's, 2026-11-18: 「員工的SVG 大頭 需與 模型一致，要好好規劃」): the one list both their
 * picture in the office (ui/Avatar) and their figure in the shop (scene/StaffFigure) draw from, so the two never disagree.
 *
 * What they wear is their job's, as the figures' models are made (blender/boss.py with CREW=<variant>): the cooks at the fire (二廚 and
 * 三廚, a woman too) a white kappōgi under a white tenugui cap; the floor and the till a navy samue with a pale grid in its weave under a
 * white tenugui band, the women a plum kimono with little pale pink flowers, a gold obi and their hair up in a bun; the stock keeper khaki
 * work clothes under the band, his clipboard in hand. What's their own, by a hash of their id (always the same person): their skin, their
 * hair's colour (an older one's grey) and glasses on some. Nothing the one draws that the other hasn't: no moustaches, earrings or
 * thinning hair in the pictures, none of which the figures have.
 */
export type CrewVariant = 'chef' | 'chefF' | 'server' | 'serverF' | 'stock'
/** which of the figures' models a job and a sex is dressed as (the till's the floor's: the same samue or kimono) */
export const variantOf = (role: Role, female: boolean): CrewVariant =>
  role === 'chef' || role === 'sous' ? (female ? 'chefF' : 'chef') : role === 'stock' ? 'stock' : female ? 'serverF' : 'server'

/**
 * Each model's clothes, as its pictures are made in blender/boss.py (its cloth's colour as painted, sRGB): the coat, its collar's wide bands
 * crossed on the chest, the under-collar at the neck (the trousers' cloth), what's on the head (a cap, a band, the hair in a bun), and
 * what's on the cloth (the samue's pale grid, the kimono's flowers and its obi); the stock keeper's clipboard
 */
export type Wear = { coat: string; collar: string; neck: string; head: 'cap' | 'band' | 'bun'; grid?: boolean; flowers?: boolean; obi?: string; clip?: boolean }
export const WEAR: Record<CrewVariant, Wear> = {
  chef: { coat: '#f5f0e6', collar: '#d8cfbd', neck: '#334066', head: 'cap' },
  chefF: { coat: '#f5f0e6', collar: '#d8cfbd', neck: '#334066', head: 'cap' },
  server: { coat: '#334066', collar: '#2a3350', neck: '#2b3659', head: 'band', grid: true },
  serverF: { coat: '#6b243d', collar: '#f4efe2', neck: '#5c1c33', head: 'bun', flowers: true, obi: '#e8c45a' },
  stock: { coat: '#6b704d', collar: '#5a5c40', neck: '#33332e', head: 'band', clip: true },
}
/** the band's and the cap's cloth: white tenugui, a little warm */
export const TENUGUI = '#f2f0e6'

export const SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
export const HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020', '#6b4a32']
/** an older one's hair: a darker grey or a paler */
export const GREY = ['#a9a49c', '#d6d1c8']

/** a person's id made a number, as it always was (the same picture and figure as before) */
export const crewHash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * What's a person's own: their skin, their hair's colour, whether they wear glasses; and the hash, for the rest of a picture's face (brows,
 * eyes, mouth: the figures share one sheet of expressions). Read with unsigned shifts: with signed ones a hash past 2^31 picked no hair
 * colour at all, their picture's hair black and their figure's the model's own brown.
 */
export function featuresOf(id: string, look: Look) {
  const h = crewHash(id)
  const old = look.age === 'old'
  return {
    h,
    skin: SKIN[h % SKIN.length],
    hair: old ? GREY[(h >>> 4) & 1] : HAIR[(h >>> 3) % HAIR.length],
    glasses: (h >>> 7) % 5 === 0 || (old && (h >>> 7) % 2 === 0),
  }
}
