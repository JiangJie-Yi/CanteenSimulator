// Every button's press felt as an iPhone's is (item 179, the owner's, 2026-11-16: "the whole interface's smoothness and feedback should be as
// satisfying as using an iPhone"): pressed, it sinks at once, within a frame; let go, it springs back with a little overshoot. A small one
// sinks further than a big one, as a finger covers more of it; a whole card (bigger than a button) doesn't. Done here for every one with the
// page's own animations, not in each button's CSS: most of them carry transitions of their own, which a shared rule can't join (it would
// override them, or go unseen). With reduced motion asked for, a press dims instead of sinking.
import { replaces } from '@/scene/hot'
import { tapSound } from '@/scene/tapSound'

/** what can be pressed */
const PRESSABLE = 'button, [role="button"], a[href], summary, label[for], select, .brand'
/** a spring settling, as the browser's linear() easing: over by about 6%, back, settled in about a third of a second */
const SPRING = 'linear(0, 0.26 7%, 0.68 16%, 0.92 24%, 1.04 32%, 1.065 38%, 1.055 46%, 1.02 57%, 0.996 70%, 1)'
let held: { el: HTMLElement; anim: Animation } | null = null
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** how far it sinks: a small one (a round switch) the most, a wide one the least */
const sinkOf = (r: DOMRect) => (Math.min(r.width, r.height) <= 40 ? 0.88 : r.width < 140 ? 0.93 : 0.965)

function press(e: PointerEvent) {
  if (e.button !== 0) return
  const el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null
  if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return
  letGo()
  const r = el.getBoundingClientRect()
  if (r.width > 440 || r.height > 200) return
  const anim = reduced()
    ? el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(0.86)' }], { duration: 70, fill: 'forwards', easing: 'ease-out' })
    : el.animate([{ scale: '1' }, { scale: String(sinkOf(r)) }], { duration: 80, fill: 'forwards', easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  held = { el, anim }
  // (and heard: a soft tick under the finger (item 320))
  tapSound('ui')
}

function letGo() {
  if (!held) return
  const { el, anim } = held
  held = null
  // (back from where it's got to, not from the bottom: a quick tap springs back from halfway)
  const at = reduced() ? null : getComputedStyle(el).scale
  anim.cancel()
  if (at === null || at === 'none' || at === '1') return
  el.animate([{ scale: at }, { scale: '1' }], { duration: 360, easing: SPRING })
}

if (typeof window !== 'undefined') {
  const opts = { capture: true, passive: true } as const
  window.addEventListener('pointerdown', press, opts)
  window.addEventListener('pointerup', letGo, opts)
  window.addEventListener('pointercancel', letGo, opts)
  window.addEventListener('blur', letGo)
  // (a hot update brings a new copy: the old one's listeners let go of, or every press would sink twice)
  replaces(import.meta.hot, () => {
    window.removeEventListener('pointerdown', press, opts)
    window.removeEventListener('pointerup', letGo, opts)
    window.removeEventListener('pointercancel', letGo, opts)
    window.removeEventListener('blur', letGo)
  })
}
