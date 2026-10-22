import { useEffect, useState } from 'react'
import Sheet from '../Sheet.jsx'
import { ErrorNote, PrimaryButton, SecondaryButton, TextArea, TextField } from '../ui.jsx'
import { MAX_TASK_DESCRIPTION, MAX_TASK_TITLE } from '../../lib/tasks.js'

// Edit sheet for your own task: title, notes, due date, delete.
export default function TaskEditor({ task, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueDate(task.due_date ?? '')
    setConfirmingDelete(false)
    setError(null)
    setBusy(false)
  }, [task])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return setError('The task needs a title.')
    run(() => onSave(task, { title: title.trim(), description: description.trim(), dueDate: dueDate || null }))
  }

  return (
    <Sheet open={Boolean(task)} onClose={() => !busy && onClose()} labelledBy="task-editor-title">
      <form onSubmit={handleSave} className="space-y-4">
        <h2 id="task-editor-title" className="text-lg font-bold">
          Edit task
        </h2>
        <TextField label="Task" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TASK_TITLE} />
        <TextArea
          label="Notes (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_TASK_DESCRIPTION}
          rows={3}
          hint={`${description.length}/${MAX_TASK_DESCRIPTION}`}
        />
        <div>
          <span className="text-sm font-semibold">Due date</span>
          <div className="mt-1.5 flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-sunken px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {dueDate && (
              <button type="button" onClick={() => setDueDate('')} className="rounded-xl px-3 text-sm font-semibold text-muted hover:text-ink">
                Clear
              </button>
            )}
          </div>
        </div>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex gap-3">
          <SecondaryButton type="button" onClick={onClose} disabled={busy} className="flex-1">
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy} className="flex-1">
            {busy ? 'Saving…' : 'Save'}
          </PrimaryButton>
        </div>

        <div className="border-t border-line pt-4">
          {confirmingDelete ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm text-muted">
                Delete this task?{task?.completed_at ? ' Its completion is removed too.' : ''}
              </p>
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className="text-sm font-semibold text-muted">
                No
              </button>
              <button
                type="button"
                onClick={() => run(() => onDelete(task))}
                disabled={busy}
                className="rounded-lg bg-danger-strong px-3 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-sm font-semibold text-danger">
              Delete task
            </button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
