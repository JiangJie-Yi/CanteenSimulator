// The cook table and its hearth on the floor plan, kept clear of anyone standing in them (the owner's, 2026-11-10: a member of the staff
// stood in the 囲炉裏 and its salt bed, only his head showing over its edge; the ways and spots alone hadn't kept them out). Pure: the shop
// gives each figure's feet, in the table's own frame (along it, across it), and puts them where this says, the last thing before the frame
// is drawn, after everything that moves them (their ways, their spots, their giving way to one another).

/** an oblong on the floor plan: along from–to, lay (across) from–to */
export type Oblong = { along: readonly [number, number]; lay: readonly [number, number] }

/** the cook table's top, the hearth's frame in it (the fire, its bed), the owner's notch in its front and the third cook's bay at its end */
export type HearthZones = { table: Oblong; pit: Oblong; notch: Oblong; bay: Oblong }

/** who: the owner (his notch his), the third cook (his bay his), anyone else */
export type HearthRole = 'owner' | 'sous' | 'other'

/** how far feet are kept from the table's edge (half a body: no one's side is in it) */
export const BODY = 0.25
/** how far from the hearth's frame, for those allowed up to it (the owner in his notch, the third cook in his bay) */
export const PIT_ROOM = 0.18
/** how far in from a notch's or a bay's sides */
export const SLOT_ROOM = 0.12

/** (along, lay) pushed out of an oblong grown by `pad` the nearest way, or null if it's not in it */
function pushOut(al: number, la: number, o: Oblong, pad: number): [number, number] | null {
  const a0 = o.along[0] - pad, a1 = o.along[1] + pad, l0 = o.lay[0] - pad, l1 = o.lay[1] + pad
  if (al <= a0 || al >= a1 || la <= l0 || la >= l1) return null
  const d = [al - a0, a1 - al, la - l0, l1 - la]
  const k = d.indexOf(Math.min(...d))
  return k === 0 ? [a0, la] : k === 1 ? [a1, la] : k === 2 ? [al, l0] : [al, l1]
}

/** where the owner may stand inside the table: his notch, a little in from its sides, his feet no nearer the hearth than its frame's room
 * and his own half */
function ownerSlot(z: HearthZones): Oblong {
  return { along: [z.notch.along[0] + SLOT_ROOM, z.notch.along[1] - SLOT_ROOM], lay: [Math.max(z.notch.lay[0], z.pit.lay[1] + PIT_ROOM + BODY), Infinity] }
}
/** where the third cook may stand inside the table: his bay, a little in from its sides, out past the table's end */
function sousSlot(z: HearthZones): Oblong {
  return { along: [Math.max(z.bay.along[0], z.pit.along[1] + PIT_ROOM + BODY) + SLOT_ROOM, Infinity], lay: [z.bay.lay[0] + SLOT_ROOM, z.bay.lay[1] - SLOT_ROOM] }
}
/** (along, lay) brought into an oblong (the nearest point of it) */
const into = (al: number, la: number, o: Oblong): [number, number] => [Math.min(o.along[1], Math.max(o.along[0], al)), Math.min(o.lay[1], Math.max(o.lay[0], la))]

/**
 * Where someone standing at (along, lay) is put, out of where they mayn't stand: off the table altogether (its edge half a body off), but
 * the owner in his notch and the third cook in his bay, each kept a little in from its sides and clear of the hearth's frame; the nearest way
 * out (or, for those two, into their own place, if that's nearer). As they are if they're clear.
 */
export function keepOut(al: number, la: number, role: HearthRole, z: HearthZones): [number, number] {
  const off = pushOut(al, la, z.table, BODY)
  if (!off) return [al, la]
  if (role === 'other') return off
  const slot = role === 'owner' ? ownerSlot(z) : sousSlot(z)
  const inSlot = into(al, la, slot)
  // (in his own place already, or nearer it than out past the table's edge: there; else out)
  const dIn = Math.hypot(inSlot[0] - al, inSlot[1] - la), dOff = Math.hypot(off[0] - al, off[1] - la)
  return dIn <= dOff ? inSlot : off
}
