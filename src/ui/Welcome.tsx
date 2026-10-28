import { CREDITS } from '@/data/credits'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'

/**
 * The first time in: the owner founds the business (創業). Only then does the shop sign light up. Shown again
 * after 重新開始. (The owner isn't asked their name for now: they're just 老闆.)
 */
export function Welcome({ lang, onStart, capital, shopCost }:
  { lang: Lang; onStart: (name: string) => void; capital: number; shopCost: number }) {
  const ja = lang === 'ja'
  const nt = (n: number) => `NT$${n.toLocaleString()}`
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={tl(lang, '歡迎', 'ようこそ', 'Welcome')}>
      <div className="welcome-card">
        <h2>{tl(lang, '日式燒烤模擬器', '炭火焼きシミュレーター', 'Japanese Grill Simulator')}</h2>
        <div className="welcome-found">
          <p>{tl(lang, `老闆，你手上有 ${nt(capital)} 的資本。`, `オーナー、資金は ${nt(capital)}。`, `Boss, you have ${nt(capital)} to start with.`)}</p>
          <p className="welcome-sub">{tl(lang, `開一間店要 ${nt(shopCost)}，點畫面中間的「開業」就能開店。`, `店は一軒 ${nt(shopCost)} で開業。画面中央の「開業」から始めよう。`, `A shop costs ${nt(shopCost)} to open: tap Open in the middle of the screen to begin.`)}</p>
          <button type="button" className="welcome-go" autoFocus onClick={() => onStart('')}>{tl(lang, '創業', '創業する', 'Start')}</button>
        </div>
        <p className="welcome-credits">
          {CREDITS.map((c) => `${c.what[ja ? 'ja' : 'zh']}：「${c.title}」 by ${c.author}（${c.licence}、${c.from}）`).join(' ／ ')}
        </p>
      </div>
    </div>
  )
}
