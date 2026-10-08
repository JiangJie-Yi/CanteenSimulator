import { useState } from 'react'
import type { Lang } from '../i18n'

/**
 * The first time in: the owner gives their name, then founds the business (創業). Only then does the shop sign
 * light up. Shown again after 重新開始.
 */
export function Welcome({ lang, onStart }: { lang: Lang; onStart: (name: string) => void }) {
  const [name, setName] = useState('')
  const [step, setStep] = useState<'name' | 'found'>('name')
  const ja = lang === 'ja'
  const ok = name.trim().length > 0
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={ja ? 'ようこそ' : '歡迎'}>
      <div className="welcome-card">
        <h2>{ja ? '食堂シミュレーター' : '食堂模擬器'}</h2>
        {step === 'name' ? (
          <form onSubmit={(e) => { e.preventDefault(); if (ok) setStep('found') }}>
            <label>
              <span>{ja ? 'オーナーのお名前は？' : '老闆，請問怎麼稱呼？'}</span>
              <input autoFocus maxLength={12} value={name} onChange={(e) => setName(e.target.value)}
                placeholder={ja ? '名前を入力' : '輸入你的名字'} />
            </label>
            <button type="submit" disabled={!ok}>{ja ? '次へ' : '下一步'}</button>
          </form>
        ) : (
          <div className="welcome-found">
            <p>{ja ? `${name.trim()} さん、資金は NT$300,000。` : `${name.trim()} 老闆，你手上有 NT$300,000 的資本。`}</p>
            <p className="welcome-sub">{ja ? '店は一軒 NT$150,000 で開業。看板をタップして始めよう。' : '開一間店要 NT$150,000，點店門口的招牌就能開業。'}</p>
            <button type="button" className="welcome-go" onClick={() => onStart(name.trim())}>{ja ? '創業する' : '創業'}</button>
            <button type="button" className="welcome-back" onClick={() => setStep('name')}>{ja ? '戻る' : '返回'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
