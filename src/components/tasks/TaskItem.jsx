import { dueInfo } from '../../lib/dates.js'

const toneClass = {
  overdue: 'bg-warn/10 text-warn',
  today: 'bg-brand-soft text-brand-ink',
  normal: 'bg-raised text-muted',
}

// One task row. Your own tasks get a working checkbox and open the editor
// when tapped; other people's tasks are read-only.
// roomName: shown as a small tag (used on the Home dashboard).
// footer: extra content under the task (the reaction bar).
export default function TaskItem({ task, editable, onToggle, onOpen, roomName = null, footer = null }) {
  const done = Boolean(task.completed_at)
  const due = dueInfo(task.due_date, done)

  return (
    <li className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${done ? 'bg-sunken' : 'bg-surface'}`}>
      {editable ? (
        <button
          onClick={() => onToggle(task)}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="mt-px shrink-0 rounded-lg p-0.5 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          <Check done={done} />
        </button>
      ) : (
        <span className="mt-px shrink-0 p-0.5" aria-label={done ? 'Done' : 'Pending'}>
          <Check done={done} muted />
        </span>
      )}

      <div
        className={`min-w-0 flex-1 ${editable ? 'cursor-pointer' : ''}`}
        onClick={editable ? () => onOpen(task) : undefined}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={editable ? (e) => e.key === 'Enter' && onOpen(task) : undefined}
      >
        <p className={`break-words text-[15px] font-medium ${done ? 'text-muted line-through decoration-muted/60' : ''}`}>{task.title}</p>
        {(due || task.description || roomName) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {roomName && (
              <span className="max-w-[10rem] truncate rounded-md bg-raised px-1.5 py-0.5 text-xs font-medium text-muted">
                {roomName}
              </span>
            )}
            {due && (
              <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${toneClass[due.tone]}`}>
                {due.tone === 'overdue' ? `Overdue · ${due.label}` : due.label}
              </span>
            )}
            {task.description && <span className="truncate text-xs text-muted">{task.description}</span>}
          </div>
        )}
        {footer && (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {footer}
          </div>
        )}
      </div>
    </li>
  )
}

function Check({ done, muted = false }) {
  if (done) {
    return (
      <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${muted ? 'bg-done/70' : 'bg-done'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-brand)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  return <span className={`block h-6 w-6 rounded-lg border-2 ${muted ? 'border-line' : 'border-[#5a4d43] hover:border-brand'}`} />
}
