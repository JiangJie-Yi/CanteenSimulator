import type { ReactNode } from 'react'

// Hand-drawn line icons for the menu strips. 24x24, stroked in currentColor so they ink like the text.
const ICONS: Record<string, ReactNode> = {
  // ---- bases
  hotpot: (
    <>
      <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M2 11h2M20 11h2M9 8c0-1.5 1-1.5 1-3M14 8c0-1.5 1-1.5 1-3" />
    </>
  ),
  beefnoodle: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0z" />
      <path d="M7 11c1-2 2 0 3-2s2 0 3-2M15 4l5 6M17 3l4 6" />
    </>
  ),
  grilledfish: (
    <>
      <path d="M5 12c3-4 9-4 12 0-3 4-9 4-12 0zM17 12l3-3v6z" />
      <path d="M8 21l2-4 2 3 2-3 2 4" />
    </>
  ),
  // ---- hot pot
  NapaCabbage: (
    <>
      <path d="M12 21c-5-3-7-8-6-14 3 0 5 2 6 4 1-2 3-4 6-4 1 6-1 11-6 14z" />
      <path d="M12 21V11M12 15l-3-2M12 17l3-2" />
    </>
  ),
  BeefSlice: (
    <>
      <path d="M3 9c3-2 6 2 9 0s6-2 9 0v6c-3-2-6 2-9 0s-6-2-9 0z" />
      <path d="M6 12c2 1 3-1 5 0M14 13c2-1 3 1 4 0" />
    </>
  ),
  Meatball: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M9 10h.01M14 9h.01M12 14h.01M15 13h.01M9 15h.01" />
    </>
  ),
  Fishball: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M8.5 9.5a4.5 4.5 0 0 1 3-2" />
    </>
  ),
  Tofu: (
    <>
      <path d="M5 9l7-4 7 4v7l-7 4-7-4z" />
      <path d="M5 9l7 4 7-4M12 13v7" />
    </>
  ),
  FriedTofu: (
    <>
      <rect x="5" y="6" width="14" height="12" rx="3" />
      <path d="M9 10h.01M13 9h.01M15 13h.01M10 14h.01" />
    </>
  ),
  Taro: (
    <>
      <path d="M5 9l7-4 7 4v7l-7 4-7-4z" />
      <path d="M8 14l2-3M12 16l3-4M10 18l1-1" />
    </>
  ),
  Corn: (
    <>
      <ellipse cx="12" cy="12" rx="4.5" ry="8" />
      <path d="M7.5 9h9M7.5 12h9M7.5 15h9M12 4v16" />
    </>
  ),
  CrabStick: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="3" />
      <path d="M7 9v6M11 9v6M15 9v6" />
    </>
  ),
  Shrimp: (
    <>
      <path d="M18 8a6 6 0 1 0-1 8" />
      <path d="M17 16l3 1-1 3M9 9l1 2M12 7l.5 2M8 12l2 .5" />
    </>
  ),
  ShiitakeCap: (
    <>
      <path d="M3 13a9 7 0 0 1 18 0z" />
      <path d="M10 13v5a2 2 0 0 0 4 0v-5M9 9l6 2M15 9l-6 2" />
    </>
  ),
  Enoki: (
    <>
      <path d="M8 21l1-14M12 21V6M16 21l-1-14M10 21l.5-12M14 21l-.5-12" />
      <path d="M7.5 6.5h1.5M11.2 5.2h1.6M14.6 6.5h1.5" />
    </>
  ),
  // ---- beef noodle
  BeefShank: (
    <>
      <path d="M5 8c3-3 11-3 14 1s-1 9-7 9-10-6-7-10z" />
      <path d="M9 10c2 1 3 3 2 5M14 9c-1 2 0 4 2 5" />
    </>
  ),
  Tendon: (
    <>
      <path d="M4 12c0-4 6-6 9-4s7 1 7 4-4 5-8 4-8 0-8-4z" />
      <path d="M8 11c2-1 4 0 5 1" />
    </>
  ),
  Tripe: (
    <>
      <path d="M4 7h16v10H4z" />
      <path d="M8 7l-2 3 2 3-2 4M12 7l-2 3 2 3-2 4M16 7l-2 3 2 3-2 4M4 10h16M4 13h16" />
    </>
  ),
  BraisedEgg: (
    <>
      <path d="M4 12a8 7 0 0 0 16 0z" />
      <path d="M4 12h16" />
      <ellipse cx="12" cy="12" rx="3.5" ry="1.4" />
    </>
  ),
  BokChoy: (
    <>
      <path d="M12 21c-4-2-7-7-5-13 3 1 4 4 5 6 1-2 2-5 5-6 2 6-1 11-5 13z" />
      <path d="M10 21h4M12 21v-6" />
    </>
  ),
  PickledGreens: (
    <path d="M5 8h4v3H5zM11 6h4v3h-4zM16 10h3v3h-3zM7 14h4v3H7zM13 13h3v3h-3zM10 19h3v2h-3z" />
  ),
  ExtraNoodles: (
    <>
      <path d="M3 8c2-2 3 2 5 0s3-2 5 0 3 2 5 0 2-1 3 0M3 12c2-2 3 2 5 0s3-2 5 0 3 2 5 0 2-1 3 0M3 16c2-2 3 2 5 0s3-2 5 0 3 2 5 0 2-1 3 0" />
      <path d="M19 3v4M17 5h4" />
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
  GrilledCorn: (
    <>
      <ellipse cx="12" cy="10" rx="3.5" ry="6.5" />
      <path d="M8.5 8h7M8.5 11h7M12 16.5V22M10 6l1 1M13 12l1 1" />
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
}

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const shape = ICONS[name]
  if (!shape) return null
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shape}
    </svg>
  )
}
