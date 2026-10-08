import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches an error anywhere below it so a crash on some phone doesn't wipe the whole page blank: it shows what
 * went wrong (so it can be reported) and a button to reload. `inline` is for the 3D view, so the menu and the
 * rest of the page stay usable if only the 3D part fails.
 */
export class Crash extends Component<{ children: ReactNode; inline?: boolean }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: '' }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ where: (info.componentStack ?? '').split('\n').filter(Boolean).slice(0, 4).join(' ← ') })
    console.error(error)
  }

  render() {
    const { error, where } = this.state
    if (!error) return this.props.children
    // the browser wouldn't give a 3D context: say what to do, not a stack trace
    if (/WebGL/i.test(String(error.message))) {
      return (
        <div className={`crash${this.props.inline ? ' is-inline' : ''}`} role="alert">
          <b>這個瀏覽器現在打不開 3D 畫面</b>
          <p>多半是先前手機記憶體不足、3D 當掉過幾次，瀏覽器就暫時停用了這個網站的 3D。請把 Chrome（或這個 App）完全關掉再打開；不行的話重開手機，或改用「在 Chrome 中開啟」。菜單一樣可以點。</p>
          <button type="button" onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}>重新載入</button>
        </div>
      )
    }
    return (
      <div className={`crash${this.props.inline ? ' is-inline' : ''}`} role="alert">
        <b>{this.props.inline ? '3D 畫面出錯了' : '畫面出錯了'}</b>
        <p>請把這段截圖傳給開發者：</p>
        <code>{String(error.message || error)}</code>
        {where && <code className="crash-where">{where}</code>}
        <small>{navigator.userAgent}</small>
        <button type="button" onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}>
          重新載入
        </button>
      </div>
    )
  }
}
