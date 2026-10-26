import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Hand-drawn line icons for the menu strips. 24x24, stroked in currentColor so they ink like the text.
const ICONS: Record<string, ReactNode> = {
  // ---- bases
  grilledfish: (
    <>
      <path d="M5 12c3-4 9-4 12 0-3 4-9 4-12 0zM17 12l3-3v6z" />
      <path d="M8 21l2-4 2 3 2-3 2 4" />
    </>
  ),
  // ---- grilled fish
  ExtraFish: (
    <>
      <path d="M3 12c3-4 9-4 12 0-3 4-9 4-12 0zM15 12l3-3v6z" />
      <path d="M7 11h.01M20 4v4M18 6h4" />
    </>
  ),
  Saury: (
    <>
      <path d="M2 12c4-2.5 12-2.5 16 0-4 2.5-12 2.5-16 0zM18 12l4-3-1.5 3 1.5 3z" />
      <path d="M5 11.5h.01M8 12h8" />
    </>
  ),
  Mackerel: (
    <>
      <path d="M3 12c3-4 10-4 14 0-4 4-11 4-14 0zM17 12l4-3.5-1.5 3.5 1.5 3.5z" />
      <path d="M8 9.5l1.5 2M11 9.5l1.5 2M14 10l1 1.5M6 11.5h.01" />
    </>
  ),
  Yakitori: (
    <>
      <path d="M12 2v20" />
      <rect x="9" y="4" width="6" height="4" rx="1.5" />
      <rect x="9.5" y="9" width="5" height="2.5" rx="1" />
      <rect x="9" y="12.5" width="6" height="4" rx="1.5" />
    </>
  ),
  PorkBelly: (
    <>
      <path d="M12 2v20" />
      <path d="M8 5h8v3H8zM8 10h8v3H8zM8 15h8v3H8zM8 6.5h8M8 11.5h8M8 16.5h8" />
    </>
  ),
  Squid: (
    <>
      <path d="M12 2l4 4v8a4 4 0 0 1-8 0V6z" />
      <path d="M9 18l-1 4M11 18.5v3.5M13 18.5v3.5M15 18l1 4M10 9h.01M14 9h.01" />
    </>
  ),
  Shishito: (
    <>
      <path d="M7 6c1 5 3 11 10 14-1-6-3-11-7-14z" />
      <path d="M8 6l-2-3" />
    </>
  ),
  Mochi: (
    <>
      <path d="M12 2v20" />
      <rect x="7" y="4" width="10" height="6" rx="2" />
      <rect x="7" y="12" width="10" height="6" rx="2" />
    </>
  ),
  NetMochi: (
    <>
      <path d="M3 17h18M3 20h18M6 15v7M10 15v7M14 15v7M18 15v7" />
      <path d="M6 14c0-4 2-5 3-5 1-3 5-3 6 0 2 0 3 2 3 5z" />
    </>
  ),
  KingOyster: (
    <>
      <path d="M12 2v20" />
      <ellipse cx="12" cy="7" rx="5" ry="2.5" />
      <ellipse cx="12" cy="13" rx="5" ry="2.5" />
      <path d="M9 6l6 2M9 12l6 2" />
    </>
  ),
  Okra: (
    <>
      <path d="M12 2v20" />
      <path d="M8 5l8 0M9 5c0 4 2 7 3 9 1-2 3-5 3-9M8 13h8M9 13c0 3 2 5 3 7 1-2 3-4 3-7" />
    </>
  ),
  Scallop: (
    <>
      <path d="M12 2v20" />
      <rect x="7" y="4" width="10" height="5" rx="2.5" />
      <rect x="7" y="11" width="10" height="5" rx="2.5" />
    </>
  ),
  Asparagus: (
    <>
      <path d="M3 9h18M3 15h18" />
      <path d="M7 21V6l1-3 1 3v15M12 21V5l1-3 1 3v16M17 21V6l1-3 1 3v15" />
    </>
  ),
  GrilledCorn: (
    <>
      <ellipse cx="12" cy="10" rx="3.5" ry="7.5" />
      <path d="M8.5 7h7M8.5 10h7M8.5 13h7M10 5l1 1M13 11l1 1" />
    </>
  ),
  GrilledShiitake: (
    <>
      <path d="M12 2v20" />
      <path d="M7 7a5 3 0 0 1 10 0zM7 13a5 3 0 0 1 10 0z" />
    </>
  ),
  Onigiri: (
    <>
      <path d="M12 3c2 0 8 11 8 14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3c0-3 6-14 8-14z" />
      <path d="M9 20v-4h6v4" />
    </>
  ),
  ShrimpSkewer: (
    <>
      <path d="M12 2v20" />
      <path d="M16 6a4 4 0 1 0 0 5M16 13a4 4 0 1 0 0 5" />
    </>
  ),
  Potato: (
    <>
      <path d="M6 9c1-4 8-5 11-2s3 9-2 11-11 0-9-5c.5-1.5-.5-2.5 0-4z" />
      <path d="M10 10h.01M14 9.5h.01M15 14h.01M10 15h.01" />
    </>
  ),
  SweetPotato: (
    <>
      <path d="M3 15c2-6 10-10 16-8 2 1 2 3 0 5-4 4-11 6-16 3z" />
      <path d="M19 7l2-2M8 13c2-1 4-2 6-2" />
    </>
  ),
  Sausage: (
    <>
      <path d="M12 22V2" />
      <rect x="8.5" y="5" width="7" height="12" rx="3.5" />
      <path d="M9 8l6 2M9 11l6 2M9 14l6 2" />
    </>
  ),
  // ---- grilled-fish sets: each its own fish over the same bowl of rice, so the three tell apart at a glance
  'set-ayu': (
    <>
      <path d="M3 8c2-3.5 5-3.5 7.5 0s5.5 3.5 7.5 0M3 8c2 2 5 2.5 7.5 0M10.5 8c2.5-2.5 5.5-2 7.5 0" />
      <path d="M18 8l3-2.5v5zM5 7.2h.01" />
      <path d="M5 15h14a7 7 0 0 1-14 0zM7.5 15c1-2 8-2 9 0" />
    </>
  ),
  'set-saury': (
    <>
      <path d="M2 8c5-2.2 13-2.2 17 0-4 2.2-12 2.2-17 0zM19 8l3-2.2-1 2.2 1 2.2z" />
      <path d="M4.5 7.6h.01M7 8h9" />
      <path d="M5 15h14a7 7 0 0 1-14 0zM7.5 15c1-2 8-2 9 0" />
    </>
  ),
  'set-mackerel': (
    <>
      <path d="M3 4.5h13c3.5 0 4.5 3.5 2 5.5H3z" />
      <path d="M6 5l1.5 4.5M9.5 5l1.5 4.5M13 5l1.5 4.5" />
      <path d="M5 15h14a7 7 0 0 1-14 0zM7.5 15c1-2 8-2 9 0" />
    </>
  ),
  // ---- more of the grill: the other fish, whole or as fillets, the sets, and the table's soup and sake
  Aji: (
    <>
      <path d="M3 12c3-3.5 10-3.5 14 0-4 3.5-11 3.5-14 0zM17 12l4-3.5-1.5 3.5 1.5 3.5z" />
      <path d="M6 11.5h.01M8 12.5c3 .6 6 .6 9-.5M9 10l1 1 1-1 1 1 1-1 1 1" />
    </>
  ),
  Iwashi: (
    <>
      <path d="M3 12c3-3 9-3 13 0-4 3-10 3-13 0zM16 12l4-3-1.2 3 1.2 3z" />
      <path d="M5.5 11.5h.01M8 12.4h.01M10 12.6h.01M12 12.5h.01M14 12.3h.01" />
    </>
  ),
  Shishamo: (
    <>
      <path d="M3 9c2.5-2 7-2 10 0-3 2-7.5 2-10 0zM13 9l3-2v4z" />
      <path d="M6 15c2.5-2 7-2 10 0-3 2-7.5 2-10 0zM16 15l3-2v4z" />
      <path d="M5 9h.01M8 15h.01M8 10.2c1.5.6 3 .6 4 0M11 16.2c1.5.6 3 .6 4 0" />
    </>
  ),
  Salmon: (
    <>
      <path d="M4 15c2-6 9-9 16-8-1 6-7 10-16 8z" />
      <path d="M7 14c2-1 3-3 4-5M10 14c2-1 4-3 5-6M14 13c1.5-1 3-3 3.5-5" />
    </>
  ),
  Hokke: (
    <>
      <path d="M12 4c4 0 7 4 7 8s-3 8-7 8-7-4-7-8 3-8 7-8z" />
      <path d="M12 4v16M12 8l-3 1.5M12 11l-3.5 1.5M12 14l-3 1.5M12 8l3 1.5M12 11l3.5 1.5M12 14l3 1.5" />
    </>
  ),
  Buri: (
    <>
      <path d="M3 14c1-5 7-8 18-7-1 6-8 10-18 7z" />
      <path d="M17 7.6c-1 3-3 5.5-6 7.2" strokeWidth="2.4" />
      <path d="M6 13.5c3 0 6-1 8-3" />
    </>
  ),
  Gindara: (
    <>
      <rect x="4" y="7" width="16" height="10" rx="3" />
      <path d="M8 7c1 3 1 7 0 10M12 7c1 3 1 7 0 10M16 7c1 3 1 7 0 10" />
    </>
  ),
  Nodoguro: (
    <>
      <path d="M3 12c3-5 11-5 14 0-3 5-11 5-14 0zM17 12l4-4-1 4 1 4z" />
      <path d="M6 11h.01M5 13.5c1 1.5 2.5 2 3.5 1.5M9 8.5l2-2 2 2" />
    </>
  ),
  BloodCake: (
    <>
      <path d="M12 2v20" />
      <rect x="8" y="6" width="8" height="10" rx="1.5" />
      <path d="M9.5 9h.01M12 8.5h.01M14.5 9.5h.01M10 12h.01M13 12.5h.01M11 14.5h.01M14.5 14h.01" />
    </>
  ),
  MisoSoup: (
    <>
      <path d="M3 12h18a9 7 0 0 1-18 0z" />
      <path d="M8 18.5h8v2H8zM7 14.5h2v2H7zM12 15h.01M15 14h2v2h-2zM9 9c0-1.5 1-1.5 1-3M14 9c0-1.5 1-1.5 1-3" />
    </>
  ),
  Sake: (
    <>
      <path d="M9 3h4v2c0 1.5 3 3 3 7v6a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-6c0-4 3-5.5 3-7z" transform="translate(-2 0)" />
      <path d="M6 12h8" />
      <path d="M16 16h5l-.7 3.5a1 1 0 0 1-1 .8h-1.6a1 1 0 0 1-1-.8z" />
    </>
  ),
  setMeal: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M5 12c1.5-2 4.5-2 6 0-1.5 2-4.5 2-6 0zM11 12l1.5-1.2v2.4z" />
      <path d="M14 15.5h6a3 3 0 0 1-6 0zM15.5 9.5h3a1.5 1.5 0 0 1-3 0z" />
    </>
  ),
  Rice: (
    <>
      <path d="M4 12h16a8 7 0 0 1-16 0z" />
      <path d="M5 12c0-3 3-5 7-5s7 2 7 5M8 10h.01M11 9h.01M14 9.5h.01M16 10.5h.01M9.5 19h5" />
    </>
  ),

}

export const hasIcon = (name: string) => name in ICONS
/** each drawing's own square around what's drawn (measured once), so every icon fills its box the same */
const FRAMES = new Map<string, { view: string; side: number }>()

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const shape = ICONS[name]
  const g = useRef<SVGGElement>(null)
  const [frame, setFrame] = useState(() => FRAMES.get(name) ?? { view: '0 0 24 24', side: 24 })
  useLayoutEffect(() => {
    const known = FRAMES.get(name)
    if (known) {
      setFrame(known)
      return
    }
    const b = g.current?.getBBox()
    if (!b || !b.width || !b.height) return
    // (a margin for the stroke: small drawings are scaled up and large ones down, to the same size)
    const side = Math.max(b.width, b.height) * 1.12 + 2
    const f = { view: `${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}`, side }
    FRAMES.set(name, f)
    setFrame(f)
  }, [name])
  if (!shape) return null
  return (
    // (the line stays as thick on screen however much the drawing was scaled)
    <svg className="icon" width={size} height={size} viewBox={frame.view} fill="none" stroke="currentColor"
      strokeWidth={1.6 * (frame.side / 24)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g ref={g}>{shape}</g>
    </svg>
  )
}

/** The drawing for something on a menu: its own if it has one; a set's (set-<id>), else a set meal; last the shop's own. */
export function iconFor(shop: string, x: { id: string; name?: string; icon?: string }, base: boolean) {
  const own = x.icon ?? x.id
  if (hasIcon(own)) return own
  if (base) return hasIcon(`set-${x.id}`) ? `set-${x.id}` : 'setMeal'
  return hasIcon(shop) ? shop : 'grilledfish'
}
