/**
 * How fast the game runs (1, or 2 with the ×2 button; 0 while it's paused: developer mode during business, the owner's): the 3D scene's
 * clock (FramePacer) and the shop's own timers all go this many times faster, or stand still.
 */
export const GAME_SPEED = { value: 1 }
/** whether the game's standing still just now */
export const paused = () => GAME_SPEED.value === 0
