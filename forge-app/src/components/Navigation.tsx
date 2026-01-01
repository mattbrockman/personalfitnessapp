'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import {
  Calendar,
  Dumbbell,
  Utensils,
  TrendingUp,
  Settings,
  Bot,
  Menu,
  X,
  LogOut,
  Moon,
  BookOpen,
  Target,
  Heart,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NavigationProps {
  user: User
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createClient()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const navItems = [
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/plan', label: 'Plan', icon: Target },
    { href: '/lifting', label: 'Lifting', icon: Dumbbell },
    { href: '/nutrition', label: 'Nutrition', icon: Utensils },
    { href: '/sleep', label: 'Sleep', icon: Moon },
    { href: '/longevity', label: 'Longevity', icon: Heart },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Focus trap for mobile menu
  useEffect(() => {
    if (mobileMenuOpen && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [mobileMenuOpen])

  // Handle escape key to close mobile menu
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <>
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header
        className="border-b border-white/5 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-20 bg-black/60 backdrop-filter backdrop-blur-xl"
        role="banner"
      >
        <div className="flex items-center gap-6">
          <Link
            href="/calendar"
            className="text-xl font-display font-semibold tracking-tight"
            aria-label="Forge - Go to calendar"
          >
            Forge
          </Link>

          <nav
            className="hidden lg:flex items-center gap-1"
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/coach"
            aria-current={pathname.startsWith('/coach') ? 'page' : undefined}
            aria-label="AI Coach"
            className={`p-2 min-h-touch min-w-touch rounded-lg transition-colors flex items-center justify-center gap-2 ${
              pathname.startsWith('/coach')
                ? 'bg-violet-500/20 text-violet-400'
                : 'hover:bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <Bot size={18} aria-hidden="true" />
            <span className="hidden sm:inline text-sm">Coach</span>
          </Link>

          <Link
            href="/settings"
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
            aria-label="Settings"
            className={`p-2 min-h-touch min-w-touch rounded-lg transition-colors flex items-center justify-center ${
              pathname.startsWith('/settings')
                ? 'bg-white/10 text-white'
                : 'hover:bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <Settings size={18} aria-hidden="true" />
          </Link>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
            <div
              className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm font-medium"
              aria-label={`Logged in as ${user.email}`}
              role="img"
            >
              {user.email?.charAt(0).toUpperCase()}
            </div>
          </div>

          <button
            className="lg:hidden p-2 min-h-touch min-w-touch flex items-center justify-center"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          id="mobile-menu"
        >
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={mobileMenuRef}
            className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-900 p-4 animate-slide-in focus-trap"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold" id="mobile-menu-title">Menu</span>
              <button
                ref={closeButtonRef}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 min-h-touch min-w-touch flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="space-y-1" role="navigation" aria-label="Mobile navigation">
              {navItems.map(item => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg min-h-touch ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    {item.label}
                  </Link>
                )
              })}

              <div className="h-px bg-white/10 my-2" role="separator" />

              <Link
                href="/coach"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={pathname.startsWith('/coach') ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg min-h-touch ${
                  pathname.startsWith('/coach')
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Bot size={20} aria-hidden="true" />
                AI Coach
              </Link>

              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg min-h-touch ${
                  pathname.startsWith('/settings')
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Settings size={20} aria-hidden="true" />
                Settings
              </Link>
            </nav>

            <div className="absolute bottom-4 left-4 right-4 pb-safe">
              <div className="border-t border-white/10 pt-4 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-medium"
                    role="img"
                    aria-label={`User avatar for ${user.email}`}
                  >
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 min-h-touch"
                aria-label="Sign out of your account"
              >
                <LogOut size={20} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
