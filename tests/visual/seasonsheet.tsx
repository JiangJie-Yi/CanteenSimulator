// Every seasoning's picture (ui/SeasoningArt) large on one page, to look them over:
//   npx vite-node tests/visual/seasonsheet.tsx <out.html>      (then open it in a browser)
import { writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { SEASONINGS } from '@/data/recipes'
import { SeasoningArt } from '@/ui/SeasoningArt'

const cells = renderToStaticMarkup(<>{SEASONINGS.map((k) => <div key={k} className="cell"><SeasoningArt k={k} /><div>{k}</div></div>)}</>)
writeFileSync(process.argv[2] ?? 'seasonsheet.html', `<!doctype html><meta charset="utf-8"><title>調味料插畫</title>
<style>body{margin:0;background:#f4ecdf;font-family:sans-serif}.grid{display:grid;grid-template-columns:repeat(5,200px);gap:14px;padding:14px}
.cell{background:#fff;border-radius:12px;padding:8px;text-align:center;font-size:13px;color:#555}.cell svg{width:180px;height:180px}</style>
<div class="grid">${cells}</div>`)
