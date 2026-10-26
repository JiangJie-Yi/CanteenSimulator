import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Lang } from '@/data/i18n'
import { REGISTER_MANUAL } from '@/data/registerManual'

/** whether the register's manual is open (opened by clicking the booklet under the till) */
let open = false
const subs = new Set<() => void>()
const set = (v: boolean) => { open = v; subs.forEach((f) => f()) }
export const openRegisterManual = () => set(true)
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => open)

/** the manual, opened: a booklet's pages, one at a time, turned with the arrows, shut with × or Esc or a click outside */
export function RegisterManual({ lang }: { lang: Lang }) {
  const isOpen = useOpen()
  const [page, setPage] = useState(0)
  // (Esc shuts it; the arrow keys turn the pages)
  useEffect(() => {
    if (!isOpen) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set(false)
      if (e.key === 'ArrowRight') setPage((n) => Math.min(REGISTER_MANUAL.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setPage((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [isOpen])
  if (!isOpen) return null
  const p = REGISTER_MANUAL[page]
  const last = REGISTER_MANUAL.length - 1
  return (
    <div className="reg-manual-veil" onClick={() => set(false)} role="presentation">
      <div className="reg-manual" role="dialog" aria-label={lang === 'ja' ? 'レジスター取扱説明書' : '收銀機操作說明書'} onClick={(e) => e.stopPropagation()}>
        <header>
          <span>{lang === 'ja' ? 'レジスター 取扱説明書' : '收銀機操作說明書'}</span>
          <button type="button" onClick={() => set(false)} aria-label={lang === 'ja' ? '閉じる' : '關閉'}>×</button>
        </header>
        <h3>{p.title[lang]}</h3>
        <dl>
          {p.steps.map((s, i) => (
            <div key={i}>
              <dt><kbd>{s.keys}</kbd></dt>
              <dd>{s.text[lang]}</dd>
            </div>
          ))}
        </dl>
        <footer>
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
          <span>{page + 1} / {last + 1}</span>
          <button type="button" disabled={page === last} onClick={() => setPage(page + 1)}>›</button>
        </footer>
      </div>
    </div>
  )
}
