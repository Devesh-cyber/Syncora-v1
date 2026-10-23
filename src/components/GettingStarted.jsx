import { useState } from 'react'
import { Link } from 'react-router-dom'

const HIDE_KEY = 'syncora:gettingStartedHidden'

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

// First-run checklist on Home. Each step ticks itself as the person does it,
// and the whole card disappears after their first completed task.
//   hasRoom: in at least one room · hasTask: has any task · hasDone: ever finished one
export default function GettingStarted({ hasRoom, hasTask, hasDone, onAddTask }) {
  const [hidden, setHidden] = useState(readHidden)
  if (hasDone || (hidden && hasRoom)) return null

  const steps = [
    {
      done: hasRoom,
      title: 'Create or join a room',
      body: 'A room is your crew — a study group, team or project.',
      action: !hasRoom && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to="/rooms/new" className="rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-bold text-on-brand">
            Create a room
          </Link>
          <Link to="/rooms/join" className="rounded-xl bg-surface px-3 py-2.5 text-center text-sm font-semibold ring-1 ring-line">
            Join with a code
          </Link>
        </div>
      ),
    },
    {
      done: hasTask,
      title: 'Add your first task',
      body: 'Something small for today — e.g. “Revise chapter 4”.',
      action: hasRoom && !hasTask && (
        <button onClick={onAddTask} className="mt-3 rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-on-brand">
          Add a task
        </button>
      ),
    },
    {
      done: hasDone,
      title: 'Tick it off',
      body: 'Tap the box when it’s done. Your room sees it, and your 🔥 streak starts.',
    },
  ]
  const current = steps.findIndex((s) => !s.done)
  const doneCount = steps.filter((s) => s.done).length

  function hide() {
    setHidden(true)
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <section aria-labelledby="getting-started" className="rounded-3xl bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="getting-started" className="text-xl font-extrabold">
            Getting started
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} of 3 done ·{' '}
            <Link to="/tour?replay=1" className="font-semibold text-brand">
              How Syncora works
            </Link>
          </p>
        </div>
        {hasRoom && (
          <button onClick={hide} className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:text-ink">
            Hide
          </button>
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const active = i === current
          return (
            <li
              key={step.title}
              className={`flex gap-3 rounded-2xl px-3.5 py-3 ${active ? 'bg-raised' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  step.done ? 'bg-brand text-on-brand' : active ? 'border-2 border-brand text-brand' : 'border-2 border-line text-muted'
                }`}
                aria-hidden="true"
              >
                {step.done ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${step.done ? 'text-muted line-through' : ''}`}>
                  {step.title}
                  <span className="sr-only">{step.done ? ' (done)' : ''}</span>
                </p>
                {active && <p className="mt-0.5 text-sm text-muted">{step.body}</p>}
                {active && step.action}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
