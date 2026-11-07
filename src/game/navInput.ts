// How a wheel event moves the view in developer mode (the owner's: a Mac's trackpad and two-button mouse, no middle button): a pinch zooms, a
// two-finger slide on a trackpad pans, a mouse's wheel zooms. And whether the machine's a Mac, for the hotkeys' words.

/** what a wheel event is for: a pinch (the browser sends it as a wheel with Ctrl held) or a mouse's wheel zooms; a trackpad's two-finger
 * slide pans. A mouse's notches come in whole steps of 120 (`wheelDeltaY`) and only up and down; a trackpad's in small steps, or sideways */
export function wheelIntent(e: { ctrlKey: boolean; deltaX: number; deltaY: number; deltaMode: number; wheelDeltaY?: number }): 'zoom' | 'pinch' | 'pan' {
  if (e.ctrlKey) return 'pinch'
  if (e.deltaMode !== 0) return 'zoom'
  if (e.deltaX !== 0) return 'pan'
  if (e.wheelDeltaY !== undefined && e.wheelDeltaY !== 0 && e.wheelDeltaY % 120 !== 0) return 'pan'
  return 'zoom'
}

/** a Mac (its platform's name, or what the browser says of itself) */
export const isMac = (platform: string, userAgent = '') => /Mac|iPhone|iPad/i.test(platform) || (!platform && /Macintosh/i.test(userAgent))
