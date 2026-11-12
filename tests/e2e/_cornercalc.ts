// The two walls' lines and where they meet, against what the walls are given
import { GRILL_COUNTERS, FLOOR_FAR, farOf } from '@/shops/grill/bar'
const cs = GRILL_COUNTERS
const c0 = cs[0], c = cs[1]
const v = (p: { x: number; y: number; z: number }) => `(${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)})`
console.log('c0 at', v(c0.at), 'along', v(c0.along), 'lay', v(c0.lay), 'len', c0.length, 'far', farOf(c0))
console.log('c1 at', v(c.at), 'along', v(c.along), 'lay', v(c.lay), 'len', c.length, 'far', farOf(c))
console.log('dots: c.along·c0.lay', c.along.dot(c0.lay).toFixed(5), 'c.lay·c0.lay', c.lay.dot(c0.lay).toFixed(5), 'c0.along·c0.lay', c0.along.dot(c0.lay).toFixed(5), '|c0.lay|', c0.lay.length().toFixed(5), '|c.lay|', c.lay.length().toFixed(5))
const back = Math.min(-c0.length / 2 - 0.35, c.at.clone().addScaledVector(c.lay, farOf(c)).sub(c0.at).dot(c0.along))
const proj = c.at.clone().addScaledVector(c.lay, farOf(c)).sub(c0.at).dot(c0.along)
console.log('wall 1 from (back)', back.toFixed(4), ' proj of wall 2 line', proj.toFixed(4), ' -len/2-0.35', (-c0.length / 2 - 0.35).toFixed(4))
const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(c0.lay)) / c.along.dot(c0.lay)
console.log('wall 2 to (corner)', corner.toFixed(4))
// (the walls' actual faces: each at its counter's at, then -far along its local x, local z its along; local x = (cos yaw, 0, -sin yaw))
const face = (cc: typeof c0, far: number) => { const yaw = Math.atan2(cc.along.x, cc.along.z); return { o: cc.at.clone().add({ x: -far * Math.cos(yaw), y: 0, z: far * Math.sin(yaw) } as never), x: { x: Math.cos(yaw), z: -Math.sin(yaw) } } }
const f0 = face(c0, FLOOR_FAR), f1 = face(c, farOf(c))
console.log('wall 1 local x', JSON.stringify(f0.x), 'vs -c0.lay', v(c0.lay.clone().multiplyScalar(-1)))
console.log('wall 2 local x', JSON.stringify(f1.x), 'vs -c.lay', v(c.lay.clone().multiplyScalar(-1)))
