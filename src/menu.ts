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
  /** most portions that can be ordered at once (default 99) */
  max?: number
  /** calories in one portion (roughly, real-world), counted toward 飽足 when it's eaten */
  kcal?: number
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
  /** objects recoloured flat for this base (a clear broth instead of the braised one) */
  fill?: Record<string, string>
  /** objects tinted over their texture (noodles coated in sauce) */
  tint?: Record<string, string>
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
  /** per-item spots (x, z in the dish) for the 2nd, 3rd… portion, e.g. side by side on the grill net */
  slots?: Record<string, [number, number][]>
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
  /** soups, bowls or set meals, ordered on the menu like anything else */
  bases: Base[]
  /** only one base at a time (one soup in the pot, one bowl of noodles): ordering another swaps it */
  oneBase?: boolean
  /** objects that come with a base: hidden until one is ordered, leaving an empty pot or bowl */
  emptyHide?: string[]
  items: MenuItem[]
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
   * Loose pieces (roasted in foil in the ash) are served into a woven bamboo basket instead of onto the plate:
   * where the first basket sits; it holds `capacity`, and a full one gets another set down beside it.
   */
  basket?: { at: [number, number, number]; capacity: number }
  basketItems?: string[]
  /** grill-net items (onigiri, mochi) are served on little side dishes: where the first sits, how many each holds */
  dish?: { at: [number, number, number]; capacity: number }
  /**
   * Seasonings beside the fire, by object name in the model: drag one onto a piece of food to season it
   * (salt and peanut powder sprinkled on, soy brushed on, condensed milk drizzled over).
   */
  tools?: Record<string, Seasoning>
  /** the pot each utensil stands in (pot object name → utensil object name) */
  toolPots?: Record<string, string>
  /** items toasted on the little grill net over the coals rather than on a skewer (they puff up as they cook) */
  net?: string[]
  /** where the net holds them (x, z in the dish): one per spot, the rest wait until a spot frees up */
  netSpots?: [number, number][]
}

export type Seasoning = 'salt' | 'soy' | 'milk' | 'peanut'

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
    oneBase: true,
    emptyHide: ['Broth', 'Scallion', ...CHILIES],
    heat: 'gas',
    heatControl: true,
    brothY: 0.81,
    steam: { width: 1.1, height: 1.3 },
    focusY: 0.5,
  },
  {
    id: 'beefnoodle',
    name: '麵食',
    ja: '麺類',
    model: asset('models/beefnoodle.glb'),
    // one bowl at a time; the soups differ in colour, the dry ones have no soup and sauce-coloured noodles
    bases: [
      { id: 'braised', name: '紅燒牛肉麵', ja: '紅焼牛肉麺', en: 'Braised Beef Noodles', price: 160,
        includes: { BeefShank: 1 } },
      { id: 'clear', name: '清燉牛肉湯麵', ja: '清燉牛肉麺', en: 'Clear Beef Noodle Soup', price: 160,
        includes: { BeefShank: 1 }, fill: { Broth: '#c99a55' } },
      { id: 'plain', name: '陽春湯麵', ja: '陽春麺', en: 'Plain Noodle Soup', price: 60, fill: { Broth: '#dcc79a' } },
      { id: 'dry', name: '大乾麵', ja: '台湾まぜ麺', en: 'Dry Noodles', price: 70, hide: ['Broth'],
        tint: { Noodles: '#d9a868' } },
      { id: 'sesame', name: '麻醬麵', ja: '胡麻だれ麺', en: 'Sesame Noodles', price: 75, hide: ['Broth'],
        tint: { Noodles: '#c08b4e' } },
    ],
    items: [
      { id: 'BeefShank', name: '牛腱肉', ja: '牛すね', en: 'Beef Shank', price: 80 },
      { id: 'Tendon', name: '牛筋', ja: '牛すじ', en: 'Tendon', price: 50 },
      { id: 'Tripe', name: '牛肚', ja: 'ハチノス', en: 'Tripe', price: 50 },
      { id: 'BraisedEgg', name: '滷蛋', ja: '煮玉子', en: 'Braised Egg', price: 15 },
      { id: 'BokChoy', name: '青江菜', ja: '青梗菜', en: 'Bok Choy', price: 15 },
      { id: 'PickledGreens', name: '酸菜', ja: '高菜', en: 'Pickled Greens', price: 10 },
      { id: 'ExtraNoodles', name: '加麵', ja: '替え玉', en: 'Extra Noodles', price: 20, entrance: 'float' },
    ],
    oneBase: true,
    emptyHide: ['Broth', 'Noodles', 'Scallion'],
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
    // every set comes with one fish, a rice ball, shishito, king oyster mushroom and a potato; extras on top are ordered separately
    bases: [
      { id: 'ayu', name: '鹽烤香魚套餐', ja: '鮎定食', en: 'Ayu Set', price: 180,
        includes: { ExtraFish: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1 } },
      { id: 'saury', name: '鹽烤秋刀魚套餐', ja: '秋刀魚定食', en: 'Saury Set', price: 190,
        includes: { Saury: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1 } },
      { id: 'mackerel', name: '鹽烤鯖魚套餐', ja: '鯖定食', en: 'Mackerel Set', price: 200,
        includes: { Mackerel: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1 } },
    ],
    items: [
      { id: 'ExtraFish', name: '鹽烤香魚', ja: '鮎', en: 'Ayu', price: 80, kcal: 110 },
      { id: 'Saury', name: '鹽烤秋刀魚', ja: '秋刀魚', en: 'Saury', price: 90, kcal: 300 },
      { id: 'Mackerel', name: '鹽烤鯖魚', ja: '鯖', en: 'Mackerel', price: 100, kcal: 290 },
      { id: 'GrilledCorn', name: '烤玉米', ja: '焼きもろこし', en: 'Grilled Corn', price: 40, kcal: 120 },
      { id: 'GrilledShiitake', name: '烤香菇', ja: '焼き椎茸', en: 'Shiitake', price: 30, kcal: 15 },
      { id: 'Onigiri', name: '醬油烤飯糰', ja: '醤油焼きおにぎり', en: 'Soy Onigiri', price: 35, kcal: 220 },
      { id: 'ShrimpSkewer', name: '烤蝦串', ja: '海老串', en: 'Shrimp', price: 60, kcal: 60 },
      { id: 'Sausage', name: '烤香腸', ja: 'ソーセージ', en: 'Sausage', price: 45, kcal: 190 },
      { id: 'Potato', name: '烤馬鈴薯', ja: 'じゃがいも', en: 'Potato', price: 40, kcal: 130 },
      { id: 'SweetPotato', name: '烤地瓜', ja: '焼き芋', en: 'Sweet Potato', price: 35, kcal: 170 },
      { id: 'Yakitori', name: '烤雞肉蔥串', ja: 'ねぎま', en: 'Negima', price: 50, kcal: 170 },
      { id: 'PorkBelly', name: '烤豬五花串', ja: '豚バラ', en: 'Pork Belly', price: 55, kcal: 280 },
      { id: 'Squid', name: '烤魷魚', ja: 'イカ焼き', en: 'Squid', price: 80, kcal: 120 },
      { id: 'Shishito', name: '烤青椒', ja: 'ししとう', en: 'Shishito', price: 30, kcal: 20 },
      { id: 'KingOyster', name: '烤杏鮑菇', ja: 'エリンギ', en: 'King Oyster', price: 35, kcal: 25 },
      { id: 'Asparagus', name: '烤蘆筍', ja: 'アスパラ', en: 'Asparagus', price: 40, kcal: 20 },
      { id: 'Okra', name: '烤秋葵', ja: 'オクラ', en: 'Okra', price: 35, kcal: 25 },
      { id: 'Scallop', name: '烤干貝', ja: 'ホタテ串', en: 'Scallop', price: 90, kcal: 90 },
      // toasted on the grill net, three at a time; more wait their turn
      { id: 'NetMochi', name: '網烤年糕', ja: '焼き餅', en: 'Grilled Mochi', price: 30, kcal: 120 },
    ],
    heat: 'fire',
    roast: {
      times: { Fish: 40, ExtraFish: 40, Saury: 35, Mackerel: 45, GrilledCorn: 30, GrilledShiitake: 20, Onigiri: 25, ShrimpSkewer: 20,
        Sausage: 25, Potato: 55, SweetPotato: 55,
        Yakitori: 30, PorkBelly: 30, Squid: 25, Shishito: 15,  KingOyster: 20, Asparagus: 15, Okra: 15, Scallop: 20,
        NetMochi: 25 },
      names: { Fish: '香魚', ExtraFish: '香魚', Saury: '秋刀魚', Mackerel: '鯖魚', GrilledCorn: '玉米', GrilledShiitake: '香菇', Onigiri: '醬油飯糰',
        ShrimpSkewer: '蝦串', Sausage: '香腸', Potato: '馬鈴薯', SweetPotato: '地瓜',
        Yakitori: '雞肉串', PorkBelly: '五花串', Squid: '魷魚', Shishito: '青椒',  KingOyster: '杏鮑菇', Asparagus: '蘆筍', Okra: '秋葵', Scallop: '干貝',
        NetMochi: '年糕' },
      loose: ['Potato', 'SweetPotato', 'NetMochi', 'Onigiri'],
      // toasted on the grill net, which holds three at a time between them (the rest wait their turn)
      net: ['NetMochi', 'Onigiri'],
      // the net's three spots (x, z); the model's mochi sits on the first, its onigiri on the second
      netSpots: [[-0.11, 0.0], [0.1, 0.07], [0.06, -0.11]],
      // just outside the stones, to the upper right of the fire as the camera sees it
      // (kept clear of the corn skewer at -55°, which used to stand right in front of it)
      plate: [1.38, 0.02, -1.16],
      // just outside the stones on the left as the camera sees it
      basket: { at: [-1.45, 0, 0.85], capacity: 20 },
      basketItems: ['Potato', 'SweetPotato'],
      // behind the fire to the left of the plate, as the camera sees it
      dish: { at: [0.35, 0.0, -1.62], capacity: 3 },
      // the spoons and brush in the seasoning box are what's carried; grabbing a pot picks up its utensil
      tools: { SaltSpoon: 'salt', SoyBrush: 'soy', MilkSpoon: 'milk', PeanutSpoon: 'peanut' },
      toolPots: { SaltPot: 'SaltSpoon', SoyPot: 'SoyBrush', MilkJar: 'MilkSpoon', PeanutBowl: 'PeanutSpoon' },
    },
    layout: {
      mode: 'ring',
      // camera direction (54°) and the plate (-40°)
      avoid: [54, -40],
      // the 2nd and 3rd mochi go on the grill net beside the first (blender/grilledfish.py NET_Z)
      // (Roasting moves net items between the net's spots; listing them here keeps Dish from treating them as
      // skewers on the fire ring)
      slots: { NetMochi: [[0.1, 0.07], [0.06, -0.11]], Onigiri: [[0.06, -0.11], [-0.11, 0.0]] },
      // potatoes and sweet potatoes sit in the ash at the front: extra ones line up beside the first,
      // potatoes toward the right, sweet potatoes toward the left
      spread: { Potato: 0.3, SweetPotato: -0.3 },
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
