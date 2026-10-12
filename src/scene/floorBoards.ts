import * as THREE from 'three'

/*
 * Boards laid the same way right across a floor made of several pieces: each piece's texture coordinates come from
 * where it is in the world (projected onto the way the boards run), not from its own corners, so its boards and
 * their joints run straight on into the next piece's with no seam. Lay a floor's pieces with `boardUVs`, all with
 * the same `along`, and give them one texture.
 */

/** a plank texture, its boards down the image (across u), the grain along v */
export function plankTexture(colours: string[], boardsAcross = 4, size: [number, number] = [128, 512]) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = size[0]
  c.height = size[1]
  const g = c.getContext('2d')!
  const w = size[0] / boardsAcross
  for (let b = 0; b < boardsAcross; b++) {
    g.fillStyle = colours[b % colours.length]
    g.fillRect(b * w, 0, w, size[1])
    g.strokeStyle = 'rgba(30,18,10,0.22)'
    for (let k = 0; k < 5; k++) {
      g.beginPath()
      g.moveTo(b * w + 3 + k * (w / 6), 0)
      g.bezierCurveTo(b * w + 1 + k * (w / 6), size[1] / 3, b * w + 6 + k * (w / 6), (size[1] * 2) / 3, b * w + 3 + k * (w / 6), size[1])
      g.stroke()
    }
    g.fillStyle = 'rgba(25,14,8,0.6)'
    g.fillRect(b * w, 0, 1.5, size[1])
    // (each board's butt joint, staggered from the next)
    g.fillRect(b * w, (b * 197) % size[1], w, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/**
 * Rewrite a flat (XZ-plane, once placed) geometry's UVs from world positions: u across the boards, v along them,
 * `board` world units to a board's width and `run` to a texture's length.
 */
export function boardUVs(geo: THREE.BufferGeometry, world: THREE.Matrix4, along: THREE.Vector3, opts: { board: number; boards: number; run: number }) {
  const across = new THREE.Vector3(-along.z, 0, along.x)
  const p = geo.attributes.position
  const uv = new Float32Array(p.count * 2)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(world)
    uv[i * 2] = v.dot(across) / (opts.board * opts.boards)
    uv[i * 2 + 1] = v.dot(along) / opts.run
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}
