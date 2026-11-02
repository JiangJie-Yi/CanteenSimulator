// The shop's rating (the owner's: every customer's satisfaction made into the shop's stars, as a review site shows them; the shop's sign
// clicked opens it): its stars and how many have rated it, the food, the service and the place each on its own, and what the latest
// customers said as they went (game/reputation). A drawer out from the left edge under the sign, back again at its ×, at a click on
// nothing in the room or at Esc (the owner's), in the office's finish: its wood title bar, its glass, a section under a rule, a card each.
// Its second tab, 關於 (the owner's): the game, who makes it, its source on GitHub, and the work used in it under licence with its authors.
import { memo, useEffect, useState } from 'react'
import { CC_BY_URL, CREDITS, DEV_MODEL, DEVELOPER, DEVELOPER_URL, REPO_URL, SITE_URL, VERSION } from '@/data/credits'
import { guestLabel } from '@/data/guests'
import { tl, type Lang } from '@/data/i18n'
import { remarkOf, satisfaction, starsOf, type Rating, type Remark, type Visit } from '@/game/reputation'
import { FitLine } from './FitLine'
import { ReviewerAvatar } from './ReviewerAvatar'

/** what a customer says as they go, a few ways each (the owner's: every one said the same line), picked by who they were and how it went */
const REMARK: Record<Remark, [string, string, string][]> = {
  great: [
    ['烤得剛剛好，太好吃了！', '焼き加減が最高、うまい！', 'Grilled just right. Delicious!'],
    ['外皮酥脆、肉汁滿滿，會再來！', '皮はパリッと身はジューシー、また来ます！', 'Crisp outside, juicy inside. I’ll be back!'],
    ['炭火香太讚了', '炭火の香りがたまらない', 'That charcoal aroma, wow'],
    ['吃得好滿足，下次帶朋友來', '大満足、今度は友達を連れてくる', 'So satisfying. Bringing friends next time'],
    ['鹹淡剛好，配酒一流', '塩加減が絶妙で酒がすすむ', 'Seasoned just right, perfect with a drink'],
    ['這才是真正的炭烤', 'これぞ本物の炭火焼', 'Now that’s real charcoal grilling'],
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
  ],
  wait: [
    ['等太久了', '待たされた', 'Waited too long'],
    ['上菜好慢', '料理が出るのが遅い', 'The food was slow to come'],
    ['餓到不行才上菜', '腹ペコで待たされた', 'Starving by the time it came'],
  ],
  tissue: [
    ['抽屜裡沒有衛生紙', 'ティッシュがなかった', 'No tissues at my place'],
    ['想擦嘴卻沒有衛生紙', '口を拭くティッシュがない', 'Nothing to wipe my mouth with'],
  ],
  toilet: [
    ['廁所不乾淨', 'トイレが汚かった', 'The toilet wasn’t clean'],
    ['廁所該打掃了', 'トイレの掃除をしてほしい', 'The toilet needs a clean'],
  ],
  dark: [
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
const remarkLine = (v: Visit) => {
  const lines = REMARK[remarkOf(v)]
  return lines[Math.abs(v.id * 31 + Math.round(v.waited) * 7 + Math.round(v.taste ?? 0)) % lines.length]
}

/** five stars, filled as far as `v` (1..5) goes */
function Stars({ v, big = false }: { v: number; big?: boolean }) {
  return (
    <span className={`rep-stars${big ? ' is-big' : ''}`} aria-hidden="true">
      <span className="rep-stars-base">★★★★★</span>
      <span className="rep-stars-fill" style={{ width: `${Math.max(0, Math.min(1, v / 5)) * 100}%` }}>★★★★★</span>
    </span>
  )
}

// (drawn again only when it opens or shuts, or a new visit is rated: the shop's own re-renders, several a second while it's open, pass it by)
export const Reputation = memo(function Reputation({ open, lang, rating, visits, onClose }:
  { open: boolean; lang: Lang; rating: Rating; visits: Visit[]; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  const title = tl(lang, '店家評價', 'お店の評価', 'The shop’s rating')
  const [tab, setTab] = useState<'rating' | 'about'>('rating')
  const pick = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const parts: [string, number | null][] = [
    [tl(lang, '料理', '料理', 'Food'), rating.food],
    [tl(lang, '服務', 'サービス', 'Service'), rating.service],
    [tl(lang, '環境', '店内', 'The place'), rating.place],
  ]
  const latest = visits.slice(-6).reverse()
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
            {/* (the game, who makes it, and where its source is) */}
            <div className="rep-about">
              <strong>{pick('聞野・日式烤魚', '聞野・炭火焼の魚', 'Kikuno · Japanese Grill')}</strong>
              <p>{pick('在瀏覽器裡玩的日式烤魚店經營遊戲：試做、開店、雇人，看客人吃得開不開心。',
                'ブラウザで遊ぶ炭火焼の店の経営ゲーム。試作し、店を開き、人を雇い、お客さんの顔を見る。',
                'A Japanese charcoal grill to run in the browser: try dishes out, open up, hire staff, and watch how the customers like it.')}</p>
              <dl>
                <dt>{pick('開發者', '開発', 'Developer')}</dt><dd><a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">{DEVELOPER}</a></dd>
                {/* (each on one line, set smaller if it must be (the owner's: nothing on two lines): the addresses without their https://
                    and the end slash, the model and the tool each a line of its own) */}
                <dt>GitHub</dt><dd><FitLine><a href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_URL.replace(/^https:\/\/|\/$/g, '')}</a></FitLine></dd>
                <dt>{pick('線上遊玩', 'プレイ', 'Play')}</dt><dd><FitLine><a href={SITE_URL} target="_blank" rel="noopener noreferrer">{SITE_URL.replace(/^https:\/\/|\/$/g, '')}</a></FitLine></dd>
                <dt>{pick('版本', 'バージョン', 'Version')}</dt><dd>v{VERSION}</dd>
                <dt>{pick('開發模型', '開発モデル', 'Model')}</dt><dd><FitLine>{DEV_MODEL}（Anthropic）</FitLine></dd>
                <dt>{pick('開發工具', '開発ツール', 'Tool')}</dt><dd>Claude Code</dd>
                <dt>{pick('製作', '制作', 'Made with')}</dt><dd><FitLine>React・three.js・Vite・Blender</FitLine></dd>
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
        ) : rating.stars === null ? (
          <p className="rep-empty">{tl(lang, '還沒有客人評價：開店迎客吧。', 'まだ評価がない。お店を開けよう。', 'No one’s rated it yet: open up and let them in.')}</p>
        ) : (
          <>
            {/* (the shop's stars on the left, big; the food, the service and the place each beside them) */}
            <div className="rep-sum">
              <div className="rep-score">
                <strong>{rating.stars.toFixed(2)}</strong>
                <Stars v={rating.stars} big />
                <small>{tl(lang, `${rating.n} 則評價`, `${rating.n} 件の評価`, `${rating.n} ratings`)}</small>
              </div>
              <ul className="rep-parts">
                {parts.map(([name, v]) => (
                  <li key={name}><span>{name}</span><Stars v={v ?? 0} /><b>{v === null ? '—' : v.toFixed(2)}</b></li>
                ))}
              </ul>
            </div>
            <h4>{tl(lang, '最近的客人說', '最近のお客さんの声', 'What the latest said')}<small>{latest.length}</small></h4>
            <ul className="rep-recent">
              {latest.map((v, i) => {
                const sat = satisfaction(v)
                const [zh, ja, en] = remarkLine(v)
                return (
                  <li key={`${v.id}-${i}`}>
                    {/* (their profile picture, as a map app's reviews have them (the owner's: not an emoji): game/avatars) */}
                    <ReviewerAvatar id={v.id} name={guestLabel(v.id, lang)} />
                    <span className="rep-who">{guestLabel(v.id, lang)}<Stars v={starsOf(sat)} /></span>
                    <span className="rep-said">「{tl(lang, zh, ja, en)}」</span>
                  </li>
                )
              })}
            </ul>
            <p className="rep-note">{tl(lang, '最近 60 位客人的滿意度（越近的越重）：美味、等候時間、衛生紙、廁所、燈光、身體狀況都算。',
              '最近 60 人の満足度（新しいほど重い）：味・待ち時間・ティッシュ・トイレ・照明・体調。',
              'The latest 60 customers’ satisfaction, newer counting more: the food, the wait, the tissues, the toilet, the light, how they felt after.')}</p>
          </>
        )}
      </div>
    </section>
  )
})
