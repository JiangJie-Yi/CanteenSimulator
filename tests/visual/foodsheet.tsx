// Every food's picture (ui/FoodArt) large on one page, to look them over:
//   npx vite-node tests/visual/foodsheet.tsx <out.html>      (then open it in a browser)
import { writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { FoodArt } from '@/ui/FoodArt'

const IDS = ['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Hokke', 'Buri', 'Nodoguro', 'Salmon', 'Gindara', 'ShrimpSkewer',
  'Yakitori', 'PorkBelly', 'BloodCake', 'Squid', 'Scallop', 'Shishito', 'Okra', 'Asparagus', 'KingOyster', 'GrilledShiitake', 'GrilledCorn',
  'Potato', 'SweetPotato', 'Sausage', 'Onigiri', 'NetMochi', 'MisoSoup', 'Sake', 'Onion', 'Negi', 'Carrot', 'Gobo', 'Daikon', 'RiceBag']
// (all in one render, so each picture's gradients and clips get ids of their own)
const cells = renderToStaticMarkup(<>{IDS.map((id) => <div key={id} className="cell"><FoodArt id={id} store="frozen" band /><div>{id}</div></div>)}</>)
writeFileSync(process.argv[2] ?? 'foodsheet.html', `<!doctype html><meta charset="utf-8"><title>食材插畫</title>
<style>body{margin:0;background:#e9eef2;font-family:sans-serif}.grid{display:grid;grid-template-columns:repeat(4,300px);gap:14px;padding:14px}
.cell{background:#fff;border-radius:12px;padding:8px;text-align:center;font-size:13px;color:#555}.cell svg{width:280px;height:200px}</style>
<div class="grid">${cells}</div>`)
