/**
 * How the fire sounds (scene/fireAmbience plays it): the charcoal's crackle grows with how hot it's burning, and the sizzle of fat on the
 * coals with how much food is over them, each piece adding less as more are on (a full fire's sizzle is a roar, not sixteen times one).
 * Both 0..1. No fire, no sound, whatever's on it.
 */
export function fireSound(fire: number, onFire: number) {
  const heat = Math.max(0, Math.min(1, fire))
  if (heat <= 0.02) return { crackle: 0, sizzle: 0 }
  const crackle = 0.15 + 0.85 * heat
  const food = 1 - Math.exp(-Math.max(0, onFire) / 3)
  const sizzle = food * (0.35 + 0.65 * heat)
  return { crackle, sizzle }
}
