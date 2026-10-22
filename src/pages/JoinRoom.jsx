import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cleanCode, formatCode, joinRoom } from '../lib/rooms.js'
import { BackLink, Card, ErrorNote, PrimaryButton } from '../components/ui.jsx'

export default function JoinRoom() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => cleanCode(params.get('code')))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.length !== 8) return setError('Room codes are 8 characters.')
    setBusy(true)
    setError(null)
    try {
      const id = await joinRoom(code)
      navigate(`/rooms/${id}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <BackLink to="/rooms">Rooms</BackLink>
      <Card>
        <h1 className="text-xl font-bold">Join a room</h1>
        <p className="mt-1 text-sm text-muted">Ask the room admin for the 8-character code.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input
            value={formatCode(code)}
            onChange={(e) => {
              setCode(cleanCode(e.target.value))
              setError(null)
            }}
            placeholder="XXXX-XXXX"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            autoFocus={!code}
            className="w-full rounded-xl border border-transparent bg-sunken px-4 py-4 text-center font-mono text-2xl font-semibold tracking-[0.2em] uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" disabled={busy || code.length !== 8} className="w-full">
            {busy ? 'Joining…' : 'Join room'}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
