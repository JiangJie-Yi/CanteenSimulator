// Kinds of food, for asking the second chef by kind rather than by name — 「來點魚」, 「有什麼蔬菜？」, 「肉類的」,
// 「甜的」: the words for each kind (Chinese, Japanese, English), its name as he'd say it, and the foods in it (at any
// shop: a shop only offers those of them it has).
export type FoodKind = { words: string[]; zh: string; ja: string; ids: string[] }

const FISH = ['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Salmon', 'Hokke', 'Buri', 'Gindara', 'Nodoguro']

/** (more particular kinds first: 菇 before 蔬菜, 海鮮 before 魚) */
export const FOOD_KINDS: FoodKind[] = [
  { words: ['菇', 'きのこ', 'mushroom'], zh: '菇類', ja: 'きのこ', ids: ['GrilledShiitake', 'KingOyster', 'Enoki', 'ShiitakeCap'] },
  { words: ['海鮮', '海產', '海の幸', 'seafood'], zh: '海鮮', ja: '海鮮', ids: [...FISH, 'ShrimpSkewer', 'Squid', 'Scallop', 'Shrimp', 'CrabStick'] },
  { words: ['魚', '焼き魚', 'さかな', 'fish'], zh: '魚', ja: '魚', ids: FISH },
  { words: ['肉', 'お肉', 'meat'], zh: '肉', ja: '肉', ids: ['Yakitori', 'PorkBelly', 'Sausage', 'BloodCake', 'BeefSlice', 'Meatball'] },
  { words: ['蔬菜', '青菜', '野菜', '素食', '健康', 'vegetable', 'veg'], zh: '蔬菜', ja: '野菜',
    ids: ['GrilledCorn', 'GrilledShiitake', 'Shishito', 'KingOyster', 'Asparagus', 'Okra', 'Potato', 'SweetPotato', 'NapaCabbage', 'BokChoy', 'Corn', 'Taro'] },
  { words: ['主食', '澱粉', '飽', '飯', 'ご飯', 'rice'], zh: '吃得飽的', ja: 'ご飯もの', ids: ['Onigiri', 'NetMochi', 'Potato', 'SweetPotato'] },
  { words: ['甜', 'スイーツ', '甘い', 'sweet'], zh: '甜的', ja: '甘いもの', ids: ['NetMochi', 'SweetPotato', 'GrilledCorn'] },
  { words: ['串', '串焼き', 'skewer'], zh: '串燒', ja: '串焼き',
    ids: ['Yakitori', 'PorkBelly', 'ShrimpSkewer', 'Scallop', 'Sausage', 'BloodCake', 'Shishito', 'Asparagus', 'Okra', 'KingOyster'] },
]
