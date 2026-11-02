// The reviewers' profile pictures (ui/ReviewerAvatar, made up by game/avatars) large on one page, to look them over: the first `N` ids, and
// one of every pet's coat and every view's time of day:
//   npx vite-node tests/visual/avatarsheet.tsx <out.html> [N]      (then open it in a browser)
import { writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { avatarOf, COATS, PETS, SCENES } from '@/game/avatars'
import { ReviewerAvatar } from '@/ui/ReviewerAvatar'

const N = Number(process.argv[3] ?? 48)
const NAMES = ['上班族', '大學生', '小學生', '老爺爺', '不良少年', '浴衣姐姐', 'Office lady', '女僕']
// (ids for each pet's every coat and each view's every time: searched for among the first many)
const want = new Map<string, number>()
for (let id = 1; id < 20000 && want.size < PETS.reduce((n, p) => n + COATS[p], 0) + SCENES.length * 3; id++) {
  const a = avatarOf(id)
  const key = a.kind === 'pet' ? `${a.pet}-${a.coat}` : a.kind === 'scene' ? `${a.scene}-${a.time}` : ''
  if (key && !want.has(key)) want.set(key, id)
}
const cell = (id: number, label: string) => <div key={`${id}${label}`} className="cell"><ReviewerAvatar id={id} name={NAMES[id % NAMES.length]} size={120} /><div>{label}</div></div>
const cells = renderToStaticMarkup(<>
  {Array.from({ length: N }, (_, i) => cell(i + 1, `${i + 1} ${avatarOf(i + 1).kind}`))}
  {[...want.entries()].sort().map(([k, id]) => cell(id, k))}
</>)
writeFileSync(process.argv[2] ?? 'avatarsheet.html', `<!doctype html><meta charset="utf-8"><title>評價頭貼</title>
<style>body{margin:0;background:#efe7d8;font-family:sans-serif}.grid{display:grid;grid-template-columns:repeat(8,140px);gap:10px;padding:14px}
.cell{background:#fff;border-radius:12px;padding:8px;text-align:center;font-size:11px;color:#555}</style>
<div class="grid">${cells}</div>`)
