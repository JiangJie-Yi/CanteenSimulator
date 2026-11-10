// The shop's rating (the owner's: every customer's satisfaction made into the shop's stars, as a review site shows them; the shop's sign
// clicked opens it), laid out as a map app's reviews are (the owner's, 2026-11-10: like Google's): its stars, how many reviews, the bars of
// how many gave five stars down to one, the food, the service and the place; reviews to be bought beside it; the reviews themselves in the
// order picked (most relevant, newest, highest, lowest), each with its reviewer's picture and name, a Local Guide or not and how many
// reviews they've written, its stars and how long ago, what they said, its food, service and atmosphere out of five, and how many found it
// useful (game/reputation, data/reviewers). A new game's shop has none: nought stars. A drawer out from the left edge under the sign, back again at its ×, at a click on
// nothing in the room or at Esc (the owner's), in the office's finish: its wood title bar, its glass, a section under a rule, a card each.
// Its second tab, 關於 (the owner's): the game, who makes it, its source on GitHub, and the work used in it under licence with its authors.
import { memo, useEffect, useState } from 'react'
import { CC_BY_URL, CREDITS, DEV_MODEL, DEVELOPER, DEVELOPER_URL, REPO_URL, VERSION, versionText } from '@/data/credits'
import { guestLabel } from '@/data/guests'
import { reviewerNames, reviewerProfile } from '@/data/reviewers'
import { tl, type Lang } from '@/data/i18n'
import { STORY } from '@/data/story'
import { CAPITAL, SHOP_COST } from '@/game/economy'
import { agoOf, remarkOf, REVIEW_PACKS, sortReviews, starCounts, visitSides, visitStars, type Rating, type Remark, type ReviewOrder, type Visit } from '@/game/reputation'
import { FitLine } from './FitLine'
import { ReviewerAvatar } from './ReviewerAvatar'
import { Glyph, StarIcon } from './GameIcons'

/** what a customer says as they go, a few ways each (the owner's: every one said the same line), picked by who they were and how it went */
const REMARK: Record<Remark, [string, string, string][]> = {
  great: [
    ['烤得剛剛好，太好吃了！', '焼き加減が最高、うまい！', 'Grilled just right. Delicious!'],
    ['外皮酥脆、肉汁滿滿，會再來！', '皮はパリッと身はジューシー、また来ます！', 'Crisp outside, juicy inside. I’ll be back!'],
    ['炭火香太讚了', '炭火の香りがたまらない', 'That charcoal aroma, wow'],
    ['吃得好滿足，下次帶朋友來', '大満足、今度は友達を連れてくる', 'So satisfying. Bringing friends next time'],
    ['鹹淡剛好，配酒一流', '塩加減が絶妙で酒がすすむ', 'Seasoned just right, perfect with a drink'],
    ['這才是真正的炭烤', 'これぞ本物の炭火焼', 'Now that’s real charcoal grilling'],
    ['烤魚皮脆多汁！出餐俐落', '焼き魚は皮パリでジューシー！出てくるのも早い', 'Crisp skin, juicy fish! Out quick, too'],
    ['氣氛超棒，大廚手藝一流！', '雰囲気最高、大将の腕も一流！', 'Lovely atmosphere, and the chef’s first rate!'],
  ],
  good: [
    ['好吃，會再來', 'おいしかった、また来たい', 'Good. I’ll be back'],
    ['不錯吃，價格也實在', 'なかなか、値段も手頃', 'Pretty good, fair price too'],
    ['火候掌握得不錯', '焼き具合がいい', 'Nicely cooked'],
    ['很有居酒屋的氣氛', '居酒屋らしくていい', 'Feels like a proper izakaya'],
    ['吃得很開心', '楽しく食べられた', 'Enjoyed that'],
  ],
  fine: [
    ['還可以', 'まあまあ', 'It was all right'],
    ['普普通通', '普通かな', 'Nothing special'],
    ['味道有點淡', '少し味が薄い', 'A bit bland'],
    ['再烤一下會更好', 'もう少し焼いてほしかった', 'Could’ve done with a bit longer on the fire'],
  ],
  poor: [
    ['不太好吃…', 'いまいち…', 'Not great…'],
    ['有點烤過頭了', 'ちょっと焦げてた', 'A little burnt'],
    ['跟想像的不一樣', '思ってたのと違う', 'Not what I hoped for'],
  ],
  walkedOut: [
    ['等不到餐點，走了', '料理が来なくて帰った', 'Gave up waiting and left'],
    ['等太久了，下次再說', '待ちきれない、また今度', 'Took too long. Another time'],
    ['等了半小時連杯水都沒上，絕不再來', '30分待って水一杯も出ない、二度と来ない', 'Half an hour and not even a glass of water. Never again'],
    ['出餐太慢，餓到胃痛先走了', '出てくるのが遅すぎて、空腹で胃が痛くて帰った', 'So slow I left with my stomach aching'],
  ],
  wait: [
    ['等太久了', '待たされた', 'Waited too long'],
    ['上菜好慢', '料理が出るのが遅い', 'The food was slow to come'],
    ['餓到不行才上菜', '腹ペコで待たされた', 'Starving by the time it came'],
  ],
  receipt: [
    ['結帳沒拿到發票', 'レシートをもらえなかった', 'No receipt when I paid'],
    ['發票紙用完了也不補', 'レシートの紙が切れたまま', 'Out of receipt paper, and nobody refilled it'],
    ['付了錢，連張發票都沒有', '払ったのにレシートもない', 'Paid, and not even a receipt'],
  ],
  tissue: [
    ['桌上衛生紙盒空了沒人補', '席のティッシュが空なのに誰も補充しない', 'The tissue box was empty and nobody refilled it'],
    ['抽屜裡沒有衛生紙', 'ティッシュがなかった', 'No tissues at my place'],
    ['想擦嘴卻沒有衛生紙', '口を拭くティッシュがない', 'Nothing to wipe my mouth with'],
  ],
  toilet: [
    ['廁所不乾淨', 'トイレが汚かった', 'The toilet wasn’t clean'],
    ['廁所該打掃了', 'トイレの掃除をしてほしい', 'The toilet needs a clean'],
  ],
  dark: [
    ['店裡暗得像鬧鬼，差點找不到位子', 'お化け屋敷みたいに暗くて、席も見つからなかった', 'Dark as a haunted house, could barely find a seat'],
    ['店裡太暗了', '店が暗すぎた', 'It was too dark to eat'],
    ['暗到看不清楚菜', '暗くて料理が見えない', 'Too dark to see the food'],
  ],
  sick: [
    ['吃完肚子痛', '食べたらお腹が痛くなった', 'Got a stomach ache after'],
    ['食材好像不太新鮮', '食材が新しくなかったかも', 'Something didn’t seem fresh'],
  ],
  nothing: [
    ['沒有想吃的', '食べたいものがなかった', 'Nothing I wanted'],
    ['菜單上沒有我要的', 'メニューに欲しいのがない', 'Nothing on the menu for me'],
  ],
}
/** which of a remark's ways a visit says it: by who they were and how long they waited and how it tasted, so the same kind of visit isn't
 * always the same words */
/** what a bought review says: the bare praise such reviews are made of */
const BOUGHT: [string, string, string][] = [
  ['超讚！五星推薦！', '最高！星5つ！', 'Amazing! Five stars!'],
  ['好吃，服務好，會再來。', '美味しい、接客もいい、また来ます。', 'Tasty, great service, will come back.'],
  ['CP 值超高，大推！', 'コスパ最高、おすすめ！', 'Great value, highly recommend!'],
  ['大阪必吃的烤魚店！', '大阪で一番の焼き魚！', 'Best grilled fish in Osaka!'],
  ['完美的一餐。', '完璧な食事でした。', 'A perfect meal.'],
]
const remarkLine = (v: Visit) => {
  if (v.bought) return BOUGHT[Math.abs(v.id) % BOUGHT.length]
  const lines = REMARK[remarkOf(v)]
  return lines[Math.abs(v.id * 31 + Math.round(v.waited) * 7 + Math.round(v.taste ?? 0)) % lines.length]
}

/** five stars, filled as far as `v` (1..5) goes */
function Stars({ v, big = false }: { v: number; big?: boolean }) {
  return (
    <span className={`rep-stars${big ? ' is-big' : ''}`} aria-hidden="true">
      {/* (drawn stars, ui/GameIcons: no characters (the owner's)) */}
      <span className="rep-stars-base">{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size="1em" />)}</span>
      <span className="rep-stars-fill" style={{ width: `${Math.max(0, Math.min(1, v / 5)) * 100}%` }}>{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size="1em" />)}</span>
    </span>
  )
}

// (drawn again only when it opens or shuts, or a new visit is rated: the shop's own re-renders, several a second while it's open, pass it by)
/** each visit's own key for the list, given the first time it's shown and kept: keyed by its place, every row was made again as a new
 * review came in at the top (ninety list items a minute while the shop's busy, the drawer shut or not) */
const VISIT_KEYS = new WeakMap<object, number>()
let visitSerial = 0
const visitKey = (v: object) => { let k = VISIT_KEYS.get(v); if (k === undefined) { k = ++visitSerial; VISIT_KEYS.set(v, k) } return k }

/** the orders the reviews can be read in, as a map app names them */
const ORDERS: [ReviewOrder, string, string, string][] = [
  ['relevant', '最相關', '関連度順', 'Most relevant'], ['newest', '最新', '新しい順', 'Newest'],
  ['highest', '評分最高', '評価の高い順', 'Highest'], ['lowest', '評分最低', '評価の低い順', 'Lowest'],
]
/** how long ago, in the page's language */
function agoText(a: ReturnType<typeof agoOf>, lang: Lang) {
  if (a.unit === 'today') return tl(lang, '今天', '今日', 'today')
  const en = (w: string) => `${a.n} ${w}${a.n === 1 ? '' : 's'} ago`
  if (a.unit === 'day') return tl(lang, `${a.n} 天前`, `${a.n}日前`, en('day'))
  if (a.unit === 'week') return tl(lang, `${a.n} 週前`, `${a.n}週間前`, en('week'))
  return tl(lang, `${a.n} 個月前`, `${a.n}か月前`, en('month'))
}
/** a review's food, service and atmosphere out of five, as a restaurant's review shows them */
function sidesText(s: ReturnType<typeof visitSides>, lang: Lang) {
  const parts: [string, string, string, number | null][] = [['料理', '料理', 'Food', s.food], ['服務', 'サービス', 'Service', s.service], ['環境', '雰囲気', 'Atmosphere', s.place]]
  return parts.filter(([, , , v]) => v !== null).map(([zh, ja, en, v]) => `${tl(lang, zh, ja, en)}：${v}/5`).join('｜')
}
/** how many reviews show at once (the drawer scrolls) */
const SHOWN = 20

export const Reputation = memo(function Reputation({ open, lang, rating, visits, today, cash, onBuy, onClose }:
  { open: boolean; lang: Lang; rating: Rating; visits: Visit[]; today: number; cash: number; onBuy: (pack: number) => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  const title = tl(lang, '店家評價', 'お店の評価', 'The shop’s rating')
  const [tab, setTab] = useState<'rating' | 'about'>('rating')
  const [order, setOrder] = useState<ReviewOrder>('relevant')
  const [buying, setBuying] = useState(false)
  // (the reviews this player found useful, a thumb up each: theirs alone, not kept)
  const [liked, setLiked] = useState<ReadonlySet<number>>(() => new Set())
  const pick = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const parts: [string, number | null][] = [
    [tl(lang, '料理', '料理', 'Food'), rating.food],
    [tl(lang, '服務', 'サービス', 'Service'), rating.service],
    [tl(lang, '環境', '店内', 'The place'), rating.place],
  ]
  const counts = starCounts(visits), most = Math.max(1, ...counts)
  const shown = sortReviews(visits, order).slice(0, SHOWN)
  const names = reviewerNames(shown.map((v) => v.id))
  const stars = rating.stars ?? 0
  return (
    <section className={`rep-drawer${open ? ' is-open' : ''}`} role="dialog" aria-label={title} aria-hidden={!open} inert={!open}>
      <header>
        <nav className="rep-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'rating'} onClick={() => setTab('rating')}>{title}</button>
          <button type="button" role="tab" aria-selected={tab === 'about'} onClick={() => setTab('about')}>{pick('關於', 'このゲームについて', 'About')}</button>
        </nav>
        <button type="button" className="panel-x" onClick={onClose} aria-label={tl(lang, '關閉', '閉じる', 'Close')}>×</button>
      </header>
      <div className="rep-body">
        {tab === 'about' ? (
          <>
            {/* (the story first (the owner's): him come alone to Osaka, the money he came with set out as a page of his ledger (the game's
                own amounts), what every day costs; a sheet of washi with the shop's seal, its last line in the shop's red) */}
            <article className="rep-story" lang={lang === 'zh' ? 'zh-Hant' : lang}>
              <header>
                <div><h3>{STORY[lang].title}</h3><small>{STORY[lang].sub}</small></div>
                <span className="rep-seal" aria-hidden="true">聞野</span>
              </header>
              <p>{STORY[lang].open}</p>
              <dl className="rep-ledger">
                <dt>{STORY[lang].ledger[0]}</dt><dd>NT${CAPITAL.toLocaleString('en-US')}</dd>
                <dt>{STORY[lang].ledger[1]}</dt><dd>−NT${SHOP_COST.toLocaleString('en-US')}</dd>
                <dt>{STORY[lang].ledger[2]}</dt><dd>NT${(CAPITAL - SHOP_COST).toLocaleString('en-US')}</dd>
              </dl>
              {STORY[lang].body.map((t) => <p key={t}>{t}</p>)}
              <p className="rep-story-end">{STORY[lang].end}</p>
            </article>
            {/* (who makes it, where its source is, which build, what with: the rows alone (the owner's, 2026-11-10: the game's name and a line
                on what it is taken off the top), spaced out a little) */}
            <div className="rep-about">
              <dl>
                <dt>{pick('開發者', '開発', 'Developer')}</dt><dd><a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">{DEVELOPER}</a></dd>
                {/* (each on one line, set smaller if it must be (the owner's: nothing on two lines): the addresses without their https://
                    and the end slash, the model and the tools each a line of its own) */}
                <dt>GitHub</dt><dd><FitLine><a href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_URL.replace(/^https:\/\/|\/$/g, '')}</a></FitLine></dd>
                {/* (the site's: v and its number; run here, on the developer's own machine, not a version at all: the build and its commit) */}
                <dt>{pick('版本', 'バージョン', 'Version')}</dt><dd>{versionText(VERSION, pick('開發版', '開発版', 'Dev build'))}</dd>
                <dt>{pick('開發模型', '開発モデル', 'Model')}</dt><dd><FitLine>{DEV_MODEL}（Anthropic）</FitLine></dd>
                {/* (what it's made with, as its development tools (the owner's: one line, where 製作 was; Claude Code's line taken off)) */}
                <dt>{pick('開發工具', '開発ツール', 'Tools')}</dt><dd><FitLine>React・three.js・Vite・Blender</FitLine></dd>
              </dl>
            </div>
            {/* (the work used under a licence that asks for its author to be named: each its own card, what was changed in it said) */}
            <h4>{pick('使用的模型', '使用したモデル', 'Models used')}<small>{CREDITS.length}</small></h4>
            <ul className="rep-credits">
              {CREDITS.map((c) => (
                <li key={c.title}>
                  <span className="rep-credit-what">{pick(c.what.zh, c.what.ja, c.what.en)}</span>
                  <b>「{c.title}」</b>
                  <span>by {c.author}</span>
                  <small><a href={CC_BY_URL} target="_blank" rel="noopener noreferrer">{c.licence}</a>・{c.from}・{pick(c.changed.zh, c.changed.ja, c.changed.en)}</small>
                </li>
              ))}
            </ul>
            <p className="rep-note">{pick('其餘的模型、貼圖與介面都是為這個遊戲做的（模型用 Blender 的程式產生）。',
              'それ以外のモデル・テクスチャ・画面はこのゲームのために作ったもの（モデルは Blender のスクリプトで生成）。',
              'Every other model, picture and screen was made for this game (the models by scripts in Blender).')}</p>
          </>
        ) : (
          <>
            {/* (the shop's stars, big, its count of reviews under them; beside them how many gave five stars down to one; the food, the
                service and the place under both; a new shop's: nought) */}
            <div className="rep-sum">
              <div className="rep-score">
                <strong>{stars.toFixed(1)}</strong>
                <Stars v={stars} big />
                <small>{tl(lang, `${rating.n} 則評論`, `クチコミ ${rating.n} 件`, `${rating.n} reviews`)}</small>
              </div>
              <ol className="rep-bars" aria-label={tl(lang, '星數分布', '評価の内訳', 'Stars given')}>
                {counts.map((c, i) => (
                  <li key={i}><span>{5 - i}</span><i><b style={{ width: `${(c / most) * 100}%` }} /></i></li>
                ))}
              </ol>
              <ul className="rep-parts">
                {parts.map(([name, v]) => (
                  <li key={name}><span>{name}</span><Stars v={v ?? 0} /><b>{v === null ? '—' : v.toFixed(2)}</b></li>
                ))}
              </ul>
            </div>
            {/* (reviews to be bought (the owner's): three packs, the cash it takes; booked as promotion) */}
            <div className="rep-buy">
              <button type="button" className="rep-buy-open" aria-expanded={buying} onClick={() => setBuying((b) => !b)}>
                {tl(lang, '花錢買評價', 'クチコミを買う', 'Buy reviews')}
              </button>
              {buying && (
                <ul className="rep-packs">
                  {REVIEW_PACKS.map((pk, i) => (
                    <li key={pk.n}>
                      <span>{tl(lang, `${pk.n} 則好評`, `高評価 ${pk.n} 件`, `${pk.n} good reviews`)}</span>
                      <b className="money">NT${pk.cost.toLocaleString('en-US')}</b>
                      <button type="button" disabled={cash < pk.cost} title={cash < pk.cost ? tl(lang, '現金不足', 'お金が足りない', 'Not enough cash') : undefined}
                        onClick={() => onBuy(i)}>{tl(lang, '購買', '買う', 'Buy')}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <h4>{tl(lang, '評論', 'クチコミ', 'Reviews')}<small>{rating.n}</small></h4>
            <nav className="rep-sort" aria-label={tl(lang, '排序', '並べ替え', 'Sort')}>
              {ORDERS.map(([k, zh, ja, en]) => (
                <button key={k} type="button" aria-pressed={order === k} onClick={() => setOrder(k)}>{tl(lang, zh, ja, en)}</button>
              ))}
            </nav>
            {shown.length === 0 ? (
              <p className="rep-empty">{tl(lang, '還沒有評論：開店迎客吧（也可以花錢買幾則）。', 'まだクチコミがない。お店を開けよう（買うこともできる）。', 'No reviews yet: open up and let them in (or buy a few).')}</p>
            ) : (
              <ul className="rep-recent">
                {shown.map((v, i) => {
                  const [zh, ja, en] = remarkLine(v), prof = reviewerProfile(v.id), mine = liked.has(v.id)
                  const useful = prof.useful + (mine ? 1 : 0)
                  return (
                    <li key={visitKey(v)}>
                      {/* (their picture and the name they review under, a Local Guide or not and how many they've written (data/reviewers);
                          what kind of customer they were a small tag by the name) */}
                      <ReviewerAvatar id={v.id} name={names[i]} />
                      <span className="rep-who">{names[i]}{!v.bought && <small className="rep-kind">{guestLabel(v.id, lang)}</small>}</span>
                      <small className="rep-meta">
                        {prof.guide ? tl(lang, '在地嚮導・', 'ローカルガイド・', 'Local Guide · ') : ''}
                        {tl(lang, `${prof.reviews} 則評論`, `クチコミ ${prof.reviews} 件`, `${prof.reviews} reviews`)}
                      </small>
                      <span className="rep-when"><Stars v={visitStars(v)} /><small>{agoText(agoOf(v.day, today), lang)}</small></span>
                      <span className="rep-said">{tl(lang, zh, ja, en)}</span>
                      <small className="rep-sides">{sidesText(visitSides(v), lang)}</small>
                      <button type="button" className="rep-like" aria-pressed={mine}
                        onClick={() => setLiked((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n })}>
                        <Glyph id="thumb" size={13} />{tl(lang, '實用', '役に立った', 'Helpful')}{useful ? ` ${useful}` : ''}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="rep-note">{tl(lang, '最近 60 位客人（越近的越重）：料理 45%、服務 35%、環境 20%。沒吃就走的給 1 星。評價會影響來客：4.6 以上客人多五成，2.5 以下只剩三成。',
              '最近 60 人（新しいほど重い）：料理 45%・サービス 35%・雰囲気 20%。食べずに帰った客は星 1。評価は客足に響く：4.6 以上で 5 割増、2.5 未満で 3 割に。',
              'The latest 60 customers, newer counting more: food 45%, service 35%, the place 20%. Walked out without eating: one star. The rating brings them in: 4.6 and up, half as many again; under 2.5, a third.')}</p>
          </>
        )}
      </div>
    </section>
  )
})
