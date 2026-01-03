'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Dumbbell,
  Bot,
  UtensilsCrossed,
  Menu,
  X,
  Settings,
  Target,
  TrendingUp,
  Moon,
  Heart,
  Utensils,
  LogOut,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface BottomNavProps {
  user?: User
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname()
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const supabase = createClient()

  // Check if workout tracker is active (body has workout-active class)
  useEffect(() => {
    const checkWorkoutActive = () => {
      setIsWorkoutActive(document.body.classList.contains('workout-active'))
    }

    checkWorkoutActive()

    const observer = new MutationObserver(checkWorkoutActive)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  // Focus close button when menu opens
  useEffect(() => {
    if (menuOpen && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [menuOpen])

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && menuOpen) {
      setMenuOpen(false)
    }
  }, [menuOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Hide bottom nav when workout is active
  if (isWorkoutActive) {
    return null
  }

  const navItems = [
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/lifting', label: 'Lifting', icon: Dumbbell },
    { href: '/coach', label: 'Coach', icon: Bot, highlight: true },
    { href: '/nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  ]

  // All menu items for the slide-in panel
  const menuItems = [
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/plan', label: 'Plan', icon: Target },
    { href: '/lifting', label: 'Lifting', icon: Dumbbell },
    { href: '/nutrition', label: 'Nutrition', icon: Utensils },
    { href: '/sleep', label: 'Sleep', icon: Moon },
    { href: '/longevity', label: 'Longevity', icon: Heart },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 lg:hidden bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 pb-safe z-40"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center py-2 px-4 min-h-[56px] min-w-[64px] transition-colors ${
                  isActive
                    ? item.highlight
                      ? 'text-violet-400'
                      : 'text-amber-400'
                    : 'text-tertiary hover:text-white/70'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-colors ${
                    isActive
                      ? item.highlight
                        ? 'bg-violet-500/20'
                        : 'bg-amber-500/20'
                      : ''
                  }`}
                >
                  <Icon
                    size={22}
                    aria-hidden="true"
                    className={isActive && item.highlight ? 'text-violet-400' : ''}
                  />
                </div>
                <span className="text-xs mt-0.5 font-medium">{item.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="More options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className={`flex flex-col items-center justify-center py-2 px-4 min-h-[56px] min-w-[64px] transition-colors ${
              menuOpen ? 'text-amber-400' : 'text-tertiary hover:text-white/70'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${menuOpen ? 'bg-amber-500/20' : ''}`}>
              <Menu size={22} aria-hidden="true" />
            </div>
            <span className="text-xs mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-in menu from right (same as original hamburger menu) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={menuRef}
            className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-900 p-4 animate-slide-in focus-trap"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold">Menu</span>
              <button
                ref={closeButtonRef}
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 min-h-touch min-w-touch flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="space-y-1" role="navigation" aria-label="Mobile navigation">
              {menuItems.map(item => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
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
                onClick={() => setMenuOpen(false)}
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
                onClick={() => setMenuOpen(false)}
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

            {user && (
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
