export function FullScreenSpinner() {
  return (
    <div className="flex min-h-full items-center justify-center" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />
    </div>
  )
}

export function FullScreenMessage({ title, body, children }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        {body && <p className="mt-2 text-sm text-muted">{body}</p>}
        {children}
      </div>
    </div>
  )
}
