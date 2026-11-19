// The owner's clothes, his to choose (item 376, the owner's 「老闆可客製化服裝」): each part's colours, the first as he's made (hex null: his
// picture as it is). Names in Chinese, Japanese and English, as a dyer would call them.

export type OutfitPart = 'coat' | 'apron' | 'trousers' | 'headband' | 'towel'
export const OUTFIT_PARTS: readonly OutfitPart[] = ['coat', 'apron', 'trousers', 'headband', 'towel']
export type OutfitColour = { id: string; zh: string; ja: string; en: string; hex: string | null }

export const OUTFIT_PART_NAMES: Record<OutfitPart, { zh: string; ja: string; en: string }> = {
  coat: { zh: '上衣', ja: '上着', en: 'Coat' },
  apron: { zh: '前掛', ja: '前掛け', en: 'Apron' },
  trousers: { zh: '褲子', ja: 'ズボン', en: 'Trousers' },
  headband: { zh: '頭巾', ja: '手拭い', en: 'Headband' },
  towel: { zh: '毛巾', ja: 'タオル', en: 'Towel' },
}

export const OUTFIT_COLOURS: Record<OutfitPart, readonly OutfitColour[]> = {
  coat: [
    { id: 'white', zh: '白', ja: '白', en: 'White', hex: null },
    { id: 'indigo', zh: '藍染', ja: '藍染', en: 'Indigo', hex: '#33507a' },
    { id: 'ink', zh: '墨黑', ja: '墨黒', en: 'Ink', hex: '#2e2e33' },
    { id: 'tea', zh: '茶色', ja: '茶', en: 'Tea', hex: '#7c5838' },
    { id: 'matcha', zh: '抹茶', ja: '抹茶', en: 'Matcha', hex: '#7e8c50' },
    { id: 'sakura', zh: '櫻色', ja: '桜色', en: 'Sakura', hex: '#e9c4c4' },
  ],
  apron: [
    { id: 'navy', zh: '紺', ja: '紺', en: 'Navy', hex: null },
    { id: 'ink', zh: '墨黑', ja: '墨黒', en: 'Ink', hex: '#1f1f24' },
    { id: 'brown', zh: '焦茶', ja: '焦茶', en: 'Brown', hex: '#4e3424' },
    { id: 'vermilion', zh: '朱', ja: '朱', en: 'Vermilion', hex: '#b5452f' },
    { id: 'green', zh: '深綠', ja: '深緑', en: 'Green', hex: '#2e4c3c' },
  ],
  trousers: [
    { id: 'indigo', zh: '藍', ja: '藍', en: 'Indigo', hex: null },
    { id: 'ink', zh: '墨黑', ja: '墨黒', en: 'Ink', hex: '#222227' },
    { id: 'grey', zh: '灰', ja: '灰', en: 'Grey', hex: '#5c5e64' },
    { id: 'khaki', zh: '卡其', ja: 'カーキ', en: 'Khaki', hex: '#8c7c58' },
  ],
  headband: [
    { id: 'navy', zh: '紺', ja: '紺', en: 'Navy', hex: null },
    { id: 'white', zh: '白', ja: '白', en: 'White', hex: '#efebe2' },
    { id: 'red', zh: '紅', ja: '赤', en: 'Red', hex: '#b2322b' },
    { id: 'ink', zh: '墨黑', ja: '墨黒', en: 'Ink', hex: '#232328' },
  ],
  towel: [
    { id: 'cream', zh: '米白', ja: '生成り', en: 'Cream', hex: null },
    { id: 'blue', zh: '淺藍', ja: '水色', en: 'Pale blue', hex: '#a3c3dd' },
    { id: 'red', zh: '紅', ja: '赤', en: 'Red', hex: '#d0604e' },
  ],
}
