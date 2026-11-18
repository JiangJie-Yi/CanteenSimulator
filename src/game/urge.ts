/**
 * Urging one of the staff on (item 348): clicked in the room, 催促. Quicker a while (URGE_PACE for URGE_S), a little less fond of the owner
 * for it (URGE_BOND), and not to be urged again for a while (URGE_COOLDOWN_S): a push when the orders pile up, not a way to run them all
 * faster all night. Times in ms (performance.now()).
 */
export const URGE_PACE = 1.15
export const URGE_S = 45
export const URGE_COOLDOWN_S = 180
export const URGE_BOND = -1
/** whether they can be urged now (the last time `at`, ms; none yet) */
export const urgeOk = (at: number | undefined, now: number) => at === undefined || now - at >= URGE_COOLDOWN_S * 1000
/** their pace for it now */
export const urgePace = (at: number | undefined, now: number) => (at !== undefined && now - at >= 0 && now - at < URGE_S * 1000 ? URGE_PACE : 1)
/** how long till they can be urged again (s; 0 now) */
export const urgeWait = (at: number | undefined, now: number) => (at === undefined ? 0 : Math.max(0, Math.ceil(URGE_COOLDOWN_S - (now - at) / 1000)))
