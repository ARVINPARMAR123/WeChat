import { NavLink, Outlet } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext.jsx'
import { buildInitials } from '../../lib/formatters.js'
import './navbar.css'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/status', label: 'Status', icon: 'status' },
  { to: '/payments', label: 'Payments', icon: 'payments' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
  { to: '/about', label: 'About', icon: 'about' },
]

const NAV_ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5a9.5 9.5 0 0 1 6.72 2.78" />
      <path d="M21.5 12a9.5 9.5 0 0 1-2.78 6.72" />
      <path d="M12 21.5a9.5 9.5 0 0 1-6.72-2.78" />
      <circle cx="3.3" cy="12.9" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  ),
}

function Navbar() {
  const { session, isAuthenticated, logout } = useAppContext()
  const displayName = session.displayName || session.username || 'Guest'
  const sessionProfileImage = session.profilePicture?.trim() || ''

  async function handleLogout() {
    await logout()
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <div className="app-frame">
        <header className="topbar">
          <div className="topbar-main">
            <div className="brand-block">
              <div>
                <h1 className="brand-title">WeChat</h1>
              </div>
            </div>

            <div className="session-chip">
              {/* <span className={`sync-pill sync-${syncState}`}>{formatSyncState(syncState)}</span> */}
              {sessionProfileImage ? (
                <img
                  className="session-avatar-image"
                  src={sessionProfileImage}
                  alt={`${displayName} profile`}
                />
              ) : (
                <div className="avatar-badge">{buildInitials(displayName)}</div>
              )}
              <div className="session-meta">
                <NavLink to="/profile" className="session-display-link">
                  <strong>{displayName}</strong>
                </NavLink>
                <span>{isAuthenticated ? session.email || 'Signed in' : 'Guest preview mode'}</span>
              </div>

              {isAuthenticated ? (
                <button type="button" className="ghost-button compact" onClick={handleLogout}>
                  Sign out
                </button>
              ) : null}
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                aria-label={item.label}
                title={item.label}
                data-label={item.label}
              >
                <span className="nav-icon" aria-hidden="true">{NAV_ICONS[item.icon]}</span>
                <span className="sr-only">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="content-shell">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Navbar