// Dishes and their menus. Each item `id` is the object-name prefix in that dish's .glb (see blender/*.py).
export type MenuItem = {
  id: string
  name: string
  price: number
  /** how it appears when ordered: dropped in with a bounce (default) or rising gently out of the soup */
  entrance?: 'drop' | 'float'
}

/** The part of a dish that's always included (soup base, noodles, the fish). Dark strip on the menu. */
export type Base = {
  id: string
  name: string
  price: number
  /** broth surface texture to swap in (blender/hotpot.py writes these to public/textures) */
  broth?: string
  /** model objects (name prefixes) that don't belong with this base, e.g. chilies in a mild soup */
  hide?: string[]
}

/** Lighting tweaks for one dish; anything left out uses the scene defaults in App.tsx. */
export type DishLight = {
  spotPosition?: [number, number, number]
  spotIntensity?: number
  /** strength of the cast shadow on the floor, 0..1 */
  shadowOpacity?: number
  /** blur radius of the spot's shadow edge */
  shadowSoftness?: number
}

export type Dish = {
  id: string
  name: string
  model: string
  /** one is always included; when there are several the menu lets you pick */
  bases: Base[]
  items: MenuItem[]
  defaults: string[]
  /** what's heating it, animated in the web app */
  heat?: 'gas' | 'fire'
  /** shows the 火候 slider (gas stove) */
  heatControl?: boolean
  /** soup surface height for the steam, if it has soup */
  brothY?: number
  steam?: { width: number; height: number }
  /** woodsmoke rising off the fire */
  smoke?: { y: number; width: number; height: number }
  light?: DishLight
  /** things roast over the fire, show their doneness, and can be clicked off onto a plate */
  roast?: Roast
  /** where the camera looks */
  focusY: number
}

export type Roast = {
  /** seconds over the fire until each piece is done (object-name prefix -> seconds); listed pieces roast */
  times: Record<string, number>
  /** label shown on the tag for each roasting piece */
  names: Record<string, string>
  /** pieces without a skewer (they're laid on the plate as they are, not turned flat) */
  loose: string[]
  /** where the serving plate sits, in the dish's own coordinates */
  plate: [number, number, number]
}

/** Doneness stages for roasting, by fraction of the cook time. */
export const ROAST_STAGES = [
  { until: 0.5, label: '生', key: 'raw' },
  { until: 1, label: '半熟', key: 'half' },
  { until: 2.2, label: '熟了', key: 'done' },
  { until: Infinity, label: '焦了', key: 'burnt' },
] as const

const CHILIES = ['DriedChili', 'SichuanPepper']

export const DISHES: Dish[] = [
  {
    id: 'hotpot',
    name: '小火鍋',
    model: '/models/hotpot.glb',
    bases: [
      { id: 'mala', name: '麻辣湯底', price: 120, broth: '/textures/broth-mala.png' },
      { id: 'tomato', name: '番茄湯底', price: 110, broth: '/textures/broth-tomato.png', hide: CHILIES },
      { id: 'kombu', name: '昆布湯底', price: 100, broth: '/textures/broth-kombu.png', hide: CHILIES },
    ],
    items: [
      { id: 'NapaCabbage', name: '白菜', price: 20 },
      { id: 'BeefSlice', name: '牛肉片', price: 60 },
      { id: 'Meatball', name: '貢丸', price: 30 },
      { id: 'Fishball', name: '魚丸', price: 30 },
      { id: 'Tofu', name: '豆腐', price: 20 },
      { id: 'FriedTofu', name: '油豆腐', price: 25 },
      { id: 'Taro', name: '芋頭', price: 25 },
      { id: 'Corn', name: '玉米', price: 20 },
      { id: 'CrabStick', name: '蟹肉棒', price: 35 },
      { id: 'Shrimp', name: '鮮蝦', price: 50 },
      { id: 'ShiitakeCap', name: '香菇', price: 20 },
      { id: 'Enoki', name: '金針菇', price: 20 },
    ],
    defaults: ['NapaCabbage', 'BeefSlice', 'Meatball', 'Tofu', 'Corn'],
    heat: 'gas',
    heatControl: true,
    brothY: 0.81,
    steam: { width: 1.1, height: 1.3 },
    focusY: 0.5,
  },
  {
    id: 'beefnoodle',
    name: '牛肉麵',
    model: '/models/beefnoodle.glb',
    bases: [{ id: 'braised', name: '紅燒湯麵', price: 120 }],
    items: [
      { id: 'BeefShank', name: '牛腱肉', price: 80 },
      { id: 'Tendon', name: '牛筋', price: 50 },
      { id: 'Tripe', name: '牛肚', price: 50 },
      { id: 'BraisedEgg', name: '滷蛋', price: 15 },
      { id: 'BokChoy', name: '青江菜', price: 15 },
      { id: 'PickledGreens', name: '酸菜', price: 10 },
      { id: 'ExtraNoodles', name: '加麵', price: 20, entrance: 'float' },
    ],
    defaults: ['BeefShank', 'BokChoy', 'PickledGreens'],
    brothY: 0.42,
    steam: { width: 0.9, height: 1.1 },
    // lamp from the back-left so the bowl throws a long, soft shadow toward the viewer
    light: { spotPosition: [-2.4, 3.6, -1.0], spotIntensity: 1.6, shadowOpacity: 0.55, shadowSoftness: 14 },
    focusY: 0.3,
  },
  {
    id: 'grilledfish',
    name: '烤魚',
    model: '/models/grilledfish.glb',
    bases: [{ id: 'ayu', name: '鹽烤香魚', price: 180 }],
    items: [
      { id: 'ExtraFish', name: '加一尾', price: 80 },
      { id: 'GrilledCorn', name: '烤玉米', price: 40 },
      { id: 'GrilledShiitake', name: '烤香菇', price: 30 },
      { id: 'Onigiri', name: '烤飯糰', price: 35 },
      { id: 'ShrimpSkewer', name: '烤蝦串', price: 60 },
      { id: 'Sausage', name: '香腸', price: 45 },
      { id: 'Potato', name: '烤馬鈴薯', price: 40 },
      { id: 'SweetPotato', name: '烤地瓜', price: 35 },
    ],
    defaults: ['GrilledCorn', 'Onigiri'],
    heat: 'fire',
    roast: {
      times: { Fish: 40, ExtraFish: 40, GrilledCorn: 30, GrilledShiitake: 20, Onigiri: 25, ShrimpSkewer: 20,
        Sausage: 25, Potato: 55, SweetPotato: 55 },
      names: { Fish: '香魚', ExtraFish: '香魚', GrilledCorn: '玉米', GrilledShiitake: '香菇', Onigiri: '飯糰',
        ShrimpSkewer: '蝦串', Sausage: '香腸', Potato: '馬鈴薯', SweetPotato: '地瓜' },
      loose: ['Potato', 'SweetPotato'],
      // just outside the stones, to the upper right of the fire as the camera sees it
      plate: [0.7, 0.02, -1.75],
    },
    smoke: { y: 0.85, width: 1.0, height: 2.0 },
    focusY: 0.5,
  },
]

const DIGITS = '〇一二三四五六七八九'

/** 25 -> 二十五, 120 -> 一百二十: the way prices are brushed on menu strips. */
export function toChineseNumber(n: number): string {
  if (n === 0) return DIGITS[0]
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  if (hundreds) parts.push(DIGITS[hundreds] + '百')
  if (tens) parts.push((tens === 1 && !hundreds ? '' : DIGITS[tens]) + '十')
  else if (hundreds && ones) parts.push('〇')
  if (ones) parts.push(DIGITS[ones])
  return parts.join('')
}
