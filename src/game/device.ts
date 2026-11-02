// How the shop is drawn on this device (the owner's): on the web in 3D, its full models only; on a phone, known by its size or by what the
// browser says it is, flat in 2D. A tablet is a web page like any other: 3D. Pure: the app gives it the window's size and the browser's word.

/** a phone's size (css px): narrower than this held upright, or lower than this turned on its side */
export const PHONE_WIDTH = 600
export const PHONE_HEIGHT = 500

/**
 * Whether the browser says it's on a phone: its own word where it gives one (`hint`: Chromium's userAgentData.mobile), else what it calls
 * itself (an iPhone or iPod, an Android phone (an Android tablet leaves out "Mobile"), Windows Phone, Opera Mini); an iPad calls itself a Mac.
 */
export function phoneDevice(ua: string, hint?: boolean): boolean {
  if (typeof hint === 'boolean') return hint
  return /iPhone|iPod|Windows Phone|IEMobile|Opera Mini|Android.*Mobile/i.test(ua)
}

/** drawn flat, in 2D: a phone, by its size or by its word; anything else (a computer, a tablet) in 3D */
export const showsFlat = (s: { width: number; height: number; mobile: boolean }) =>
  s.mobile || s.width < PHONE_WIDTH || s.height < PHONE_HEIGHT
