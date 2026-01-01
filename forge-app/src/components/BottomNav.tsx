'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Dumbbell,
  Bot,
  TrendingUp,
  MoreHorizontal,
} from 'lucide-react'
import { useState } from 'react'

interface BottomNavProps {
  onMoreClick?: () => void
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/lifting', label: 'Lifting', icon: Dumbbell },
    { href: '/coach', label: 'Coach', icon: Bot, highlight: true },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
  ]

  return (
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
                  : 'text-white/50 hover:text-white/70'
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
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={onMoreClick}
          aria-label="More options"
          aria-haspopup="true"
          className="flex flex-col items-center justify-center py-2 px-4 min-h-[56px] min-w-[64px] text-white/50 hover:text-white/70 transition-colors"
        >
          <div className="p-1.5">
            <MoreHorizontal size={22} aria-hidden="true" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium">More</span>
        </button>
      </div>
    </nav>
  )
}
