import { Component } from 'react'

// Last line of defence: an unexpected crash shows a friendly screen
// with a reload button instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Syncora crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-4xl" aria-hidden="true">😵‍💫</p>
          <h1 className="mt-3 text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">Reloading usually fixes it. Your data is safe.</p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-surface p-3 text-left text-xs text-muted">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-on-brand"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
