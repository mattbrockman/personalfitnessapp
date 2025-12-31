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
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NavigationProps {
  user: User
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createClient()

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

  return (
    <>
      <header className="border-b border-white/5 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-20 bg-black/60 backdrop-filter backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <Link href="/calendar" className="text-xl font-display font-semibold tracking-tight">
            Forge
          </Link>
          
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    isActive 
                      ? 'bg-white/10 text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
          <Link 
            href="/coach"
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
              pathname.startsWith('/coach')
                ? 'bg-violet-500/20 text-violet-400'
                : 'hover:bg-white/5 text-white/60 hover:text-white'
            }`}
            title="AI Coach"
          >
            <Bot size={18} />
            <span className="hidden sm:inline text-sm">Coach</span>
          </Link>
          
          <Link 
            href="/settings"
            className={`p-2 rounded-lg transition-colors ${
              pathname.startsWith('/settings')
                ? 'bg-white/10 text-white'
                : 'hover:bg-white/5 text-white/60 hover:text-white'
            }`}
            title="Settings"
          >
            <Settings size={18} />
          </Link>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-sm font-medium">
              {user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <button 
            className="lg:hidden p-2"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black/80"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-900 p-4 animate-slide-in">
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <nav className="space-y-1">
              {navItems.map(item => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      isActive 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                )
              })}
              
              <div className="h-px bg-white/10 my-2" />
              
              <Link
                href="/coach"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  pathname.startsWith('/coach') 
                    ? 'bg-violet-500/20 text-violet-400' 
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Bot size={20} />
                AI Coach
              </Link>
              
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  pathname.startsWith('/settings') 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Settings size={20} />
                Settings
              </Link>
            </nav>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="border-t border-white/10 pt-4 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={20} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
