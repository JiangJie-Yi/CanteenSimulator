/**
 * A reviewer's profile picture, as a map app's reviews have them (the owner's: the reviews' faces made profile pictures, like Google Maps'):
 * made up from the reviewer's id, so it's always theirs, and as various as people's are. Some put up no picture at all (a coloured disc
 * with the first letter of their name, or the plain grey figure), some their pet (a cat or a dog of some coat, a shiba, a corgi, a rabbit,
 * a hamster, a budgie, a goldfish), some a view they took (Fuji, a sunset over the sea, cherry blossom, a city by night, mountains, the
 * torii in the sea, a temple in autumn leaves, a beach), some a selfie (their hair, glasses now and then, a peace sign now and then), each
 * framed as a photo is, turned and closer or further a little.
 */

export type AvatarKind = 'letter' | 'blank' | 'pet' | 'scene' | 'selfie'
export const PETS = ['cat', 'dog', 'shiba', 'corgi', 'rabbit', 'hamster', 'budgie', 'goldfish'] as const
export type Pet = (typeof PETS)[number]
export const SCENES = ['fuji', 'sunset', 'sakura', 'cityNight', 'mountains', 'torii', 'autumn', 'beach'] as const
export type Scene = (typeof SCENES)[number]

export type AvatarSpec =
  /** no picture: a disc of one of a few colours, the name's first letter on it */
  | { kind: 'letter'; bg: string }
  /** no picture and no letter: the grey figure */
  | { kind: 'blank' }
  /** their pet, its coat (`coat`, by the pet's own list), on a ground; turned `tilt` degrees, `zoom` closer */
  | { kind: 'pet'; pet: Pet; coat: number; bg: number; tilt: number; zoom: number }
  /** a view: which, and its time of day (0 day, 1 evening, 2 night where it has one) */
  | { kind: 'scene'; scene: Scene; time: number; tilt: number }
  /** themselves: skin, hair colour and cut, glasses, a peace sign, what they wear, where it was taken, the phone held a little askew */
  | { kind: 'selfie'; skin: number; hair: number; cut: number; glasses: boolean; peace: boolean; shirt: string; place: number; tilt: number }

/** how often each kind turns up */
export const AVATAR_SHARES: Record<AvatarKind, number> = { letter: 0.3, blank: 0.06, pet: 0.26, scene: 0.2, selfie: 0.18 }
/** the letter discs' colours (a map app's own sort: strong, a little muted) */
export const LETTER_BG = ['#5c6bc0', '#26a69a', '#ef6c00', '#8d6e63', '#ec407a', '#7e57c2', '#43a047', '#f4511e', '#00897b', '#3949ab', '#c0ca33', '#6d4c41']
const SHIRTS = ['#3a5a8c', '#c0392b', '#2e7d5b', '#f2f2ee', '#22262e', '#e0a030', '#8e5ca8', '#5f8fb8', '#b5651d', '#d98aa6']
/** how many coats each pet has (ui/ReviewerAvatar draws them) */
export const COATS: Record<Pet, number> = { cat: 6, dog: 4, shiba: 2, corgi: 2, rabbit: 3, hamster: 3, budgie: 3, goldfish: 2 }
/** how many grounds a pet's picture has, and places a selfie's taken in */
export const PET_GROUNDS = 6
export const SELFIE_PLACES = 4

/** a small seeded random (mulberry32): the same seed, the same run of numbers */
export function seeded(seed: number) {
  let a = (seed * 2654435761 + 0x6d2b79f5) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** the picture of the reviewer with this id */
export function avatarOf(id: number): AvatarSpec {
  const r = seeded(id)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length) % xs.length]
  let k = r(), kind: AvatarKind = 'letter'
  for (const [name, share] of Object.entries(AVATAR_SHARES) as [AvatarKind, number][]) {
    if (k < share) { kind = name; break }
    k -= share
  }
  const tilt = Math.round((r() - 0.5) * 24)
  if (kind === 'letter') return { kind, bg: pick(LETTER_BG) }
  if (kind === 'blank') return { kind }
  if (kind === 'pet') {
    const pet = pick(PETS)
    return { kind, pet, coat: Math.floor(r() * COATS[pet]), bg: Math.floor(r() * PET_GROUNDS), tilt, zoom: Math.round((0.92 + r() * 0.22) * 100) / 100 }
  }
  if (kind === 'scene') {
    const scene = pick(SCENES)
    return { kind, scene, time: Math.floor(r() * 3), tilt: Math.round(tilt / 4) }
  }
  return { kind, skin: Math.floor(r() * 5), hair: Math.floor(r() * 7), cut: Math.floor(r() * 6), glasses: r() < 0.22, peace: r() < 0.3,
    shirt: pick(SHIRTS), place: Math.floor(r() * SELFIE_PLACES), tilt }
}

/** the letter on a picture-less one: the name's first letter (a Latin one in capitals) */
export function initialOf(name: string): string {
  const ch = [...name.trim()][0] ?? '?'
  return ch.toUpperCase()
}
