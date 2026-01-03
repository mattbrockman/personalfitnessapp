'use client'

import { useEffect, useState } from 'react'
import { Trophy, Flame, TrendingUp, Zap } from 'lucide-react'
import { PRResult, PRType, formatPRMessage } from '@/lib/pr-detection'

interface PRCelebrationProps {
  pr: PRResult
  onDismiss: () => void
}

const prIcons: Record<PRType, typeof Trophy> = {
  e1rm: Trophy,
  weight: Flame,
  reps: TrendingUp,
  volume: Zap,
}

const prColors: Record<PRType, string> = {
  e1rm: 'from-amber-400 to-yellow-500',
  weight: 'from-orange-400 to-red-500',
  reps: 'from-emerald-400 to-teal-500',
  volume: 'from-purple-400 to-pink-500',
}

export function PRCelebration({ pr, onDismiss }: PRCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([])

  const Icon = prIcons[pr.type]
  const colorGradient = prColors[pr.type]

  useEffect(() => {
    // Trigger animation
    setIsVisible(true)

    // Generate confetti pieces
    const colors = ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7', '#EF4444', '#10B981']
    const pieces = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    setConfettiPieces(pieces)

    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onDismiss, 300) // Wait for fade out
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden">
        {confettiPieces.map(piece => (
          <div
            key={piece.id}
            className="absolute w-2 h-2 rounded-sm animate-confetti"
            style={{
              left: `${piece.x}%`,
              top: '-10px',
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
            }}
          />
        ))}
      </div>

      {/* PR Card */}
      <div
        className={`relative pointer-events-auto bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-6 max-w-sm mx-4 transform transition-all duration-500 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={onDismiss}
      >
        {/* Glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-20 rounded-2xl blur-xl`} />

        <div className="relative">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colorGradient} flex items-center justify-center mx-auto mb-4 animate-bounce-slow`}>
            <Icon size={32} className="text-white" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
            NEW PR!
          </h2>

          {/* Exercise name */}
          <p className="text-white/80 text-center text-lg font-medium mb-3">
            {pr.exerciseName}
          </p>

          {/* PR details */}
          <div className="text-center">
            <p className="text-xl font-semibold text-white">
              {formatPRMessage(pr)}
            </p>
            {pr.previousValue > 0 && (
              <p className="text-sm text-tertiary mt-1">
                Previous best: {pr.type === 'reps' ? `${pr.previousValue} reps` : `${pr.previousValue.toFixed(1)} lbs`}
              </p>
            )}
          </div>

          {/* Tap to dismiss */}
          <p className="text-xs text-muted text-center mt-4">
            Tap to dismiss
          </p>
        </div>
      </div>
    </div>
  )
}

// Hook to manage PR celebration state
export function usePRCelebration() {
  const [activePR, setActivePR] = useState<PRResult | null>(null)

  const celebrate = (pr: PRResult) => {
    setActivePR(pr)
  }

  const dismiss = () => {
    setActivePR(null)
  }

  return {
    activePR,
    celebrate,
    dismiss,
    CelebrationComponent: activePR ? (
      <PRCelebration pr={activePR} onDismiss={dismiss} />
    ) : null,
  }
}
