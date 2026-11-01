// Going on after the 3D view is lost: the game's state is kept the moment it happens, and a page brought back reads it once and carries on
// from there (an ordinary reload, with nothing kept, starts over as always).

/** the kept state's version: one written by another version of the game isn't read */
export const RESUME_VERSION = 1
/** how long what's kept is good for (ms): a page come back to much later starts over */
export const RESUME_MAX_AGE = 10 * 60 * 1000

/** the state, as kept: stamped with the version and the time */
export const keptForResume = <T extends object>(state: T, now: number) => JSON.stringify({ ...state, v: RESUME_VERSION, at: now })

/** what to go on from: the kept state if it's there, of this version and recent enough; otherwise null (start over) */
export function resumeFrom<T extends object>(raw: string | null, now: number): (T & { v: number; at: number }) | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as T & { v?: number; at?: number }
    if (!s || typeof s !== 'object' || s.v !== RESUME_VERSION || typeof s.at !== 'number') return null
    if (now - s.at > RESUME_MAX_AGE || now < s.at) return null
    return s as T & { v: number; at: number }
  } catch {
    return null
  }
}
