// A phone draws the shop flat, in 2D (game/device; the owner's: the web is 3D, a phone 2D): nothing of the 3D shop is fetched on one. Every
// model and picture the 3D shop preloads as its modules load (useGLTF.preload, useLoader.preload) is let go by when the page opens on a phone
// (they were all fetched, 54 models, for a page that never drew them); should the window grow to a computer's size later, the 3D loads as it's
// drawn. Imported first of all (main.tsx), before any module that preloads.
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { phoneDevice, showsFlat } from '@/game/device'

/** whether the browser says it's a phone: its own word where it gives one, else what it calls itself */
export const MOBILE = typeof navigator !== 'undefined'
  && phoneDevice(navigator.userAgent, (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile)

/** a phone when the page opened: by its size or by its word */
export const FLAT_AT_START = typeof window !== 'undefined' && showsFlat({ width: window.innerWidth, height: window.innerHeight, mobile: MOBILE })

if (FLAT_AT_START) {
  useGLTF.preload = (() => {}) as typeof useGLTF.preload
  useLoader.preload = (() => {}) as typeof useLoader.preload
}
