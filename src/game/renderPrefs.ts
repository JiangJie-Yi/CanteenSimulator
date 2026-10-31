/*
 * How a piece of the shop is drawn, set piece by piece in developer mode (shops/grill/renderPrefs.ts applies it): its shading smooth or
 * flat, its material as it was made, toon, real (lit as a real surface) or unlit, its ink outline on or off, and whether it casts and
 * takes shadows. Only what's been changed from how the piece was made is kept; a piece set back to all of that has no setting at all.
 */
export type Shade = 'smooth' | 'flat'
export type Look = 'keep' | 'toon' | 'real' | 'unlit'
export type RenderPref = { shade?: Shade; look?: Look; ink?: boolean; cast?: boolean; receive?: boolean }
export type RenderPrefs = Record<string, RenderPref>

/** how each setting is when it's not been changed */
export const RENDER_DEFAULT: Required<RenderPref> = { shade: 'smooth', look: 'keep', ink: true, cast: true, receive: true }
const DEFAULT = RENDER_DEFAULT
const KEYS = Object.keys(DEFAULT) as (keyof RenderPref)[]

/** what's been set for a piece (nothing for one left as it was made) */
export const prefOf = (prefs: RenderPrefs, id: string): RenderPref => prefs[id] ?? {}

/** a piece's settings changed by `patch`: anything set back to how it was made dropped, and the piece dropped once nothing's left */
export function setPref(prefs: RenderPrefs, id: string, patch: RenderPref): RenderPrefs {
  const next: RenderPref = { ...prefOf(prefs, id), ...patch }
  for (const k of KEYS) if (next[k] === undefined || next[k] === DEFAULT[k]) delete next[k]
  const out = { ...prefs }
  if (Object.keys(next).length) out[id] = next
  else delete out[id]
  return out
}

/** a piece set back to how it was made */
export function clearPref(prefs: RenderPrefs, id: string): RenderPrefs {
  const out = { ...prefs }
  delete out[id]
  return out
}

/** a short text that changes whenever the settings do (empty for none): to tell whether a mesh is drawn as it's set now */
export const sigOf = (p: RenderPref) => KEYS.filter((k) => p[k] !== undefined).map((k) => `${k}:${p[k]}`).join(',')

export const writePrefs = (prefs: RenderPrefs) => JSON.stringify(prefs)

/** the settings as stored, anything that isn't one of them left out */
export function readPrefs(text: string | null): RenderPrefs {
  let raw: unknown
  try { raw = JSON.parse(text ?? '{}') } catch { return {} }
  if (!raw || typeof raw !== 'object') return {}
  const out: RenderPrefs = {}
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const src = v as Record<string, unknown>
    const p: RenderPref = {}
    if (src.shade === 'smooth' || src.shade === 'flat') p.shade = src.shade
    if (src.look === 'keep' || src.look === 'toon' || src.look === 'real' || src.look === 'unlit') p.look = src.look
    for (const k of ['ink', 'cast', 'receive'] as const) if (typeof src[k] === 'boolean') p[k] = src[k] as boolean
    const clean = setPref({}, id, p)[id]
    if (clean) out[id] = clean
  }
  return out
}
