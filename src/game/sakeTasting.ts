// Tasting the stand's sake (item 363, the owner's, 2026-11-19: 「你這功能是給誰玩」). The stand's pour-and-drink was for nobody: since item
// 177 the customers' sake is poured at the pass and carried out (the stand's out of the staff's reach), and what the owner poured himself
// and drank did nothing. Now it's his tasting, with the shop shut: a cup poured off one of its bottles and drunk, the first of each make,
// its notes and what it goes with written down (and shown on the bottle after); the floor staff then speak for what he's tasted, and more
// of those eating add a tokkuri (a point more of them for each make). Open, the stand's only to look at: the staff pour at the pass.
// Pure rules; Decor pours and drinks, bar.ts keeps the list (a browser's), Roasting takes the orders.

export type Lang3 = [zh: string, ja: string, en: string]
export type SakeNote = { name: Lang3; grade: Lang3; taste: Lang3; with: Lang3 }

/** each bottle's, by its number on the stand (blender/sakestand.py's labels: the makes and grades made up for the shop), the shochu last */
export const SAKE_NOTES: SakeNote[] = [
  { name: ['雪嶺錦', '雪嶺錦', 'Setsureinishiki'], grade: ['特別純米', '特別純米', 'Tokubetsu junmai'],
    taste: ['辛口，米的旨味飽滿，溫燗更好喝', '辛口、米の旨みがしっかり、ぬる燗でさらに良い', 'Dry, full of the rice’s savour, better still warmed'],
    with: ['鹽烤鯖魚、秋刀魚', '鯖や秋刀魚の塩焼き', 'salt-grilled mackerel and saury'] },
  { name: ['朝霞川', '朝霞川', 'Asakagawa'], grade: ['純米吟釀', '純米吟醸', 'Junmai ginjō'],
    taste: ['清爽的果香，入口微甜', '爽やかな果実の香り、口当たりはやや甘め', 'Fresh and fruity, a touch sweet'],
    with: ['香魚、蔬菜串', '鮎、野菜串', 'ayu and vegetable skewers'] },
  { name: ['鶴汀', '鶴汀', 'Tsurunagisa'], grade: ['純米大吟釀', '純米大吟醸', 'Junmai daiginjō'],
    taste: ['華麗的吟釀香，口感滑順', '華やかな吟醸香、なめらか', 'A showy ginjō nose, silky'],
    with: ['柳葉魚、竹筴魚', 'ししゃも、鯵', 'shishamo and horse mackerel'] },
  { name: ['月汀桜', '月汀桜', 'Gettei-zakura'], grade: ['純米吟釀', '純米吟醸', 'Junmai ginjō'],
    taste: ['淡淡的花香，輕盈好入口', 'ほのかな花の香り、軽やか', 'A faint flowery nose, light'],
    with: ['竹筴魚、烤菇', '鯵、焼ききのこ', 'horse mackerel and grilled mushrooms'] },
  { name: ['鶴汀', '鶴汀', 'Tsurunagisa'], grade: ['純米', '純米', 'Junmai'],
    taste: ['沉穩的米香，尾韻乾淨', '落ち着いた米の香り、後味すっきり', 'A calm rice nose, a clean finish'],
    with: ['烤飯糰、烤年糕', '焼きおにぎり、焼き餅', 'grilled rice balls and mochi'] },
  { name: ['瑠璃灘', '瑠璃灘', 'Rurinada'], grade: ['本釀造', '本醸造', 'Honjōzō'],
    taste: ['爽快的辛口，冷熱都好', 'キレのある辛口、冷やでも燗でも', 'Crisp and dry, cold or warm'],
    with: ['沙丁魚、烤魷魚', '鰯、焼きイカ', 'sardines and grilled squid'] },
  { name: ['雲雀谷', '雲雀谷', 'Hibaridani'], grade: ['純米大吟釀', '純米大吟醸', 'Junmai daiginjō'],
    taste: ['清透，有梨子般的香氣', '透明感があり、梨のような香り', 'Clear, a pear-like nose'],
    with: ['香魚、鹽烤白身魚', '鮎、白身魚の塩焼き', 'ayu and salt-grilled white fish'] },
  { name: ['楓霞', '楓霞', 'Fūka'], grade: ['特別本釀造', '特別本醸造', 'Tokubetsu honjōzō'],
    taste: ['微熟成，圓潤帶焦糖香', 'やや熟成、まろやかでカラメルの香り', 'Lightly aged, round, a hint of caramel'],
    with: ['醬烤、照燒', 'タレ焼き、照り焼き', 'sauce-glazed and teriyaki'] },
  { name: ['稲穂川', '稲穂川', 'Inahogawa'], grade: ['本釀造', '本醸造', 'Honjōzō'],
    taste: ['店裡的日常酒，順口，熱燗最好', '店の普段酒、飲みやすく熱燗が一番', 'The house’s everyday sake, easy, best hot'],
    with: ['什麼都配', '何にでも', 'anything'] },
  { name: ['澄藍', '澄藍', 'Sumiai'], grade: ['純米吟釀 無濾過生原酒', '純米吟醸 無濾過生原酒', 'Junmai ginjō, unfiltered, undiluted'],
    taste: ['濃醇，酒感強，帶熟果香', '濃醇でアルコール感強め、熟した果実の香り', 'Rich and strong, a ripe-fruit nose'],
    with: ['油脂多的鯖魚、秋刀魚', '脂ののった鯖や秋刀魚', 'fatty mackerel and saury'] },
  { name: ['玄雪', '玄雪', 'Gensetsu'], grade: ['純米大吟釀', '純米大吟醸', 'Junmai daiginjō'],
    taste: ['厚實，餘韻很長', '厚みがあり、余韻が長い', 'Deep, with a long finish'],
    with: ['鹽烤白身魚、烤菇', '白身魚の塩焼き、焼ききのこ', 'salt-grilled white fish and grilled mushrooms'] },
  { name: ['雪見舟', '雪見舟', 'Yukimibune'], grade: ['活性濁酒', '活性にごり', 'Sparkling nigori'],
    taste: ['微氣泡，米的甘甜綿密', '微発泡、米の甘みがなめらか', 'Lightly sparkling, a soft rice sweetness'],
    with: ['辣味、蔬菜', 'ピリ辛のもの、野菜', 'anything spicy and vegetables'] },
  { name: ['燒酒', '焼酎', 'Shōchū'], grade: ['麥燒酒', '麦焼酎', 'Barley shōchū'],
    taste: ['乾淨的麥香，加冰或兌水', 'すっきりした麦の香り、ロックか水割りで', 'A clean barley nose, on ice or with water'],
    with: ['串燒', '串焼き', 'skewers'] },
]
/** the sakes among them (the shochu after): those whose tasting has the staff speak for them */
export const SAKE_MAKES = 12
/** how many more of those eating add a tokkuri for each make tasted (of SAKE_SIDE's twelve in a hundred) */
export const TASTE_BONUS = 0.01

/** how many of the sakes have been tasted (each once; the shochu's isn't one) */
export const tastedSakes = (list: readonly number[]) => new Set(list.filter((k) => Number.isInteger(k) && k >= 0 && k < SAKE_MAKES)).size
/** how many of those eating add a tokkuri: `base` and a point for each make tasted */
export const sideChance = (base: number, list: readonly number[]) => base + TASTE_BONUS * tastedSakes(list)
/** bottle `k` tasted: the list with it (once), and whether it's its first tasting */
export function taste(list: readonly number[], k: number): { list: number[]; first: boolean } {
  if (!Number.isInteger(k) || k < 0 || k >= SAKE_NOTES.length || list.includes(k)) return { list: [...list], first: false }
  return { list: [...list, k], first: true }
}
/** the list as kept (JSON), anything not one of the bottles' numbers dropped, each once */
export function readTasted(raw: string | null): number[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? [...new Set(v.filter((k): k is number => Number.isInteger(k) && k >= 0 && k < SAKE_NOTES.length))] : []
  } catch {
    return []
  }
}
/** whether the owner pours at the stand: only with the shop shut (open, the customers' is poured at the pass, and he's at the fire) */
export const canTaste = (open: boolean) => !open
