import { useEffect, useRef, useState } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import { GUIDE_DOTS, dotOf, guideStep, type GuideState, type GuideStep } from '@/game/firstDay'
import { FitLine } from './FitLine'
import { Glyph } from './GameIcons'
import { usePanelSound } from './uiSound'

/**
 * The first day's guide (item 175, the owner's: someone who doesn't care for games should want to play on once they see it): a little
 * card at the foot of the screen, one short line at a time, on the quickest way to the first customer; what to click next glows, the
 * deepest of the way to it that's on the screen (the fridge, then its fill-up button; the money, then the staff tab, then hire all...).
 * Each step's worked out from the shop as it is (game/firstDay), so what's done by other ways is passed over. Skipped or finished, it's
 * kept as done (game/firstDay's GUIDE_KEY).
 */
type Props = {
  lang: Lang
  /** how the shop is now (the guide's own two: whether its first and last lines have been read, it keeps itself) */
  shop: Omit<GuideState, 'introSeen' | 'outroSeen'>
  /** the first day's takings so far, for the first sale's line */
  takings: number
  /** the clock moved on to opening time (it's early, all else ready) */
  onSkipTime: () => void
  /** finished, or skipped */
  onDone: () => void
}

/** what glows for each step: the way to it, from the outside in; the deepest one on the screen glows */
const WAY: Partial<Record<GuideStep, string[]>> = {
  stock: ['.fridge-toggle', '.tally-restock.is-full'],
  hire: ['.money-chip', '.ofc-tabs button:nth-child(2)', '.ofc-hireall'],
  menu: ['.money-chip', '.ofc-tabs button:nth-child(3)', '.nb-views button:nth-child(3)', '.nb-chef-acts button:first-child'],
  open: ['.ai-toggle'],
}

const shown = (e: Element) => {
  const b = e.getBoundingClientRect()
  if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) return false
  const s = getComputedStyle(e)
  return s.visibility !== 'hidden' && s.display !== 'none' && !(e as HTMLButtonElement).disabled
}

export function FirstDayGuide({ lang, shop, takings, onSkipTime, onDone }: Props) {
  const [introSeen, setIntroSeen] = useState(false)
  const [outroSeen, setOutroSeen] = useState(false)
  const step = guideStep({ ...shop, introSeen, outroSeen })
  const open = step !== 'done'
  usePanelSound(open)
  // (finished: kept, the card gone)
  useEffect(() => { if (step === 'done') onDone() }, [step, onDone])
  // (what glows: looked for again three times a second, panels opening and shutting as the player goes)
  const glowing = useRef<Element | null>(null)
  useEffect(() => {
    const way = WAY[step]
    const put = (e: Element | null) => {
      if (glowing.current === e) return
      glowing.current?.classList.remove('guide-glow')
      e?.classList.add('guide-glow')
      glowing.current = e
    }
    if (!way) { put(null); return }
    const look = () => {
      let at: Element | null = null
      for (const sel of way) { const e = document.querySelector(sel); if (e && shown(e)) at = e }
      put(at)
    }
    look()
    const id = window.setInterval(look, 330)
    return () => { window.clearInterval(id); put(null) }
  }, [step])
  if (!open) return null
  const t = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const money = `NT$${Math.round(takings).toLocaleString()}`
  const line: Record<Exclude<GuideStep, 'done'>, [string, string]> = {
    intro: [t('歡迎來到你的烤魚店！', '焼き魚屋へようこそ！', 'Welcome to your grilled fish shop!'),
      t('你是這裡的老闆。先讓第一位客人上門吧，跟著發亮的地方點就好。', 'あなたが店主。まず最初のお客さんを迎えよう。光るところを押すだけ。',
        "You run this place. Let's get your first customer in: just click what glows.")],
    stock: [t('先進貨', 'まず仕入れ', 'Stock up first'),
      t('點發亮的冰箱，再按「補滿」', '光る冷蔵庫を押して「満タン」', 'Click the glowing fridge, then "Fill up"')],
    hire: [t('找人來幫忙', '人を雇おう', 'Hire some help'),
      t('依序點發亮的地方：錢、人事、「一鍵徵人」', '光るところを順に：お金、人事、「おまかせ採用」', 'Click what glows in turn: money, Staff, then "Hire all"')],
    menu: [t('請二廚做一份菜單', '二番手にメニューを頼もう', 'Have your cook make a menu'),
      t('依序點：廚房、料理研製、「一鍵生成菜單 10 道」', '順に：厨房、料理研究、「メニュー10品おまかせ」', 'In turn: Kitchen, Recipes, then "Make a 10-dish menu"')],
    wait: [t('都準備好了，16:30 開店', '準備完了、開店は 16:30', 'All set: the shop opens at 16:30'),
      t('不想等的話，按下面的按鈕直接到傍晚', '待ちたくなければ、下のボタンで夕方へ', "Don't want to wait? Skip to the evening below")],
    open: [t('開店！', '開店！', 'Open up!'),
      t('按右上角發亮的按鈕開店，客人就會上門', '右上の光るボタンで開店、お客さんが来る', 'Click the glowing button top right to open')],
    firstSale: [t('開店了，客人快來了', '開店、お客さんがもうすぐ', "You're open: customers are on their way"),
      t('看他們入座、點菜、吃完到櫃檯付錢', '席について、注文して、食べてレジで払う', 'Watch them sit, order, eat and pay at the till')],
    outro: [t(`第一筆收入 ${money}！`, `初めての売上 ${money}！`, `Your first takings: ${money}!`),
      t('之後每天傍晚開店；想自己烤魚，按 2 到灶台', 'これから毎日夕方に開店。自分で焼くなら 2 で炉端へ', 'Open every evening; to grill yourself, press 2 for the hearth')],
  }
  const [title, hint] = line[step]
  const dot = dotOf(step)
  return (
    <div className={`guide-card is-${step}`} role="status" aria-live="polite">
      <div className="guide-dots" aria-hidden="true">
        {GUIDE_DOTS.map((d, i) => <span key={d} className={i < dot ? 'is-done' : i === dot ? 'is-now' : ''} />)}
      </div>
      <FitLine className="guide-title">{title}</FitLine>
      <FitLine className="guide-hint">{hint}</FitLine>
      <div className="guide-acts">
        {step === 'intro' && <button type="button" className="guide-go" onClick={() => setIntroSeen(true)}>{t('開始', '始める', 'Start')}<Glyph id="arrowR" size="0.9em" /></button>}
        {step === 'wait' && <button type="button" className="guide-go" onClick={onSkipTime}>{t('直接到 16:30', '16:30 へ進む', 'Skip to 16:30')}<Glyph id="fast" size="0.9em" /></button>}
        {step === 'outro' && <button type="button" className="guide-go" onClick={() => setOutroSeen(true)}>{t('好', 'はい', 'OK')}</button>}
        {step !== 'outro' && <button type="button" className="guide-skip" onClick={onDone}>{t('略過引導', 'ガイドを閉じる', 'Skip the guide')}</button>}
      </div>
    </div>
  )
}
