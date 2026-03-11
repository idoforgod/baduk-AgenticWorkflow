// =============================================================================
// screens/Layout.tsx — Shared application layout with header and nav
// =============================================================================

import { Home, Play, Settings, Zap } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../components/ui/button'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/quick-go', label: 'Quick Go', icon: <Zap size={18} /> },
  { path: '/game', label: 'Game', icon: <Play size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
]

export function Layout() {
  const location = useLocation()

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg"
          style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: 'var(--stone-black)', color: 'white' }}
            aria-hidden
          >
            囲
          </span>
          Baduk
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive ? 'font-medium' : 'hover:bg-[var(--bg-elevated)]'
                )}
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-elevated)' : undefined,
                  textDecoration: 'none',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        className="py-3 px-6 text-center text-xs border-t"
        style={{
          color: 'var(--text-muted)',
          borderColor: 'var(--border)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        Baduk Platform — Quick Go 9x9
      </footer>
    </div>
  )
}
