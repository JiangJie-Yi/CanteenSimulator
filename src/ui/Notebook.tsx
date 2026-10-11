import { useEffect, useRef, useState } from 'react'
import { CHEF_TALK } from '@/data/chefTalk'
import type { Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { findItem, MENU_MAX, MENU_MIN, partName, recipeKey, SEASON_NAME, signature, suggestPrice,
  type Entry, type Part } from '@/data/recipes'
import { starText } from '@/game/taste'
import type { Notes, Talk, Try } from '@/game/types'



const DONE: Record<Lang, string[]> = {
  zh: ['生', '半熟', '剛好', '偏老', '焦了'],
  ja: ['生', '半生', 'ちょうど', '焼きすぎ', '焦げ'],
}
export const donenessWord = (r: number, lang: Lang) =>
  DONE[lang][r < 0.75 ? 0 : r < 1 ? 1 : r < 1.35 ? 2 : r < 1.8 ? 3 : 4]

/** the best try at each food: what the chefs are shown (they may or may not follow it) */
export const bestOf = (n: Notes[string]) => n.tries.reduce((a, b) => (b.taste > a.taste ? b : a))

/** a dish worked out by trying it: a food, cooked one way (at the grill: with these seasonings) */
type Recipe = { key: string; part: Part; best: Try; tries: number; cost: number }

type Props = {
  dish: Dish
  lang: Lang
  notes: Notes
  entries: Entry[]
  onPublish: (e: Entry) => void
  onUnpublish: (key: string) => void
  onReprice: (key: string, price: number) => void
  /** what a part costs to make (the food and what goes on it) */
  partCost: (p: Part) => number
  /** the hired chef who can be asked (null: nobody to ask yet) */
  chef: string | null
  /** what's been said with him, and saying something to him (he answers, and cooks what he's asked) */
  talk: Talk[]
  onTalk: (text: string) => void
}

const t = (lang: Lang, zh: string, ja: string) => (lang === 'ja' ? ja : zh)

/**
 * 料理研製 (a tab of the office window, beside 人事): what's been tried with the shop closed, as dishes — at the grill a food with its seasonings is a dish of
 * its own (鹽烤玉米, 醬刷玉米…) — each with its best try; any of them can be put on the menu at a price. The menu
 * tab lists what's on it (re-price, take off, make up sets), and a hired chef can be asked what's worth trying.
 */
export function Notebook({ dish, lang, notes, entries, onPublish, onUnpublish, onReprice, partCost, chef, talk, onTalk }: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<string[]>([])
  const [setName, setSetName] = useState('')
  const [draft, setDraft] = useState('')
  const T = CHEF_TALK[lang]
  const [hello] = useState(() => T.hello())
  const log = useRef<HTMLOListElement>(null)
  // (the latest line in view)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [talk.length])
  const send = (text: string) => {
    if (!text.trim()) return
    onTalk(text)
    setDraft('')
  }
  const roast = dish.roast
  // (at the grill and the bakery what goes on a food makes it a dish of its own)
  const kind = roast ? 'grill' : dish.bake ? 'bake' : 'plain'
  const seasoned = kind !== 'plain'
  const short = (id: string) => roast?.names[id] ?? findItem(dish, id)?.name ?? id

  // every way each food of this shop has been tried, by recipe
  const recipes: Recipe[] = []
  for (const [id, n] of Object.entries(notes)) {
    const item = findItem(dish, id)
    // (the grill's ready-made sets aren't a dish to work out: their parts are; a bowl of noodles that comes with its
    // beef is a dish, though)
    if (!item || (roast && (item as { includes?: object }).includes)) continue
    const by = new Map<string, Try[]>()
    for (const tr of n.tries) {
      const dabs = seasoned ? signature(tr.dabs) : []
      const k = recipeKey(id, dabs)
      by.set(k, [...(by.get(k) ?? []), tr])
    }
    for (const [k, tries] of by) {
      const dabs = seasoned ? signature(tries[0].dabs) : []
      const part: Part = { id, dabs, name: partName(item, short(id), id, dabs, 'zh', kind), ja: partName(item, short(id), id, dabs, 'ja', kind) }
      recipes.push({ key: k, part, best: tries.reduce((a, b) => (b.taste > a.taste ? b : a)), tries: tries.length, cost: partCost(part) })
    }
  }
  recipes.sort((a, b) => b.best.taste - a.best.taste)
  const onMenu = new Set(entries.map((e) => e.key))
  const full = entries.length >= MENU_MAX
  const min = MENU_MIN[dish.id] ?? 1
  const nameOf = (p: { name: string; ja: string }) => (lang === 'ja' ? p.ja : p.name)
  const priceOf = (key: string, fallback: number) => {
    const v = Number(prices[key])
    return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback
  }
  const describe = (r: Recipe) => {
    const bits: string[] = []
    if (r.best.doneness !== undefined) bits.push(donenessWord(r.best.doneness, lang))
    if (seasoned) bits.push(r.part.dabs.length ? r.part.dabs.map((k) => SEASON_NAME[lang][k]).join('＋') : t(lang, '原味', '味付けなし'))
    return bits.join('・')
  }


  const singles = entries.filter((e) => e.parts.length === 1)
  const setParts = picked.map((k) => entries.find((e) => e.key === k)).filter((e): e is Entry => !!e)
  const setSum = setParts.reduce((n, e) => n + e.price, 0)

  return (
    // (a tab of the office window: 料理研製 beside 人事)
    <div className="nb-embedded" aria-label={t(lang, '料理研製', '開発ノート')}>
          <p className="nb-summary">{t(lang, `菜單 ${entries.length}/${MENU_MAX}・至少 ${min} 樣才能營業`, `メニュー ${entries.length}/${MENU_MAX}・${min}品から営業可`)}</p>
          {/* all on one page: what's been worked out, what's on the menu, and the second chef */}
          <h4 className="nb-sec">{t(lang, '料理研製（試做過的菜）', '開発（試作した料理）')}</h4>
          {(recipes.length === 0 ? (
            <p className="notebook-empty">{t(lang, '閉店時點菜試做、調味、吃一口，做過的菜就會記在這裡，再把好吃的上架。',
              '閉店中に試作して食べると、ここに記録されます。おいしいものをメニューに。')}</p>
          ) : (
            <ul>
              {recipes.map((r) => {
                const listed = onMenu.has(r.key)
                const fallback = suggestPrice(r.cost)
                return (
                  <li key={r.key}>
                    <div className="nb-head">
                      <b>{nameOf(r.part)}</b>
                      <span className="nb-stars">{starText(r.best.taste)}</span>
                      <small>{t(lang, '美味', '美味')} {Math.round(r.best.taste)}</small>
                    </div>
                    <p>{t(lang, '最好：', 'ベスト：')}{describe(r)}・{t(lang, `試了 ${r.tries} 次`, `${r.tries}回`)}・{t(lang, '成本', '原価')} NT${r.cost}</p>
                    <div className="nb-publish">
                      {listed ? <span className="nb-listed">{t(lang, '已上架', '掲載中')}</span> : (
                        <>
                          <label>NT$<input type="number" min={1} inputMode="numeric" value={prices[r.key] ?? fallback}
                            onChange={(e) => setPrices((p) => ({ ...p, [r.key]: e.target.value }))} /></label>
                          <small>{t(lang, '毛利', '粗利')} {Math.round((1 - r.cost / priceOf(r.key, fallback)) * 100)}%</small>
                          <button type="button" disabled={full} onClick={() => onPublish({ key: r.key, shop: dish.id, name: r.part.name,
                            ja: r.part.ja, price: priceOf(r.key, fallback), parts: [r.part] })}>{t(lang, '上架', '掲載')}</button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ))}

          <h4 className="nb-sec">{t(lang, `菜單 ${entries.length}`, `メニュー ${entries.length}`)}</h4>
          {(
            <>
              {entries.length === 0 ? (
                <p className="notebook-empty">{t(lang, '菜單還是空的：在「料理研製」把做過的菜上架。', 'メニューはまだ空です。')}</p>
              ) : (
                <ul>
                  {entries.map((e) => {
                    const cost = e.parts.reduce((n, p) => n + partCost(p), 0)
                    return (
                      <li key={e.key} className="nb-entry">
                        <div className="nb-head">
                          <b>{nameOf(e)}</b>
                          {e.parts.length > 1 && <small>{e.parts.map((p) => nameOf(p)).join('＋')}</small>}
                        </div>
                        <div className="nb-publish">
                          <label>NT$<input type="number" min={1} inputMode="numeric" value={e.price}
                            onChange={(ev) => { const v = Math.round(Number(ev.target.value)); if (v > 0) onReprice(e.key, v) }} /></label>
                          <small>{t(lang, '成本', '原価')} {cost}・{t(lang, '毛利', '粗利')} {Math.round((1 - cost / e.price) * 100)}%</small>
                          <button type="button" className="nb-off" onClick={() => onUnpublish(e.key)}>{t(lang, '下架', '外す')}</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {/* make up a set from what's on the menu */}
              {singles.length >= 2 && (
                <div className="nb-set">
                  <b>{t(lang, '組套餐', 'セットを作る')}</b>
                  <div className="nb-set-picks">
                    {singles.map((e) => (
                      <label key={e.key} className={picked.includes(e.key) ? 'is-on' : ''}>
                        <input type="checkbox" checked={picked.includes(e.key)}
                          onChange={() => setPicked((p) => (p.includes(e.key) ? p.filter((x) => x !== e.key) : [...p, e.key].slice(0, 6)))} />
                        {nameOf(e)}
                      </label>
                    ))}
                  </div>
                  {setParts.length >= 2 && (
                    <div className="nb-publish">
                      <input className="nb-set-name" value={setName} placeholder={t(lang, `${setParts[0].name}套餐`, `${setParts[0].ja}セット`)}
                        onChange={(e) => setSetName(e.target.value)} maxLength={14} />
                      <label>NT$<input type="number" min={1} inputMode="numeric" value={prices.__set ?? Math.round((setSum * 0.9) / 5) * 5}
                        onChange={(e) => setPrices((p) => ({ ...p, __set: e.target.value }))} /></label>
                      <small>{t(lang, `單點合計 ${setSum}`, `単品計 ${setSum}`)}</small>
                      <button type="button" disabled={full} onClick={() => {
                        const name = setName.trim() || `${setParts[0].name}套餐`
                        onPublish({ key: `set|${picked.join(',')}|${Date.now()}`, shop: dish.id, name, ja: setName.trim() || `${setParts[0].ja}セット`,
                          price: priceOf('__set', Math.round((setSum * 0.9) / 5) * 5), parts: setParts.flatMap((e) => e.parts) })
                        setPicked([])
                        setSetName('')
                        setPrices((p) => ({ ...p, __set: '' }))
                      }}>{t(lang, '上架套餐', 'セット掲載')}</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <h4 className="nb-sec">{t(lang, '問二廚', '二番手に聞く')}</h4>
          {(
            <div className="nb-chef">
              {chef ? (
                <>
                  <ol className="nb-chat" ref={log} aria-live="polite">
                    <li className="from-chef"><b>{chef}</b>{hello}</li>
                    {talk.map((m) => (
                      <li key={m.id} className={`from-${m.from}`}>{m.from === 'chef' && <b>{chef}</b>}{m.text}</li>
                    ))}
                  </ol>
                  <form className="nb-chat-form" onSubmit={(e) => {
                    e.preventDefault()
                    send(draft)
                  }}>
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={T.placeholder} aria-label={T.placeholder} />
                    <button type="submit" disabled={!draft.trim()}>{T.send}</button>
                  </form>
                  {/* (things often said, one tap away; the cooking uses up the food) */}
                  <div className="nb-chef-acts">
                    {T.chips.map((c) => <button key={c} type="button" onClick={() => send(c)}>{c}</button>)}
                  </div>
                </>
              ) : (
                <p className="notebook-empty">{t(lang, '還沒有二廚。到「經營 › 人事」雇用廚師後，就能問他做菜的意見。',
                  'まだ二番手がいません。人事で料理人を雇うと相談できます。')}</p>
              )}
            </div>
          )}
    </div>
  )
}
