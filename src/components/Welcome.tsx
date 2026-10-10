import type { Lang } from '../i18n'

/**
 * The first time in: the owner founds the business (創業). Only then does the shop sign light up. Shown again
 * after 重新開始. (The owner isn't asked their name for now: they're just 老闆.)
 */
export function Welcome({ lang, onStart, capital, shopCost }:
  { lang: Lang; onStart: (name: string) => void; capital: number; shopCost: number }) {
  const ja = lang === 'ja'
  const nt = (n: number) => `NT$${n.toLocaleString()}`
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={ja ? 'ようこそ' : '歡迎'}>
      <div className="welcome-card">
        <h2>{ja ? '食堂シミュレーター' : '食堂模擬器'}</h2>
        <div className="welcome-found">
          <p>{ja ? `オーナー、資金は ${nt(capital)}。` : `老闆，你手上有 ${nt(capital)} 的資本。`}</p>
          <p className="welcome-sub">{ja ? `店は一軒 ${nt(shopCost)} で開業。画面中央の「開業」から始めよう。` : `開一間店要 ${nt(shopCost)}，點畫面中間的「開業」就能開店。`}</p>
          <button type="button" className="welcome-go" autoFocus onClick={() => onStart('')}>{ja ? '創業する' : '創業'}</button>
        </div>
      </div>
    </div>
  )
}
