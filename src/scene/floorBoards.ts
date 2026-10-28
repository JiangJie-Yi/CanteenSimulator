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
  // (painted at four times the laid-out size, so the grain holds up close)
  const K = 4
  const c = document.createElement('canvas')
  c.width = size[0] * K
  c.height = size[1] * K
  const g = c.getContext('2d')!
  g.setTransform(K, 0, 0, K, 0, 0)
  const W = size[0], H = size[1]
  const w = W / boardsAcross
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let b = 0; b < boardsAcross; b++) {
    const x0 = b * w
    // (each board its colour, a little lighter and darker along its length as boards are)
    const tone = g.createLinearGradient(0, 0, 0, H)
    tone.addColorStop(0, colours[b % colours.length]); tone.addColorStop(0.5, colours[(b + 1) % colours.length]); tone.addColorStop(1, colours[b % colours.length])
    g.fillStyle = tone
    g.fillRect(x0, 0, w, H)
    g.save()
    g.beginPath(); g.rect(x0, 0, w, H); g.clip()
    // (flat-sawn grain: long nested arches up the board, its heart off to one side)
    const hx = x0 + w * (0.3 + rnd() * 0.4)
    for (let k = 0; k < 14; k++) {
      const top = rnd() * H, len = H * (0.25 + rnd() * 0.4), sp = 2 + k * 1.6
      g.strokeStyle = `rgba(40,22,10,${0.1 + rnd() * 0.12})`
      g.lineWidth = 0.4 + rnd() * 0.5
      g.beginPath()
      g.moveTo(hx - sp, top + len); g.bezierCurveTo(hx - sp, top + len * 0.2, hx + sp, top + len * 0.2, hx + sp, top + len)
      g.stroke()
    }
    // (straight grain beside it, and the pores flecked along it)
    for (let k = 0; k < 8; k++) {
      const gx = x0 + 1 + rnd() * (w - 2)
      g.strokeStyle = `rgba(30,18,10,${0.08 + rnd() * 0.1})`; g.lineWidth = 0.4
      g.beginPath(); g.moveTo(gx, 0); g.bezierCurveTo(gx - 1, H / 3, gx + 1.5, (H * 2) / 3, gx, H); g.stroke()
    }
    for (let k = 0; k < 220; k++) { g.fillStyle = 'rgba(25,14,6,0.25)'; g.fillRect(x0 + rnd() * w, rnd() * H, 0.35, 1.6) }
    // (a knot now and then)
    if (rnd() < 0.6) {
      const kx = x0 + w * (0.2 + rnd() * 0.6), ky = rnd() * H
      g.fillStyle = 'rgba(50,26,10,0.55)'; g.beginPath(); g.ellipse(kx, ky, 2.2, 3.4, 0, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(50,26,10,0.25)'; g.lineWidth = 0.5
      for (let r = 4; r < 10; r += 2) { g.beginPath(); g.ellipse(kx, ky, r * 0.6, r, 0, 0, Math.PI * 2); g.stroke() }
    }
    // (the varnish's sheen down the middle, the board's eased edges a shade darker)
    const sheen = g.createLinearGradient(x0, 0, x0 + w, 0)
    sheen.addColorStop(0, 'rgba(0,0,0,0.18)'); sheen.addColorStop(0.15, 'rgba(0,0,0,0)'); sheen.addColorStop(0.5, 'rgba(255,240,210,0.05)'); sheen.addColorStop(0.85, 'rgba(0,0,0,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.2)')
    g.fillStyle = sheen; g.fillRect(x0, 0, w, H)
    g.restore()
    g.fillStyle = 'rgba(25,14,8,0.65)'
    g.fillRect(x0, 0, 1.2, H)
    // (each board's butt joint, staggered from the next, with its two nail heads)
    const jy = (b * 197) % H
    g.fillRect(x0, jy, w, 1.2)
    g.fillStyle = 'rgba(20,12,6,0.7)'
    for (const nx of [0.25, 0.75]) { g.beginPath(); g.arc(x0 + w * nx, jy + 3, 0.7, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x0 + w * nx, jy - 3, 0.7, 0, Math.PI * 2); g.fill() }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
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
