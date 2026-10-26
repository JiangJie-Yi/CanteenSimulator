// Dishes and their menus. Each item `id` is the object-name prefix in that dish's .glb (see blender/*.py).
export type MenuItem = {
  id: string
  name: string
  /** Japanese name, shown instead of the Chinese when the menu is in Japanese */
  ja?: string
  /** English name, shown small under the Chinese */
  en?: string
  price: number
  /** most portions that can be ordered at once (default 99) */
  max?: number
  /** calories in one portion (roughly, real-world), counted toward 飽足 when it's eaten */
  kcal?: number
}

/** A set meal: the fish and what comes with it. Dark strip on the menu. */
export type Base = {
  id: string
  name: string
  price: number
  ja?: string
  en?: string
  /** items that come with this base (a set meal), on top of whatever is ordered, by menu id */
  includes?: Record<string, number>
  /** model objects (name prefixes) that don't belong with this set */
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
  /** the glb it's drawn from */
  model: string
  /** set meals, ordered on the menu like anything else */
  bases: Base[]
  items: MenuItem[]
  /** what's heating it, animated in the web app */
  heat?: 'fire'
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
  /** the seasoning box's objects: the first is the box itself, which can be dragged with everything in it */
  toolBox?: string[]
  /** the water bucket's objects (bucket first): dragged as one; its dipper splashes food or the coals */
  bucket?: string[]
  /** where the trash bin stands: bare sticks and burnt (or unwanted) food are dropped in it */
  trash?: [number, number, number]
  /** where the ordered food waits, raw, on a tray, until it's carried to the fire */
  tray?: [number, number, number]
  /** items toasted on the little grill net over the coals rather than on a skewer (they puff up as they cook) */
  net?: string[]
  /** where the net holds them (x, z in the dish): one per spot, the rest wait until a spot frees up */
  netSpots?: [number, number][]
  /** skewers that turn on their stick to face the camera (flat food, seen side-on otherwise) */
  faceCamera?: string[]
  /** soups set on the table (not roasted): clicked a few times to drink */
  drinks?: string[]
  /** a small dish beside the tray where some raw food (rice balls) waits instead of on the tray */
  rawDish?: { at: [number, number, number]; items: string[] }
}

export type Seasoning = 'salt' | 'soy' | 'milk' | 'peanut' | 'miso' | 'wasabi' | 'shichimi' | 'yuzu' | 'lemon' | 'water'

/** Doneness stages for roasting, by fraction of the cook time. */
export const ROAST_STAGES = [
  { until: 0.5, label: '生', key: 'raw' },
  { until: 1, label: '半熟', key: 'half' },
  { until: 2.2, label: '熟了', key: 'done' },
  { until: Infinity, label: '焦了', key: 'burnt' },
] as const

/** Files in public/, resolved against the site's base path (\/\ in dev, \/JapaneseGrillSimulator/\ on GitHub Pages). */
const asset = (path: string) => import.meta.env.BASE_URL + path

/** the shop: a Japanese grill */
export const DISHES: Dish[] = [
  {
    id: 'grilledfish',
    name: '日式烤魚',
    ja: '炭火焼き',
    model: asset('models/grilledfish.glb'),
    // every set comes with one fish, a rice ball, shishito, king oyster mushroom and a potato; extras on top are ordered separately
    bases: [
      { id: 'ayu', name: '鹽烤香魚套餐', ja: '鮎定食', en: 'Ayu Set', price: 420,
        includes: { ExtraFish: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1, MisoSoup: 1 } },
      { id: 'saury', name: '鹽烤秋刀魚套餐', ja: '秋刀魚定食', en: 'Saury Set', price: 400,
        includes: { Saury: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1, MisoSoup: 1 } },
      { id: 'mackerel', name: '鹽烤鯖魚套餐', ja: '鯖定食', en: 'Mackerel Set', price: 420,
        includes: { Mackerel: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1, MisoSoup: 1 } },
    ],
    items: [
      { id: 'ExtraFish', name: '香魚', ja: '鮎', en: 'Ayu', price: 220, kcal: 110 },
      { id: 'Saury', name: '秋刀魚', ja: '秋刀魚', en: 'Saury', price: 200, kcal: 300 },
      { id: 'Mackerel', name: '鯖魚', ja: '鯖', en: 'Mackerel', price: 220, kcal: 290 },
      // more of what a Japanese grilled-fish shop (焼き魚定食屋) has: horse mackerel, sardines and shishamo cheap;
      // salmon, atka mackerel and yellowtail in between; black cod dear; blackthroat seaperch dearest.
      // Priced as at a mid-range robata / 串燒 izakaya in Taipei (2025-26): skewers NT$50-80, a whole grilled fish
      // NT$150-420 (紅喉 near NT$900), a set meal around NT$400, a tokkuri of sake NT$280
      { id: 'Aji', name: '竹筴魚', ja: '鯵', en: 'Horse Mackerel', price: 220, kcal: 150 },
      { id: 'Iwashi', name: '沙丁魚', ja: '鰯', en: 'Sardine', price: 160, kcal: 160 },
      { id: 'Shishamo', name: '柳葉魚', ja: 'ししゃも', en: 'Shishamo', price: 150, kcal: 120 },
      { id: 'Salmon', name: '鮭魚', ja: '鮭', en: 'Salmon', price: 260, kcal: 230 },
      { id: 'Hokke', name: '花魚', ja: 'ほっけ', en: 'Atka Mackerel', price: 380, kcal: 280 },
      { id: 'Buri', name: '鰤魚', ja: '鰤', en: 'Yellowtail', price: 320, kcal: 260 },
      { id: 'Gindara', name: '銀鱈', ja: '銀鱈', en: 'Black Cod', price: 420, kcal: 250 },
      { id: 'Nodoguro', name: '紅喉', ja: 'のどぐろ', en: 'Blackthroat Seaperch', price: 880, kcal: 200 },
      { id: 'GrilledCorn', name: '玉米', ja: 'とうもろこし', en: 'Grilled Corn', price: 80, kcal: 120 },
      { id: 'GrilledShiitake', name: '香菇', ja: '椎茸', en: 'Shiitake', price: 60, kcal: 15 },
      { id: 'Onigiri', name: '飯糰', ja: 'おにぎり', en: 'Soy Onigiri', price: 60, kcal: 220 },
      { id: 'ShrimpSkewer', name: '蝦串', ja: '海老串', en: 'Shrimp', price: 120, kcal: 60 },
      { id: 'Sausage', name: '香腸', ja: 'ソーセージ', en: 'Sausage', price: 70, kcal: 190 },
      { id: 'Potato', name: '馬鈴薯', ja: 'じゃがいも', en: 'Potato', price: 90, kcal: 130 },
      { id: 'SweetPotato', name: '地瓜', ja: 'さつまいも', en: 'Sweet Potato', price: 80, kcal: 170 },
      { id: 'Yakitori', name: '雞肉蔥串', ja: 'ねぎま', en: 'Negima', price: 70, kcal: 170 },
      { id: 'PorkBelly', name: '豬五花串', ja: '豚バラ', en: 'Pork Belly', price: 70, kcal: 280 },
      { id: 'Squid', name: '魷魚', ja: 'イカ', en: 'Squid', price: 220, kcal: 120 },
      { id: 'Shishito', name: '青椒', ja: 'ししとう', en: 'Shishito', price: 50, kcal: 20 },
      { id: 'KingOyster', name: '杏鮑菇', ja: 'エリンギ', en: 'King Oyster', price: 60, kcal: 25 },
      { id: 'Asparagus', name: '蘆筍', ja: 'アスパラ', en: 'Asparagus', price: 70, kcal: 20 },
      { id: 'Okra', name: '秋葵', ja: 'オクラ', en: 'Okra', price: 60, kcal: 25 },
      { id: 'Scallop', name: '干貝串', ja: 'ホタテ串', en: 'Scallop', price: 160, kcal: 90 },
      { id: 'BloodCake', name: '米血', ja: '米血糕', en: 'Rice Blood Cake', price: 50, kcal: 160 },
      // toasted on the grill net, three at a time; more wait their turn
      { id: 'NetMochi', name: '年糕', ja: '餅', en: 'Grilled Mochi', price: 60, kcal: 120 },
      // in a lacquered bowl on the table in front, beside the plates; comes with every set too
      { id: 'MisoSoup', name: '味噌湯', ja: '味噌汁', en: 'Miso Soup', price: 50, kcal: 40, max: 2 },
      // a tokkuri of warm sake with its cup, on a little tray in the row beside the soup
      { id: 'Sake', name: '清酒', ja: '日本酒', en: 'Sake', price: 280, kcal: 110, max: 1 },
    ],
    heat: 'fire',
    roast: {
      times: { Fish: 40, ExtraFish: 40, Saury: 35, Mackerel: 45, Aji: 35, Iwashi: 25, Shishamo: 20, Salmon: 40, Hokke: 45,
        Buri: 40, Gindara: 45, Nodoguro: 40, GrilledCorn: 30, GrilledShiitake: 20, Onigiri: 25, ShrimpSkewer: 20,
        Sausage: 25, Potato: 55, SweetPotato: 55,
        Yakitori: 30, PorkBelly: 30, Squid: 25, Shishito: 15,  KingOyster: 20, Asparagus: 15, Okra: 15, Scallop: 20, BloodCake: 20,
        NetMochi: 25 },
      names: { Fish: '香魚', ExtraFish: '香魚', Saury: '秋刀魚', Mackerel: '鯖魚', Aji: '竹筴魚', Iwashi: '沙丁魚', Shishamo: '柳葉魚',
        Salmon: '鮭魚', Hokke: '花魚', Buri: '鰤魚', Gindara: '銀鱈', Nodoguro: '紅喉', GrilledCorn: '玉米', GrilledShiitake: '香菇', Onigiri: '飯糰',
        ShrimpSkewer: '蝦串', Sausage: '香腸', Potato: '馬鈴薯', SweetPotato: '地瓜',
        Yakitori: '雞肉串', PorkBelly: '五花串', Squid: '魷魚', Shishito: '青椒',  KingOyster: '杏鮑菇', Asparagus: '蘆筍', Okra: '秋葵', Scallop: '干貝', BloodCake: '米血',
        NetMochi: '年糕' },
      loose: ['Potato', 'SweetPotato', 'NetMochi', 'Onigiri'],
      // toasted on the grill net, which holds three at a time between them (the rest wait their turn)
      net: ['NetMochi', 'Onigiri'],
      faceCamera: ['ShrimpSkewer'],
      drinks: ['MisoSoup', 'Sake'],
      // the net's three spots (x, z); the model's mochi sits on the first, its onigiri on the second
      netSpots: [[-0.11, 0.0], [0.1, 0.07], [0.06, -0.11]],
      // just outside the stones, to the upper right of the fire as the camera sees it
      // (kept clear of the corn skewer at -55°, which used to stand right in front of it)
      // plates and dishes on the right of the fire as the camera sees it, the box and the bucket on the left
      // everything you eat from in a row along the front (toward the camera): the side dish, the miso soup, the
      // plate and the basket, left to right; the tray of raw skewers on the right; box, bucket and bin on the left
      // (the plates and dishes all on the right of the fire as the camera sees it; the raw tray front and centre)
      // (the plates and dishes are kept in the cubby under the cook's table: the big plate on its floor, the side dishes on its
      // shelf over it; Roasting's plateAt and dishAt put the ones past the first back on the table's top, where this was)
      plate: [2.333, -1.26, 0.224],
      // just outside the stones on the left as the camera sees it
      basket: { at: [-0.412, -0.74, 2.16], capacity: 20 },
      basketItems: ['Potato', 'SweetPotato'],
      // (in the front row, left of the miso soup bowls)
      dish: { at: [2.133, -0.74, 0.374], capacity: 3 },
      // the spoons and brush in the seasoning box are what's carried; grabbing a pot picks up its utensil
      // (salt is taken by hand: SaltPinch only marks where the pinch is taken from)
      tools: { SaltPinch: 'salt', SoyBrush: 'soy', MilkBrush: 'milk', PeanutSpoon: 'peanut', WaterDipper: 'water',
        // (the second box: miso, wasabi, shichimi, yuzu kosho, and a lemon wedge picked up itself)
        MisoSpoon: 'miso', WasabiSpoon: 'wasabi', ShichimiSpoon: 'shichimi', YuzuSpoon: 'yuzu', LemonWedge: 'lemon' },
      toolPots: { SaltPot: 'SaltPinch', SoyPot: 'SoyBrush', MilkJar: 'MilkBrush', PeanutBowl: 'PeanutSpoon',
        MisoPot: 'MisoSpoon', WasabiDish: 'WasabiSpoon', ShichimiBowl: 'ShichimiSpoon', YuzuJar: 'YuzuSpoon', LemonDish: 'LemonWedge', LemonWedges: 'LemonWedge' },
      // the seasoning box (dragged as a whole) and everything standing in it
      toolBox: ['SeasoningBox', 'SaltPot', 'SoyPot', 'MilkJar', 'PeanutBowl', 'SaltPinch', 'SoyBrush', 'MilkBrush',
        'PeanutSpoon', 'SeasoningBox2', 'MisoPot', 'WasabiDish', 'ShichimiBowl', 'YuzuJar', 'LemonDish', 'LemonWedges',
        'MisoSpoon', 'WasabiSpoon', 'ShichimiSpoon', 'YuzuSpoon', 'LemonWedge'],
      // a bucket of water for splashing, the trash bin beside it (both on the left); the tray where ordered food
      // waits to go on the fire
      bucket: ['WaterBucket', 'WaterDipper'],
      // (the bin to the left of the bucket, where it can be seen, not hidden behind it)
      // (kept on the table, whose left edge is drawn in by the side counter's pull: SIDE_PULL in shops/grill/bar.ts)
      trash: [-0.533, -1.26, 2.248],
      tray: [-0.31, 0.0, 2.16],
      // the rice balls come out on their own little dish, just past the front end of the tray
      // (beside the front end of the tray, between it and the basket: the prep side, all on the right)
      rawDish: { at: [2.573, -0.74, 0.044], items: ['Onigiri'] },
    },
    layout: {
      mode: 'ring',
      // camera direction (54°) and the plate (-40°)
      avoid: [54, -40],
      // the 2nd and 3rd mochi go on the grill net beside the first (blender/grilledfish.py NET_Z)
      // (Roasting moves net items between the net's spots; listing them here keeps Dish from treating them as
      // skewers on the fire ring)
      slots: { NetMochi: [[0.1, 0.07], [0.06, -0.11]], Onigiri: [[0.06, -0.11], [-0.11, 0.0]],
        // a second bowl of soup beside the first
        MisoSoup: [[0.0, 1.61]] },
      // potatoes and sweet potatoes sit in the ash at the front: extra ones line up beside the first,
      // potatoes toward the right, sweet potatoes toward the left
      spread: { Potato: 0.3, SweetPotato: -0.3 },
    },
    smoke: { y: 0.85, width: 1.5, height: 1.5 },
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
