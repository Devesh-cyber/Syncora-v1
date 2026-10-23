import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Wordmark } from '../components/Layout.jsx'

// "How Syncora works": 4 swipeable cards, shown once after the profile step
// and replayable from Profile (/tour?replay=1).
const SLIDES = [
  {
    title: 'A room is your crew',
    body: 'Make one for your study group, hackathon team or project. Friends join with an 8-character code you share.',
    Visual: RoomsVisual,
  },
  {
    title: 'Your tasks, everyone’s progress',
    body: 'Add tasks with a due date. Only you can tick yours off — but the whole room can see who’s done what.',
    Visual: TasksVisual,
  },
  {
    title: 'Cheer & keep a streak',
    body: 'Tap Cheer when a friend finishes something. Finish at least one task a day to grow your 🔥 streak.',
    Visual: CheerVisual,
  },
  {
    title: 'One Home for your day',
    body: 'Home pulls today’s tasks from all your rooms into one list, with your progress and streak on top.',
    Visual: HomeVisual,
  },
]

export default function Tour() {
  const { markTourSeen, getReturnTo } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const replay = params.get('replay') === '1'
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)

  // Where they were heading before sign-in (e.g. a room invite link).
  const returnTo = replay ? '/profile' : getReturnTo()
  const invited = !replay && returnTo.startsWith('/rooms/join')
  const last = index === SLIDES.length - 1

  function finish(to) {
    markTourSeen()
    navigate(to, { replace: true })
  }

  const next = () => setIndex((i) => Math.min(i + 1, SLIDES.length - 1))
  const back = () => setIndex((i) => Math.max(i - 1, 0))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onTouchStart(e) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (dx < -40) next()
    if (dx > 40) back()
  }

  const { title, body, Visual } = SLIDES[index]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <header className="flex min-h-10 items-center justify-between">
        <Wordmark />
        {!last && (
          <button
            onClick={() => finish(replay ? '/profile' : invited ? returnTo : '/')}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
          >
            Skip
          </button>
        )}
      </header>

      <section
        aria-roledescription="carousel"
        aria-label="How Syncora works"
        className="flex flex-1 flex-col justify-center py-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${SLIDES.length}`}
          className="animate-[tour-in_0.3s_ease]"
        >
          <div className="flex h-64 items-center justify-center rounded-3xl bg-surface px-6">
            <Visual />
          </div>
          <p className="mt-7 text-xs font-bold tracking-wide text-brand uppercase">
            {index + 1} of {SLIDES.length}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
        </div>
      </section>

      <div className="mb-5 flex justify-center gap-2" role="tablist" aria-label="Choose a card">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            role="tab"
            aria-selected={i === index}
            aria-label={`Card ${i + 1}: ${s.title}`}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand' : 'w-2 bg-raised'}`}
          />
        ))}
      </div>

      {!last ? (
        <div className="flex gap-3">
          {index > 0 && (
            <button onClick={back} className="rounded-xl bg-surface px-5 py-3.5 font-semibold">
              Back
            </button>
          )}
          <button onClick={next} className="flex-1 rounded-xl bg-brand px-4 py-3.5 font-bold text-on-brand">
            {index === 0 ? 'Show me how it works' : 'Next'}
          </button>
        </div>
      ) : replay ? (
        <button onClick={() => finish('/profile')} className="w-full rounded-xl bg-brand px-4 py-3.5 font-bold text-on-brand">
          Got it
        </button>
      ) : invited ? (
        <button onClick={() => finish(returnTo)} className="w-full rounded-xl bg-brand px-4 py-3.5 font-bold text-on-brand">
          Join the room you were invited to
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => finish('/rooms/new')} className="rounded-xl bg-brand px-4 py-3.5 font-bold text-on-brand">
              Create a room
            </button>
            <button onClick={() => finish('/rooms/join')} className="rounded-xl bg-surface px-4 py-3.5 font-semibold">
              Join with a code
            </button>
          </div>
          <button onClick={() => finish('/')} className="w-full py-2 text-sm font-semibold text-muted hover:text-ink">
            I’ll look around first
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- little mock-ups of the real UI ---------- */

function Chip({ children, active = false }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-bold ${
        active ? 'bg-brand text-on-brand' : 'bg-raised text-ink'
      }`}
    >
      {children}
    </span>
  )
}

function Dot({ label, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-soft text-brand-ink', violet: 'bg-[#2e2540] text-[#c4b5fd]', gold: 'bg-[#3a2a1a] text-[#fcd34d]' }
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-raised ${tones[tone]}`}>
      {label}
    </span>
  )
}

function Row({ done = false, title, meta, children }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${done ? 'bg-sunken' : 'bg-raised'}`}>
      <span
        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
          done ? 'bg-brand' : 'border-2 border-[#5a4d43]'
        }`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-medium ${done ? 'text-muted line-through' : ''}`}>{title}</p>
        {meta && <p className="mt-0.5 text-[11px] text-muted">{meta}</p>}
        {children}
      </div>
    </div>
  )
}

function RoomsVisual() {
  return (
    <div className="w-full max-w-[17rem] space-y-3" aria-hidden="true">
      <div className="rounded-2xl bg-raised p-4 text-left">
        <p className="font-display text-lg font-extrabold">Hackathon crew</p>
        <p className="text-xs text-muted">Shipping our demo by Sunday · 3 members</p>
        <div className="mt-3 flex -space-x-1.5">
          <Dot label="YO" />
          <Dot label="AM" tone="violet" />
          <Dot label="RS" tone="gold" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-sunken px-4 py-3">
        <span className="font-mono text-lg font-bold tracking-[0.18em]">K7QM-2XPA</span>
        <span className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-on-brand">Share</span>
      </div>
    </div>
  )
}

function TasksVisual() {
  return (
    <div className="w-full max-w-[17rem] space-y-2" aria-hidden="true">
      <div className="mb-3 flex gap-2">
        <Chip active>
          <Dot label="YO" /> You
        </Chip>
        <Chip>
          <Dot label="AM" tone="violet" /> Aman
        </Chip>
      </div>
      <Row title="Revise chapter 4" meta="Due today" />
      <Row title="Build login screen" meta="Due tomorrow" />
      <Row done title="Set up the repo" />
    </div>
  )
}

function CheerVisual() {
  return (
    <div className="w-full max-w-[17rem] space-y-3" aria-hidden="true">
      <Row done title="Record demo video" meta="Aman · 3m ago">
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink">🔥 2</span>
          <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-bold">👏 1</span>
          <span className="rounded-full border border-dashed border-[#4a3f36] px-2 py-0.5 text-xs font-bold text-muted">+ Cheer</span>
        </div>
      </Row>
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-sunken py-3">
        <span className="text-xl">🔥</span>
        <span className="font-display text-xl font-extrabold text-brand">4 days in a row</span>
      </div>
    </div>
  )
}

function HomeVisual() {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="w-full max-w-[17rem] space-y-2" aria-hidden="true">
      <div className="mb-2 flex items-center gap-4 rounded-2xl bg-raised p-3">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="8" />
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${0.6 * c} ${c}`} transform="rotate(-90 36 36)" />
          <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--color-ink)">3/5</text>
        </svg>
        <div className="text-left">
          <p className="text-xs text-muted">Good evening</p>
          <p className="font-display text-lg font-extrabold">You</p>
          <p className="text-xs font-bold text-brand">🔥 4 days in a row</p>
        </div>
      </div>
      <Row title="Revise chapter 4" meta="DBMS revision · today" />
      <Row title="Build login screen" meta="Hackathon crew · today" />
    </div>
  )
}
