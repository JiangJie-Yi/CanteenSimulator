// The shop gone out of business (the owner's, 2026-11-17: 「存款-10w就直接收店」): its savings down to NT$-100,000, the business stopped at
// once and this sheet over everything, in the middle of the page: the day it happened, the savings, all that came in and went out since it
// opened; nothing else can be pressed, and the one button starts the game over (App's startOver: the player's own press, as the shop
// menu's 重新開始, the only thing that clears the drinks' save).
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'
import { FitLine } from './FitLine'

const nt = (n: number) => `NT$${Math.round(n).toLocaleString('en-US')}`

export function ClosedDown({ lang, day, savings, takings, spent, onRestart }: { lang: Lang; day: number; savings: number; takings: number
  spent: number; onRestart: () => void }) {
  const t = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  return createPortal(
    <div className="closed-down-veil">
      <section className="closed-down" role="alertdialog" aria-modal="true" aria-label={t('收店', '閉店', 'Closed down')}>
        <header><h2><FitLine>{t('收店了', '店をたたみました', 'Closed for good')}</FitLine></h2></header>
        <div className="closed-down-body">
          <p className="closed-down-why"><FitLine>{t('存款跌破 NT$-100,000，店撐不下去了', '貯金が NT$-100,000 を割り、店を続けられません', "Savings under NT$-100,000: the shop can't go on")}</FitLine></p>
          <dl className="closed-down-books">
            <dt>{t('開店第幾天', '開店から', 'Day')}</dt><dd>{t(`第 ${day} 天`, `${day} 日目`, `Day ${day}`)}</dd>
            <dt>{t('存款', '貯金', 'Savings')}</dt><dd className="is-loss">{nt(savings)}</dd>
            <dt>{t('總營收', '総売上', 'Taken in all')}</dt><dd>{nt(takings)}</dd>
            <dt>{t('總支出', '総支出', 'Spent in all')}</dt><dd>{nt(spent)}</dd>
          </dl>
          <button type="button" className="closed-down-go" onClick={onRestart}><FitLine>{t('重新開始', 'はじめから', 'Start over')}</FitLine></button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
