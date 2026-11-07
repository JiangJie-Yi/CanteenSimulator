// The pictures the game paints itself (the floor's boards, the lamps' paper, the window's view, the signs...) kept in the computer's own
// memory, not the graphics card's (the owner's Mac: after its GPU process restarted, the floor, the lamps and the round window came up black).
// A canvas the browser keeps on the GPU is emptied when the GPU process goes down; one painted once at the start and uploaded again after the
// 3D view comes back gives black. Asked for with `willReadFrequently`, the browser keeps it in plain memory, and it survives. They're painted
// once (or on a font's arrival, or the day's turning), so drawing them without the GPU costs nothing to speak of.
if (typeof HTMLCanvasElement !== 'undefined') {
  const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, opts?: unknown) => RenderingContext | null
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, opts?: unknown) {
    if (id === '2d') return getContext.call(this, id, { willReadFrequently: true, ...(opts as object | undefined) })
    return getContext.call(this, id, opts)
  } as typeof HTMLCanvasElement.prototype.getContext
}
export {}
