import { Link } from 'react-router-dom'

// Small shared building blocks so screens stay consistent.

export function Card({ className = '', children }) {
  return <section className={`rounded-2xl bg-surface p-5 ${className}`}>{children}</section>
}

export function PrimaryButton({ className = '', ...props }) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-brand px-4 py-3 font-semibold text-on-brand transition-colors disabled:bg-raised disabled:text-muted ${className}`}
    />
  )
}

export function SecondaryButton({ className = '', ...props }) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-raised px-4 py-3 font-semibold transition hover:brightness-125 disabled:opacity-50 ${className}`}
    />
  )
}

export function TextField({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-xl border border-transparent bg-sunken px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function TextArea({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        {...props}
        className="mt-1.5 w-full resize-none rounded-xl border border-transparent bg-sunken px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden="true">←</span> {children}
    </Link>
  )
}

export function Badge({ children }) {
  return (
    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink">
      {children}
    </span>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
    </div>
  )
}
