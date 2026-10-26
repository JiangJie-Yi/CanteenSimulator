// The till's tablet and how each customer pays: rules kept out of the 3D so they can be tested.

/** how many groups waiting to pay at once puts the tablet to work as a second till */
export const BUSY_QUEUE = 3

/** whether a customer pays by card: about two in five do, the same customer always the same way (by their number) */
export const paysByCard = (id: number) => ((id * 2654435761) >>> 0) % 100 < 40

/** whether the tablet is in use: a card payment goes through it, and so does any payment while the queue's long */
export const tabletActive = (queue: number, card: boolean) => card || queue >= BUSY_QUEUE

/** whether the cash drawer comes out for a payment: only for cash (a card's paid on the reader) */
export const drawerOpens = (card: boolean) => !card
