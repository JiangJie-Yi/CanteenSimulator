import { useState } from 'react'
import type { Lang } from '../i18n'

/** how one try at a food went: how good, how far cooked, what went on it */
export type Try = { taste: number; doneness?: number; dabs?: Record<string, number>; dip?: string[]; at: number }
export type Notes = Record<string, { name: string; tries: Try[] }>

export const starsOf = (taste: number) => Math.max(1, Math.min(5, Math.round(taste / 20)))
export const starText = (taste: number) => '★'.repeat(starsOf(taste)) + '☆'.repeat(5 - starsOf(taste))

const DONE: Record<Lang, string[]> = {
  zh: ['生', '半熟', '剛好', '偏老', '焦了'],
  ja: ['生', '半生', 'ちょうど', '焼きすぎ', '焦げ'],
}
export const donenessWord = (r: number, lang: Lang) =>
  DONE[lang][r < 0.75 ? 0 : r < 1 ? 1 : r < 1.35 ? 2 : r < 1.8 ? 3 : 4]

const SEASON: Record<Lang, Record<string, string>> = {
  zh: { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉', water: '水', shacha: '沙茶醬', garlic: '蒜泥', scallion: '蔥花',
    chili: '辣椒' },
  ja: { salt: '塩', soy: '醤油', milk: '練乳', peanut: 'きな粉', water: '水', shacha: 'サーチャー', garlic: 'にんにく', scallion: 'ねぎ',
    chili: '唐辛子' },
}

/** the best try at each food: what the chefs are shown (they may or may not follow it) */
export const bestOf = (n: Notes[string]) => n.tries.reduce((a, b) => (b.taste > a.taste ? b : a))

const describe = (t: Try, lang: Lang) => {
  const parts: string[] = []
  if (t.doneness !== undefined) parts.push(donenessWord(t.doneness, lang))
  const on = Object.entries(t.dabs ?? {}).filter(([, n]) => n > 0).map(([k, n]) => SEASON[lang][k] + (n > 1 ? `×${n}` : ''))
  if (t.dip?.length) on.push(...t.dip.map((k) => SEASON[lang][k] ?? k))
  parts.push(on.length ? on.join('、') : lang === 'ja' ? '味付けなし' : '沒調味')
  return parts.join('・')
}

/**
 * 試吃筆記: every food tried while the shop was closed — how many stars its best try got, how it was cooked
 * then (how far, and what went on it), and how many tries. The chefs are given these notes to cook from.
 */
export function Notebook({ notes, lang }: { notes: Notes; lang: Lang }) {
  const [open, setOpen] = useState(false)
  const rows = Object.entries(notes).sort((a, b) => bestOf(b[1]).taste - bestOf(a[1]).taste)
  return (
    <>
      <button type="button" className="notebook-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        title={lang === 'ja' ? '試食ノート' : '試吃筆記'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" fill="#e9d9b6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 3v18M4 7h4M4 12h4M4 17h4M10 8h6M10 11h6M10 14h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {rows.length > 0 && <span className="notebook-count">{rows.length}</span>}
      </button>
      {open && (
        <section className="notebook" aria-label={lang === 'ja' ? '試食ノート' : '試吃筆記'}>
          <header>
            <b>{lang === 'ja' ? '試食ノート' : '試吃筆記'}</b>
            <small>{lang === 'ja' ? '一番おいしかった焼き方を料理人に渡します（従うかは人次第）'
              : '最好吃的做法會交給師傅參考（照不照做看人）'}</small>
            <button type="button" onClick={() => setOpen(false)} aria-label="close">×</button>
          </header>
          {rows.length === 0 ? (
            <p className="notebook-empty">{lang === 'ja' ? '閉店中に試食すると、ここに記録されます' : '閉店時試吃過的食物會記在這裡'}</p>
          ) : (
            <ul>
              {rows.map(([id, n]) => {
                const best = bestOf(n)
                const last = n.tries[n.tries.length - 1]
                return (
                  <li key={id}>
                    <div className="nb-head">
                      <b>{n.name}</b>
                      <span className="nb-stars">{starText(best.taste)}</span>
                      <small>{lang === 'ja' ? '美味' : '美味'} {Math.round(best.taste)}</small>
                    </div>
                    <p>{lang === 'ja' ? 'ベスト：' : '最好：'}{describe(best, lang)}</p>
                    {n.tries.length > 1 && (
                      <p className="nb-last">{lang === 'ja' ? `最近：${describe(last, lang)}（${Math.round(last.taste)}）・${n.tries.length}回`
                        : `最近：${describe(last, lang)}（${Math.round(last.taste)}）・試了 ${n.tries.length} 次`}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
