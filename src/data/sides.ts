/** a bowl of plain rice had with the dishes (item 205, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」): not on the menu board
 * (nothing grilled), ordered alongside as the miso soup is; a portion of the rice cooked for the rice balls (the stock's 'Onigiri', a bag
 * cooking a pot of them), scooped from the cooker */
export const RICE_SIDE = { id: 'Rice', name: '白飯', ja: 'ご飯', en: 'Rice', price: 30, stock: 'Onigiri' } as const
/** its name in the language */
export const riceName = (lang: string) => (lang === 'ja' ? RICE_SIDE.ja : lang === 'en' ? RICE_SIDE.en : RICE_SIDE.name)
