// How much the device can take, decided once at start-up, and what each level turns on.
//
// The real limit on phones is GPU memory, mostly textures (a 1024 px texture takes 4 MB on the GPU however well
// it is compressed in the file), so the levels differ above all in which model is loaded and how big the painted
// textures are:
//   high   — a desktop or a strong tablet: the light model shows first, then the full one is swapped in
//   medium — most phones: the light model only, softer shadows, a lighter canvas
//   low    — old or weak devices: the light model, no shadows, no antialiasing, the lightest canvas
// Every level loads only the dish on screen (the next is loaded when switched to), except high, which keeps all
// three ready. `?q=low|medium|high` forces a level; a dropped WebGL context remembers to start one level lower.

export type Tier = 'low' | 'medium' | 'high'

export type Quality = {
  tier: Tier
  /** max device-pixel ratio for the canvas */
  dpr: number
  shadows: boolean
  shadowSize: number
  antialias: boolean
  /** load the light model (…-lite.glb) */
  lite: boolean
  /** after the light model, swap in the full one once it's loaded (and the dish is idle) */
  upgrade: boolean
  /** the largest painted (canvas) texture */
  canvasMax: number
  /** keep every dish loaded, not just the one on screen */
  allDishes: boolean
}

const KEY = 'canteen-quality'
const ORDER: Tier[] = ['low', 'medium', 'high']

function gpuName(): string {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

function detect(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const touch = window.matchMedia('(hover: none)').matches
  const mem = nav.deviceMemory ?? (touch ? 4 : 8)
  const cores = nav.hardwareConcurrency ?? 4
  const gpu = gpuName()
  // old mobile GPUs and software renderers
  if (/SwiftShader|llvmpipe|Mali-[4T]|Mali-G(31|51|52|57)|Adreno \(TM\) [3-5]\d\d|PowerVR|Adreno \(TM\) 6[0-1]\d/i.test(gpu)) {
    return 'low'
  }
  if (mem <= 3 || cores <= 4) return 'low'
  if (touch) return mem >= 8 && /Adreno \(TM\) (7[3-9]\d|8\d\d)|Apple GPU|Immortalis/i.test(gpu) ? 'high' : 'medium'
  return mem >= 8 ? 'high' : 'medium'
}

function choose(): Tier {
  if (typeof window === 'undefined') return 'high'
  const forced = new URLSearchParams(window.location.search).get('q')
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced
  let tier = detect()
  try {
    // a level that lost its context before is stepped down from
    const capped = localStorage.getItem(KEY) as Tier | null
    if (capped && ORDER.indexOf(capped) < ORDER.indexOf(tier)) tier = capped
  } catch {
    // storage blocked
  }
  return tier
}

const TIER = choose()

export const QUALITY: Quality = {
  high: { tier: 'high', dpr: 2, shadows: true, shadowSize: 2048, antialias: true, lite: true, upgrade: true, canvasMax: 1024,
    allDishes: true },
  medium: { tier: 'medium', dpr: 1.5, shadows: true, shadowSize: 1024, antialias: false, lite: true, upgrade: false,
    canvasMax: 512, allDishes: false },
  low: { tier: 'low', dpr: 1, shadows: false, shadowSize: 512, antialias: false, lite: true, upgrade: false, canvasMax: 512,
    allDishes: false },
}[TIER] as Quality

/** the GPU gave up: start a level lower next time */
export function stepDown() {
  const i = ORDER.indexOf(QUALITY.tier)
  try {
    localStorage.setItem(KEY, ORDER[Math.max(0, i - 1)])
  } catch {
    // storage blocked
  }
}

export const liteUrl = (url: string) => url.replace(/\.glb$/, '-lite.glb')

/** what this browser offers, for the "can't open 3D" notice: so a screenshot of it says what's wrong */
export function webglReport() {
  const probe = (type: string, opts?: WebGLContextAttributes) => {
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext(type, opts) as WebGLRenderingContext | null
      if (!gl) return { ok: false, gpu: '' }
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return { ok: true, gpu }
    } catch {
      return { ok: false, gpu: '' }
    }
  }
  const w2 = probe('webgl2')
  const w2low = probe('webgl2', { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false })
  const w1 = probe('webgl')
  return `WebGL2: ${w2.ok ? 'OK' : '✗'} · WebGL2 省電: ${w2low.ok ? 'OK' : '✗'} · WebGL1: ${w1.ok ? 'OK' : '✗'}` +
    ` · GPU: ${w2.gpu || w2low.gpu || w1.gpu || '—'} · 等級: ${QUALITY.tier}`
}