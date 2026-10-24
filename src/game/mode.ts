// The two ways the kitchen is worked. With the shop shut it's research (研製料理): the owner cooks by hand, tries foods out, seasons them, watches how each
// piece is coming on, and works from the stock fridge. With the shop open it's service (營業): customers order, the kitchen's cooks do the cooking by
// themselves, and none of those hand tools is there.

export type KitchenMode = 'research' | 'service'
export const modeOf = (shopOpen: boolean): KitchenMode => (shopOpen ? 'service' : 'research')

/** whether food can be picked up, put on the fire and seasoned by hand */
export const canCookByHand = (m: KitchenMode) => m === 'research'
/** whether each piece shows its cooking progress over it */
export const showsProgress = (m: KitchenMode) => m === 'research'
/** whether the stock fridge (to take a food out to try, and to call in or top up stock) is on the board */
export const showsStockFridge = (m: KitchenMode) => m === 'research'
/** whether the view is held at camera 1: in research, unless the owner is editing the room (which needs a free view) */
export const holdsCameraOne = (m: KitchenMode, editing: boolean) => m === 'research' && !editing
