import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="font-semibold text-brand">
        Back to home
      </Link>
    </div>
  )
}
