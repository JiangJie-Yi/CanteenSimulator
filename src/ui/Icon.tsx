import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Hand-drawn line icons for the menu strips. 24x24, stroked in currentColor so they ink like the text.
const ICONS: Record<string, ReactNode> = {
  // ---- the bakery and its doughs
  bakery: (
    <>
      <path d="M4 13a8 5 0 0 1 16 0v5H4z" />
      <path d="M8 10l1 3M12 9v4M16 10l-1 3" />
    </>
  ),
  BriocheDough: (
    <>
      <path d="M4 15a8 6 0 0 1 16 0z" />
      <path d="M7 11l3 3M11 9l4 4M15 9l2 2M9 9l-2 2" />
    </>
  ),
  SourdoughDough: (
    <>
      <path d="M3 16a9 7 0 0 1 18 0z" />
      <path d="M8 11l8 0M9 13.5l6 0M12 9v6" />
    </>
  ),
  CroissantDough: (
    <>
      <path d="M3 15c2-6 6-9 9-9s7 3 9 9c-2 1-4 0-5-2-1 2-2 3-4 3s-3-1-4-3c-1 2-3 3-5 2z" />
      <path d="M9 9l1 5M15 9l-1 5" />
    </>
  ),
  BaguetteDough: (
    <>
      <path d="M4 18c-2-2 10-14 14-14 2 2-10 14-14 14z" />
      <path d="M9 11l2 2M12 8l2 2M6 14l2 2" />
    </>
  ),
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
  // ---- the noodle shop, by the kind of dish (each listed one without its own drawing takes its kind's)
  noodleSoup: (
    <>
      <path d="M3 11h18a9 8 0 0 1-18 0z" />
      <path d="M6 11c1-2 2 0 3-2s2 0 3-2 2 0 3-2M15 3l5 7M17.5 2.5l4 6.5" />
    </>
  ),
  quick: (
    <>
      <path d="M2.5 14h19a2 2 0 0 1-2 3h-15a2 2 0 0 1-2-3z" />
      <path d="M5 14c0-3 3-5 7-5s7 2 7 5M8 12h.01M11 11h.01M14 11.5h.01M10 9c1-1.5 3-1.5 4 0" />
    </>
  ),
  friedRice: (
    <>
      <path d="M2 11h17a8 6 0 0 1-17 0z" />
      <path d="M19 12l3-1.5M5 9h.01M8 8h.01M11 8.5h.01M14 8h.01M7 6l1 1M12 5.5l-1 1M16 9.5h.01" />
    </>
  ),
  friedNoodles: (
    <>
      <path d="M3 15h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
      <path d="M5 14c2-3 3 0 5-3s3 0 5-3 3 0 4 1M6 12c1-1 2 1 4-1" />
    </>
  ),
  vermicelli: (
    <>
      <path d="M3 15h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
      <path d="M5 14c1.5-2 3 1 4.5-1s3 1 4.5-1 3 1 4.5-1M6 12c1.5-2 3 1 4.5-1s3 1 4.5-1M8 10c1.5-2 3 1 4.5-1" />
    </>
  ),
  saucyRice: (
    <>
      <path d="M2.5 14h19a2 2 0 0 1-2 3h-15a2 2 0 0 1-2-3z" />
      <path d="M5 14c0-3 3-5 7-5s7 2 7 5" />
      <path d="M7 13c1-2 3-2 4-1s3 1 4-1 2 0 2 1" strokeWidth="2.2" />
    </>
  ),
  dumplings: (
    <>
      <path d="M3 15c0-4 4-7 9-7s9 3 9 7z" />
      <path d="M6 9.5l1 2M9 8.3l.6 2.2M12 8v2.3M15 8.3l-.6 2.2M18 9.5l-1 2M3 15h18" />
    </>
  ),
  soupDumplings: (
    <>
      <path d="M3 12h18a9 7 0 0 1-18 0z" />
      <path d="M7 12c0-2 2-3.5 3.5-3.5S14 10 14 12M13 12c0-2 1.5-3 3-3s3 1 3 3M9 9.5l.5 1M16 9.5l.3 1" />
    </>
  ),
  xiaolongbao: (
    <>
      <path d="M4 18h16M5 18c0-6 3-11 7-11s7 5 7 11" />
      <path d="M12 7c-.5-1.5.5-3 0-4M9 9l1.5 2M15 9l-1.5 2M7.5 13l2 1M16.5 13l-2 1" />
    </>
  ),
  soup: (
    <>
      <path d="M3 12h18a9 7 0 0 1-18 0z" />
      <path d="M8 19h8M8 9c0-1.5 1-1.5 1-3M12 9c0-1.5 1-1.5 1-3M16 9c0-1.5 1-1.5 1-3" />
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

/**
 * The drawing for something on a menu: its own if it has one; a set's (set-<id>), or at the grill a set meal; at the
 * noodle shop the drawing for its kind of dish (湯麵, 炒飯, 水餃…); failing all that, by what its name says (…麵,
 * …飯, …湯), and last the shop's own.
 */
export function iconFor(shop: string, x: { id: string; name?: string; icon?: string; table?: string }, base: boolean) {
  const own = x.icon ?? x.id
  if (hasIcon(own)) return own
  if (base) return hasIcon(`set-${x.id}`) ? `set-${x.id}` : shop === 'grilledfish' ? 'setMeal' : shop === 'beefnoodle' ? 'noodleSoup' : shop
  if (x.table && hasIcon(x.table)) return x.table
  const n = x.name ?? ''
  if (/米粉/.test(n)) return 'vermicelli'
  if (/炒麵/.test(n)) return 'friedNoodles'
  if (/炒飯/.test(n)) return 'friedRice'
  if (/燴飯/.test(n)) return 'saucyRice'
  if (/湯餃/.test(n)) return 'soupDumplings'
  if (/餃/.test(n)) return 'dumplings'
  if (/麵/.test(n)) return 'noodleSoup'
  if (/飯/.test(n)) return 'quick'
  if (/湯/.test(n)) return 'soup'
  return hasIcon(shop) ? shop : 'grilledfish'
}
