import * as THREE from 'three'

/**
 * Each model's, picture's and light's address with a hash of its content on it (item 478, the owner's 「本地端 and GitHub 上，兩者怎差這麼多?」:
 * GitHub Pages lets a browser keep what it fetched for ten minutes and the site's files keep their addresses build after build, so a model
 * changed and pushed was still seen as it was before: the beckoning cats' coats, taken off, still on there). The hashes are the build's own
 * (vite.config's assetHashes, by the file's path under public/); only what's changed is fetched anew, the rest from the browser's cache as
 * ever. Everything three loads goes through its default loading manager (useGLTF's, useLoader's, the HDR lights'). None in development (the
 * dev server's files are always fresh). Imported first of all (main.tsx), before any module that preloads.
 */
declare const __ASSET_HASH__: Record<string, string> | undefined
const HASH: Record<string, string> = typeof __ASSET_HASH__ === 'object' && __ASSET_HASH__ ? __ASSET_HASH__ : {}
const BASE = import.meta.env.BASE_URL

/** an address with its file's hash on it, where the build has one for it */
export function versioned(url: string) {
  const at = url.indexOf(BASE)
  if (at < 0 || url.includes('?')) return url
  const h = HASH[url.slice(at + BASE.length)]
  return h ? `${url}?h=${h}` : url
}

if (Object.keys(HASH).length) THREE.DefaultLoadingManager.setURLModifier(versioned)
