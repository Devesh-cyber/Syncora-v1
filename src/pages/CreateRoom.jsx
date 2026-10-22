import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, MAX_ROOM_DESCRIPTION, MAX_ROOM_NAME } from '../lib/rooms.js'
import { BackLink, Card, ErrorNote, PrimaryButton, TextArea, TextField } from '../components/ui.jsx'

export default function CreateRoom() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Give your room a name.')
    setBusy(true)
    setError(null)
    try {
      const id = await createRoom(name.trim(), description.trim())
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
        <h1 className="text-xl font-bold">Create a room</h1>
        <p className="mt-1 text-sm text-muted">You'll be the admin and get a code to share.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <TextField
            label="Room name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_ROOM_NAME}
            placeholder="e.g. Hackathon crew"
            autoFocus
          />
          <TextArea
            label="What's it for? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_ROOM_DESCRIPTION}
            rows={3}
            placeholder="e.g. Shipping our demo by Sunday"
            hint={`${description.length}/${MAX_ROOM_DESCRIPTION}`}
          />
          <ErrorNote>{error}</ErrorNote>
          <PrimaryButton type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create room'}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
