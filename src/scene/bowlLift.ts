import type * as THREE from 'three'

/**
 * Bowls taken up off the bar in someone's hands (item 345, the owner's: 「然後喝湯是怎喝?」: the soup sat untouched, going down by itself): each
 * one's place and turn in the world this frame, by its key (`soup:<seat>`), set by the one holding it (FolkFigure) while it's in their hands
 * and dropped once it's down again; read by whatever draws the bowls at the places (SideBowls' SeatBowls), which draws it there instead.
 */
export const BOWL_LIFT = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion }>()
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __bowlLift: BOWL_LIFT })
