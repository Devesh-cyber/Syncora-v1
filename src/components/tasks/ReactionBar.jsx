import { useState } from 'react'
import { EMOJIS } from '../../lib/reactions.js'

// Reactions under a completed task.
// reactions: { [emoji]: [userId, …] }   names: { [userId]: displayName }
// canReact: false for your own tasks (you see reactions but can't add them).
export default function ReactionBar({ reactions = {}, meId, names = {}, canReact, onToggle }) {
  const [picking, setPicking] = useState(false)
  const used = EMOJIS.filter((e) => reactions[e]?.length)

  if (!canReact && used.length === 0) return null

  const who = (emoji) =>
    (reactions[emoji] ?? []).map((id) => (id === meId ? 'You' : names[id] ?? 'Someone')).join(', ')

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {used.map((emoji) => {
        const mine = reactions[emoji].includes(meId)
        const pill = `flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
          mine ? 'border-brand/50 bg-brand-soft text-brand-ink' : 'border-transparent bg-raised text-ink'
        }`
        return canReact ? (
          <button key={emoji} onClick={() => onToggle(emoji, mine)} title={who(emoji)} aria-pressed={mine} className={pill}>
            <span aria-hidden="true">{emoji}</span>
            {reactions[emoji].length}
            <span className="sr-only">{mine ? `Remove your ${emoji}` : `React ${emoji}`}</span>
          </button>
        ) : (
          <span key={emoji} title={who(emoji)} className={pill}>
            <span aria-hidden="true">{emoji}</span>
            {reactions[emoji].length}
          </span>
        )
      })}

      {canReact &&
        (picking ? (
          <div className="flex items-center gap-0.5 rounded-full bg-raised px-1 py-0.5">
            {EMOJIS.map((emoji) => {
              const mine = reactions[emoji]?.includes(meId)
              return (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggle(emoji, mine)
                    setPicking(false)
                  }}
                  aria-label={mine ? `Remove your ${emoji}` : `React ${emoji}`}
                  className={`rounded-full px-1.5 py-0.5 text-base transition hover:scale-110 ${mine ? 'bg-brand-soft' : ''}`}
                >
                  {emoji}
                </button>
              )
            })}
            <button onClick={() => setPicking(false)} aria-label="Close" className="px-1.5 text-xs text-muted">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPicking(true)}
            aria-label="Add a reaction"
            className="rounded-full border border-dashed border-[#4a3f36] px-2 py-0.5 text-xs font-semibold text-muted hover:border-brand hover:text-brand"
          >
            + Cheer
          </button>
        ))}
    </div>
  )
}
