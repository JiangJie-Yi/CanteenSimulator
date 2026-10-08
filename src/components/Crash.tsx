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
