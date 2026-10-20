import type { Topping } from './recipes'
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
  /** (台式小吃) served on the table beside the bowl, as this kind of dish; wok dishes are stir-fried first */
  table?: TableKind
  /** the colour of what's on it (rice, sauce, soup…) */
  hue?: string
  /** how many pieces (dumplings) */
  pieces?: number
}

export type TableKind = 'friedRice' | 'quick' | 'saucyRice' | 'friedNoodles' | 'vermicelli' | 'dumplings' | 'xiaolongbao'
  | 'soup' | 'soupDumplings'
export const WOK_KINDS: TableKind[] = ['friedRice', 'quick', 'saucyRice', 'friedNoodles', 'vermicelli']

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

/**
 * The bakery: doughs are given their fillings or toppings and baked in the oven. How long each takes (seconds) and
 * how well each topping suits each dough (美味 added or taken away), from Taiwanese bakeries.
 */
export type Bake = { times: Record<string, number>; pairing: Record<string, Partial<Record<Topping, number>>> }

export type Dish = {
  id: string
  name: string
  ja?: string
  /** the glb it's drawn from ('' for a shop drawn in code: see procedural) */
  model: string
  /** drawn in code rather than from a model (the bakery) */
  procedural?: boolean
  bake?: Bake
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

const CHILIES = ['DriedChili', 'SichuanPepper']

/** Files in public/, resolved against the site's base path (\/\ in dev, \/JapaneseGrillSimulator/\ on GitHub Pages). */
const asset = (path: string) => import.meta.env.BASE_URL + path

/** every shop the game has */
export const ALL_DISHES: Dish[] = [
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
      { id: 'NapaCabbage', name: '白菜', ja: '白菜', en: 'Napa Cabbage', price: 20, kcal: 15 },
      { id: 'BeefSlice', name: '牛肉片', ja: '牛肉スライス', en: 'Beef Slices', price: 60, kcal: 150 },
      { id: 'Meatball', name: '貢丸', ja: '肉団子', en: 'Pork Ball', price: 30, kcal: 120 },
      { id: 'Fishball', name: '魚丸', ja: '魚団子', en: 'Fish Ball', price: 30, kcal: 90 },
      { id: 'Tofu', name: '豆腐', ja: '豆腐', en: 'Tofu', price: 20, kcal: 80 },
      { id: 'FriedTofu', name: '油豆腐', ja: '厚揚げ', en: 'Fried Tofu', price: 25, kcal: 130 },
      { id: 'Taro', name: '芋頭', ja: '里芋', en: 'Taro', price: 25, kcal: 110 },
      { id: 'Corn', name: '玉米', ja: 'とうもろこし', en: 'Corn', price: 20, kcal: 90 },
      { id: 'CrabStick', name: '蟹肉棒', ja: 'カニカマ', en: 'Crab Stick', price: 35, kcal: 70 },
      { id: 'Shrimp', name: '鮮蝦', ja: '海老', en: 'Shrimp', price: 50, kcal: 60 },
      { id: 'ShiitakeCap', name: '香菇', ja: '椎茸', en: 'Shiitake', price: 20, kcal: 15 },
      { id: 'Enoki', name: '金針菇', ja: 'えのき', en: 'Enoki', price: 20, kcal: 20 },
      // a bowl of rice set in front of the stove (the sauce station beside the stove is free)
      { id: 'Rice', name: '白飯', ja: 'ご飯', en: 'Rice', price: 15, kcal: 280, max: 2 },
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
    name: '台式小吃',
    ja: '台湾小吃',
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
      // 湯麵類, as on a Taiwanese dumpling-house menu
      { id: 'sanxianMian', name: '三鮮麵', ja: '三鮮麺', en: 'Seafood Noodle Soup', price: 125, fill: { Broth: '#e6d8b8' } },
      { id: 'rousiMian', name: '肉絲麵', ja: '肉絲麺', en: 'Pork Shred Noodles', price: 100, fill: { Broth: '#d8c08c' } },
      { id: 'daluMian', name: '大滷麵', ja: '大鹵麺', en: 'Thick Gravy Noodles', price: 100, fill: { Broth: '#8a5a2e' } },
      { id: 'suanlaMian', name: '酸辣麵', ja: '酸辣麺', en: 'Hot & Sour Noodles', price: 100, fill: { Broth: '#9a4a24' } },
    ],
    items: [
      { id: 'BeefShank', name: '牛腱肉', ja: '牛すね', en: 'Beef Shank', price: 80 },
      { id: 'Tendon', name: '牛筋', ja: '牛すじ', en: 'Tendon', price: 50 },
      { id: 'Tripe', name: '牛肚', ja: 'ハチノス', en: 'Tripe', price: 50 },
      { id: 'BraisedEgg', name: '滷蛋', ja: '煮玉子', en: 'Braised Egg', price: 15 },
      { id: 'BokChoy', name: '青江菜', ja: '青梗菜', en: 'Bok Choy', price: 15 },
      { id: 'PickledGreens', name: '酸菜', ja: '高菜', en: 'Pickled Greens', price: 10 },
      { id: 'ExtraNoodles', name: '加麵', ja: '替え玉', en: 'Extra Noodles', price: 20, entrance: 'float' },
      // on the table beside the bowl: 快餐, 炒飯, 炒麵, 炒米粉, 燴飯 (stir-fried in the wok first), 水餃, 湯餃, 小籠包, 湯類
      { id: 'zhaopaiFan', name: '招牌飯', ja: '看板ご飯', en: 'House Rice Plate', price: 125, kcal: 780, table: 'quick', hue: '#b0602a' },
      { id: 'xiangchangFan', name: '香腸飯', ja: '腸詰めご飯', en: 'Sausage Rice', price: 105, kcal: 720, table: 'quick', hue: '#b8323a' },
      { id: 'gongbaoFan', name: '宮保雞肉飯', ja: '宮保鶏飯', en: 'Kung Pao Chicken Rice', price: 105, kcal: 760, table: 'quick', hue: '#c25a2a' },
      { id: 'weicengFan', name: '味噌豬肉飯', ja: '味噌豚飯', en: 'Miso Pork Rice', price: 105, kcal: 740, table: 'quick', hue: '#a87840' },
      { id: 'rousiChaofan', name: '肉絲蛋炒飯', ja: '肉絲卵炒飯', en: 'Pork & Egg Fried Rice', price: 105, kcal: 680, table: 'friedRice', hue: '#e8c870' },
      { id: 'niurouChaofan', name: '牛肉蛋炒飯', ja: '牛肉卵炒飯', en: 'Beef & Egg Fried Rice', price: 125, kcal: 720, table: 'friedRice', hue: '#d8b060' },
      { id: 'rousiChaomian', name: '肉絲蛋炒麵', ja: '肉絲卵焼きそば', en: 'Pork Fried Noodles', price: 105, kcal: 650, table: 'friedNoodles', hue: '#c8904a' },
      { id: 'niurouChaomian', name: '牛肉炒麵', ja: '牛肉焼きそば', en: 'Beef Fried Noodles', price: 125, kcal: 690, table: 'friedNoodles', hue: '#a87038' },
      { id: 'rousiMifen', name: '肉絲炒米粉', ja: '肉絲焼きビーフン', en: 'Pork Fried Vermicelli', price: 105, kcal: 560, table: 'vermicelli', hue: '#e8d8b0' },
      { id: 'sanxianMifen', name: '三鮮炒米粉', ja: '三鮮焼きビーフン', en: 'Seafood Fried Vermicelli', price: 125, kcal: 540, table: 'vermicelli', hue: '#efe2c4' },
      { id: 'niurouMifen', name: '牛肉炒米粉', ja: '牛肉焼きビーフン', en: 'Beef Fried Vermicelli', price: 125, kcal: 590, table: 'vermicelli', hue: '#d8c098' },
      { id: 'rousiHuifan', name: '肉絲燴飯', ja: '肉絲あんかけご飯', en: 'Pork Gravy Rice', price: 105, kcal: 640, table: 'saucyRice', hue: '#a8743a' },
      { id: 'niurouHuifan', name: '牛肉燴飯', ja: '牛肉あんかけご飯', en: 'Beef Gravy Rice', price: 125, kcal: 680, table: 'saucyRice', hue: '#7a4a22' },
      { id: 'sanxianHuifan', name: '三鮮燴飯', ja: '三鮮あんかけご飯', en: 'Seafood Gravy Rice', price: 125, kcal: 620, table: 'saucyRice', hue: '#d8c49a' },
      { id: 'xiarenHuifan', name: '蝦仁滑蛋燴飯', ja: '海老卵あんかけご飯', en: 'Shrimp & Egg Gravy Rice', price: 110, kcal: 650, table: 'saucyRice', hue: '#f0d070' },
      { id: 'niunanHuifan', name: '牛腩燴飯', ja: '牛バラあんかけご飯', en: 'Beef Brisket Gravy Rice', price: 150, kcal: 760, table: 'saucyRice', hue: '#6a3a1a' },
      { id: 'shuijiao10', name: '水餃10顆', ja: '水餃子10個', en: 'Dumplings ×10', price: 80, kcal: 450, table: 'dumplings', pieces: 10 },
      { id: 'shuijiao15', name: '水餃15顆', ja: '水餃子15個', en: 'Dumplings ×15', price: 120, kcal: 675, table: 'dumplings', pieces: 15 },
      { id: 'shuijiao20', name: '水餃20顆', ja: '水餃子20個', en: 'Dumplings ×20', price: 160, kcal: 900, table: 'dumplings', pieces: 20 },
      { id: 'niurouTangjiao', name: '牛肉湯餃', ja: '牛肉スープ餃子', en: 'Beef Soup Dumplings', price: 115, kcal: 520, table: 'soupDumplings', hue: '#b0703a', pieces: 10 },
      { id: 'suanlaTangjiao', name: '酸辣湯餃', ja: '酸辣スープ餃子', en: 'Hot & Sour Soup Dumplings', price: 115, kcal: 510, table: 'soupDumplings', hue: '#9a5028', pieces: 10 },
      { id: 'xiaolongbao', name: '小籠包', ja: '小籠包', en: 'Xiaolongbao', price: 120, kcal: 420, table: 'xiaolongbao', pieces: 8 },
      { id: 'suanlaTang', name: '酸辣湯', ja: '酸辣湯', en: 'Hot & Sour Soup', price: 50, kcal: 120, table: 'soup', hue: '#8a4a26' },
      { id: 'danhuaTang', name: '蛋花湯', ja: 'かき玉スープ', en: 'Egg Drop Soup', price: 40, kcal: 80, table: 'soup', hue: '#e8d890' },
      { id: 'doufuTang', name: '豆腐湯', ja: '豆腐スープ', en: 'Tofu Soup', price: 40, kcal: 90, table: 'soup', hue: '#efe6d0' },
      { id: 'doufuDanhuaTang', name: '豆腐蛋花湯', ja: '豆腐かき玉スープ', en: 'Tofu Egg Drop Soup', price: 50, kcal: 110, table: 'soup', hue: '#ead88a' },
      { id: 'gongwanTang', name: '貢丸湯', ja: '肉団子スープ', en: 'Pork Ball Soup', price: 55, kcal: 160, table: 'soup', hue: '#e0d4b4' },
      { id: 'sanxianTang', name: '三鮮湯', ja: '三鮮スープ', en: 'Seafood Soup', price: 80, kcal: 140, table: 'soup', hue: '#e6dcc0' },
      { id: 'zhuganTang', name: '豬肝湯', ja: '豚レバースープ', en: 'Pork Liver Soup', price: 70, kcal: 150, table: 'soup', hue: '#d8c8a0' },
      { id: 'yumiTang', name: '玉米濃湯', ja: 'コーンスープ', en: 'Corn Chowder', price: 70, kcal: 180, table: 'soup', hue: '#f0cc50' },
      { id: 'niurouTang', name: '牛肉湯', ja: '牛肉スープ', en: 'Beef Soup', price: 80, kcal: 170, table: 'soup', hue: '#c08848' },
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
      tray: [-0.38, 0.0, 2.06],
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
    smoke: { y: 0.85, width: 1.0, height: 2.0 },
    focusY: 0.5,
  },
  {
    id: 'bakery',
    name: '西式麵包',
    ja: 'ベーカリー',
    model: '',
    procedural: true,
    bases: [],
    // a French/Viennese bakery: what's bought in is the dough; what it becomes depends on what goes on it (recipes.ts)
    items: [
      { id: 'CroissantDough', name: '可頌麵團', ja: 'クロワッサン生地', en: 'Croissant Dough', price: 45, kcal: 260 },
      { id: 'BaguetteDough', name: '法國麵團', ja: 'バゲット生地', en: 'Baguette Dough', price: 35, kcal: 270 },
      { id: 'BriocheDough', name: '布里歐麵團', ja: 'ブリオッシュ生地', en: 'Brioche Dough', price: 40, kcal: 300 },
      { id: 'SourdoughDough', name: '酸種麵團', ja: 'サワードウ生地', en: 'Sourdough', price: 50, kcal: 280 },
    ],
    bake: {
      times: { CroissantDough: 22, BaguetteDough: 26, BriocheDough: 18, SourdoughDough: 32 },
      pairing: {
        // butter pastry: chocolate and almond (pain au chocolat, croissant aux amandes), ham and cheese; not garlic
        CroissantDough: { chocolate: 16, almond: 14, custard: 10, cheese: 10, ham: 8, garlic: -12 },
        // a crusty stick: garlic butter, cheese, ham (jambon-beurre); nothing sweet
        BaguetteDough: { garlic: 16, cheese: 12, ham: 12, almond: -6, chocolate: -8, custard: -12 },
        // rich and soft: chocolate and custard
        BriocheDough: { custard: 16, chocolate: 14, almond: 10, cheese: 4, ham: 2, garlic: -12 },
        // a sour country loaf: cheese and garlic
        SourdoughDough: { cheese: 12, garlic: 12, ham: 8, almond: 2, chocolate: -6, custard: -10 },
      },
    },
    light: { spotIntensity: 1.2, shadowOpacity: 0.5 },
    focusY: 0.45,
  },
]

/** the shops open in this build: for now only the grill (the others are kept, switched off) */
export const ENABLED_SHOPS = ['grilledfish']
export const DISHES: Dish[] = ALL_DISHES.filter((d) => ENABLED_SHOPS.includes(d.id))

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
