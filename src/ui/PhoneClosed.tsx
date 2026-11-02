// At a phone's size the grill is drawn flat (Grill2D), and that isn't open yet (the owner's): a card over everything saying so, in the
// office's finish (its wood title, its glass), with where to play it instead
import { createPortal } from 'react-dom'
import { tl, type Lang } from '@/data/i18n'

/** (put straight into the page's body: inside the stage it sat under the corner's buttons, whose layer is above the stage's) */
export function PhoneClosed({ lang }: { lang: Lang }) {
  return createPortal(
    <div className="phone-closed" role="alertdialog" aria-labelledby="phone-closed-title">
      <div className="phone-closed-card">
        <header><b>聞野</b><small>{tl(lang, '日式烤魚', '炭火焼の魚', 'Charcoal Grill')}</small></header>
        <div className="phone-closed-body">
          <h2 id="phone-closed-title">{tl(lang, '手機版（2D）暫不開放', 'スマホ版（2D）は準備中です', 'The phone (2D) version isn’t open yet')}</h2>
          <p>{tl(lang, '請用電腦開啟，或把平板、瀏覽器的視窗放大一些。', 'パソコンで開くか、タブレットやブラウザの画面を大きくしてください。',
            'Please open it on a computer, or make the tablet or browser window larger.')}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
