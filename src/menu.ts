// Dishes and their menus. Each item `id` is the object-name prefix in that dish's .glb (see blender/*.py).
export type MenuItem = {
  id: string
  name: string
  /** Japanese name, shown instead of the Chinese when the menu is in Japanese */
  ja?: string
  /** English name, shown small under the Chinese */
  en?: string
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
  ja?: string
  en?: string
  /** items that come with this base (a set meal), on top of whatever is ordered, by menu id */
  includes?: Record<string, number>
  /** model objects (name prefixes) that don't belong with this base, e.g. chilies in a mild soup */
  hide?: string[]
}

/**
 * Where extra portions of an item are placed (the model has one of each; more are cloned and swung around the
 * dish's centre). Default: spread evenly around, which suits round pots and bowls.
 */
export type CopyLayout = {
  /** 'ring': skewers around a fire, each new one goes to the emptiest free spot on the ring */
  mode?: 'ring'
  /** azimuths to keep clear on the ring, in degrees in the dish's x/z plane (camera line of sight, the plate) */
  avoid?: number[]
  /** non-menu objects that also occupy ring spots (the base fish) */
  fixed?: string[]
  /** per-item swing per extra portion, in radians: shuffles it along beside the original instead */
  spread?: Record<string, number>
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
  ja?: string
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
  layout?: CopyLayout
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
  /**
   * Loose pieces that are piled up on the ground instead of going on the plate, one pyramid per item:
   * where the pile's centre sits and how far apart neighbouring pieces are.
   */
  piles?: Record<string, { at: [number, number, number]; spacing: number }>
}

/** Doneness stages for roasting, by fraction of the cook time. */
export const ROAST_STAGES = [
  { until: 0.5, label: '生', key: 'raw' },
  { until: 1, label: '半熟', key: 'half' },
  { until: 2.2, label: '熟了', key: 'done' },
  { until: Infinity, label: '焦了', key: 'burnt' },
] as const

const CHILIES = ['DriedChili', 'SichuanPepper']

/** Files in public/, resolved against the site's base path (\/\ in dev, \/CanteenSimulator/\ on GitHub Pages). */
const asset = (path: string) => import.meta.env.BASE_URL + path

export const DISHES: Dish[] = [
  {
    id: 'hotpot',
    name: '小火鍋',
    ja: '小鍋',
    model: asset('models/hotpot.glb'),
    bases: [
      { id: 'mala', name: '麻辣湯底', ja: '麻辣スープ', en: 'Mala Broth', price: 120, broth: asset('textures/broth-mala.png') },
      { id: 'tomato', name: '番茄湯底', ja: 'トマトスープ', en: 'Tomato Broth', price: 110, broth: asset('textures/broth-tomato.png'), hide: CHILIES },
      { id: 'kombu', name: '昆布湯底', ja: '昆布だし', en: 'Kombu Broth', price: 100, broth: asset('textures/broth-kombu.png'), hide: CHILIES },
    ],
    items: [
      { id: 'NapaCabbage', name: '白菜', ja: '白菜', en: 'Napa Cabbage', price: 20 },
      { id: 'BeefSlice', name: '牛肉片', ja: '牛肉スライス', en: 'Beef Slices', price: 60 },
      { id: 'Meatball', name: '貢丸', ja: '肉団子', en: 'Pork Ball', price: 30 },
      { id: 'Fishball', name: '魚丸', ja: '魚団子', en: 'Fish Ball', price: 30 },
      { id: 'Tofu', name: '豆腐', ja: '豆腐', en: 'Tofu', price: 20 },
      { id: 'FriedTofu', name: '油豆腐', ja: '厚揚げ', en: 'Fried Tofu', price: 25 },
      { id: 'Taro', name: '芋頭', ja: '里芋', en: 'Taro', price: 25 },
      { id: 'Corn', name: '玉米', ja: 'とうもろこし', en: 'Corn', price: 20 },
      { id: 'CrabStick', name: '蟹肉棒', ja: 'カニカマ', en: 'Crab Stick', price: 35 },
      { id: 'Shrimp', name: '鮮蝦', ja: '海老', en: 'Shrimp', price: 50 },
      { id: 'ShiitakeCap', name: '香菇', ja: '椎茸', en: 'Shiitake', price: 20 },
      { id: 'Enoki', name: '金針菇', ja: 'えのき', en: 'Enoki', price: 20 },
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
    ja: '牛肉麺',
    model: asset('models/beefnoodle.glb'),
    bases: [{ id: 'braised', name: '紅燒湯麵', ja: '紅焼牛肉麺', en: 'Braised Noodles', price: 120 }],
    items: [
      { id: 'BeefShank', name: '牛腱肉', ja: '牛すね', en: 'Beef Shank', price: 80 },
      { id: 'Tendon', name: '牛筋', ja: '牛すじ', en: 'Tendon', price: 50 },
      { id: 'Tripe', name: '牛肚', ja: 'ハチノス', en: 'Tripe', price: 50 },
      { id: 'BraisedEgg', name: '滷蛋', ja: '煮玉子', en: 'Braised Egg', price: 15 },
      { id: 'BokChoy', name: '青江菜', ja: '青梗菜', en: 'Bok Choy', price: 15 },
      { id: 'PickledGreens', name: '酸菜', ja: '高菜', en: 'Pickled Greens', price: 10 },
      { id: 'ExtraNoodles', name: '加麵', ja: '替え玉', en: 'Extra Noodles', price: 20, entrance: 'float' },
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
    name: '日式烤魚',
    ja: '炭火焼き',
    model: asset('models/grilledfish.glb'),
    // every set comes with one fish, a rice ball, shishito and a potato; extras on top are ordered separately
    bases: [
      { id: 'ayu', name: '香魚套餐', ja: '鮎定食', en: 'Ayu Set', price: 180,
        includes: { ExtraFish: 1, Onigiri: 1, Shishito: 1, Potato: 1 } },
      { id: 'saury', name: '秋刀魚套餐', ja: '秋刀魚定食', en: 'Saury Set', price: 190,
        includes: { Saury: 1, Onigiri: 1, Shishito: 1, Potato: 1 } },
      { id: 'mackerel', name: '鯖魚套餐', ja: '鯖定食', en: 'Mackerel Set', price: 200,
        includes: { Mackerel: 1, Onigiri: 1, Shishito: 1, Potato: 1 } },
    ],
    items: [
      { id: 'ExtraFish', name: '香魚', ja: '鮎', en: 'Ayu', price: 80 },
      { id: 'Saury', name: '秋刀魚', ja: '秋刀魚', en: 'Saury', price: 90 },
      { id: 'Mackerel', name: '鯖魚', ja: '鯖', en: 'Mackerel', price: 100 },
      { id: 'GrilledCorn', name: '烤玉米', ja: '焼きもろこし', en: 'Grilled Corn', price: 40 },
      { id: 'GrilledShiitake', name: '烤香菇', ja: '焼き椎茸', en: 'Shiitake', price: 30 },
      { id: 'Onigiri', name: '烤飯糰', ja: '焼きおにぎり', en: 'Yaki Onigiri', price: 35 },
      { id: 'ShrimpSkewer', name: '烤蝦串', ja: '海老串', en: 'Shrimp', price: 60 },
      { id: 'Sausage', name: '香腸', ja: 'ソーセージ', en: 'Sausage', price: 45 },
      { id: 'Potato', name: '烤馬鈴薯', ja: 'じゃがいも', en: 'Potato', price: 40 },
      { id: 'SweetPotato', name: '烤地瓜', ja: '焼き芋', en: 'Sweet Potato', price: 35 },
      { id: 'Yakitori', name: '雞肉蔥串', ja: 'ねぎま', en: 'Negima', price: 50 },
      { id: 'PorkBelly', name: '豬五花串', ja: '豚バラ', en: 'Pork Belly', price: 55 },
      { id: 'Squid', name: '烤魷魚', ja: 'イカ焼き', en: 'Squid', price: 80 },
      { id: 'Shishito', name: '烤青椒', ja: 'ししとう', en: 'Shishito', price: 30 },
      { id: 'Mochi', name: '烤年糕', ja: '焼き餅', en: 'Mochi', price: 35 },
      { id: 'KingOyster', name: '杏鮑菇', ja: 'エリンギ', en: 'King Oyster', price: 35 },
    ],
    defaults: [],
    heat: 'fire',
    roast: {
      times: { Fish: 40, ExtraFish: 40, Saury: 35, Mackerel: 45, GrilledCorn: 30, GrilledShiitake: 20, Onigiri: 25, ShrimpSkewer: 20,
        Sausage: 25, Potato: 55, SweetPotato: 55,
        Yakitori: 30, PorkBelly: 30, Squid: 25, Shishito: 15, Mochi: 20, KingOyster: 20 },
      names: { Fish: '香魚', ExtraFish: '香魚', Saury: '秋刀魚', Mackerel: '鯖魚', GrilledCorn: '玉米', GrilledShiitake: '香菇', Onigiri: '飯糰',
        ShrimpSkewer: '蝦串', Sausage: '香腸', Potato: '馬鈴薯', SweetPotato: '地瓜',
        Yakitori: '雞肉串', PorkBelly: '五花串', Squid: '魷魚', Shishito: '青椒', Mochi: '年糕', KingOyster: '杏鮑菇' },
      loose: ['Potato', 'SweetPotato'],
      // just outside the stones, to the upper right of the fire as the camera sees it
      // (kept clear of the corn skewer at -55°, which used to stand right in front of it)
      plate: [1.38, 0.02, -1.16],
      // just outside the stones on the left as the camera sees it
      piles: {
        Potato: { at: [-1.38, 0, 0.62], spacing: 0.17 },
        SweetPotato: { at: [-0.86, 0, 1.22], spacing: 0.13 },
      },
    },
    layout: {
      mode: 'ring',
      // camera direction (54°) and the plate (-40°)
      avoid: [54, -40],
      // potatoes and sweet potatoes sit in the ash at the front: extra ones line up beside the first,
      // potatoes toward the right, sweet potatoes toward the left
      // (each portion is two pieces about 16° apart, so step a little more than both)
      spread: { Potato: 0.55, SweetPotato: -0.55 },
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
