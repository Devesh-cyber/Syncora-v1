import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Avatar from './Avatar.jsx'

const tabs = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/rooms', label: 'Rooms', icon: RoomsIcon },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
]

export function Wordmark({ className = '' }) {
  return (
    <span className={`font-display text-[22px] font-extrabold tracking-tight ${className}`}>
      syncora<span className="text-brand">.</span>
    </span>
  )
}

export default function Layout() {
  const { profile } = useAuth()

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <header className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Link to="/" aria-label="Syncora home">
          <Wordmark />
        </Link>
        <Link to="/profile" className="ml-auto" aria-label="Your profile">
          <Avatar name={profile.display_name} url={profile.avatar_url} size={36} rounded="xl" />
        </Link>
      </header>

      <main className="flex-1 px-4 pb-32">
        <Outlet />
      </main>

      {/* Floating pill nav: the active tab shows its label, the rest are icons. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]"
      >
        <ul className="mx-auto grid h-[62px] max-w-lg grid-cols-4 gap-1 rounded-[20px] bg-raised p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="contents">
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-1.5 rounded-[14px] text-[13px] font-bold transition-colors ${
                    isActive ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon />
                    {isActive && <span>{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function svgProps() {
  return {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.1,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
}
function HomeIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function RoomsIcon() {
  return (
    <svg {...svgProps()}>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M15.5 14.6c2.6.1 4.6 1.9 5.2 4.9" />
    </svg>
  )
}
function ActivityIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}
function ProfileIcon() {
  return (
    <svg {...svgProps()}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
    </svg>
  )
}
