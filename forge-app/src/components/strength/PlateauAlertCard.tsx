'use client'

import { PlateauInfo } from '@/types/strength'
import { AlertTriangle, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react'

interface PlateauAlertCardProps {
  plateau: PlateauInfo
  onDismiss?: () => void
  onViewSuggestions?: () => void
}

export function PlateauAlertCard({ plateau, onDismiss, onViewSuggestions }: PlateauAlertCardProps) {
  const { exercise_name, weeks_without_progress, last_pr_date, last_pr_e1rm, suggestion } = plateau

  const getSeverityColor = () => {
    if (weeks_without_progress >= 6) return 'border-red-500/50 bg-red-500/10'
    if (weeks_without_progress >= 4) return 'border-amber-500/50 bg-amber-500/10'
    return 'border-yellow-500/50 bg-yellow-500/10'
  }

  const getSeverityIcon = () => {
    if (weeks_without_progress >= 4) return <AlertTriangle size={18} className="text-red-400" />
    return <AlertTriangle size={18} className="text-amber-400" />
  }

  return (
    <div className={`rounded-xl border p-4 ${getSeverityColor()}`}>
      <div className="flex items-start gap-3">
        {getSeverityIcon()}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium">Plateau Detected</h4>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-secondary hover:text-white/60"
              >
                Dismiss
              </button>
            )}
          </div>
          <p className="text-sm text-white/70">
            <span className="font-medium">{exercise_name}</span> - no progress for{' '}
            <span className="text-amber-400 font-medium">{weeks_without_progress} weeks</span>
          </p>

          {last_pr_date && last_pr_e1rm && (
            <div className="flex items-center gap-2 mt-2 text-xs text-secondary">
              <TrendingUp size={12} />
              <span>
                Last PR: {last_pr_e1rm} lbs e1RM on{' '}
                {new Date(last_pr_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}

          <div className="mt-3 p-2 bg-dark-700/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/60">{suggestion}</p>
            </div>
          </div>

          {onViewSuggestions && (
            <button
              onClick={onViewSuggestions}
              className="mt-3 flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
            >
              View suggestions
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact version for lists
export function PlateauAlertBadge({ weeksStagnant }: { weeksStagnant: number }) {
  if (weeksStagnant < 3) return null

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
      weeksStagnant >= 4 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
    }`}>
      <AlertTriangle size={10} />
      {weeksStagnant}w plateau
    </span>
  )
}

// Suggestions panel
export function PlateauSuggestions({ exerciseName }: { exerciseName: string }) {
  const suggestions = [
    {
      title: 'Change Rep Range',
      description: 'If training 8-12, try 5-8 for a few weeks',
      example: 'e.g., 185×10 → 205×6',
    },
    {
      title: 'Add Volume',
      description: 'Add 1-2 sets per workout',
      example: 'e.g., 3 sets → 4-5 sets',
    },
    {
      title: 'Deload Week',
      description: 'Reduce weight/volume by 40-50% for 1 week',
      example: 'e.g., 185×10 → 135×8',
    },
    {
      title: 'Exercise Variation',
      description: 'Switch to a similar movement pattern',
      example: 'e.g., Bench → Incline or Dumbbell',
    },
    {
      title: 'Check Recovery',
      description: 'Ensure 7-9h sleep, adequate protein',
      example: '1g protein per lb bodyweight',
    },
  ]

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-tertiary">
        Breaking the {exerciseName} Plateau
      </h4>
      {suggestions.map((s, i) => (
        <div key={i} className="p-3 bg-dark-700/30 rounded-lg">
          <div className="font-medium text-sm">{s.title}</div>
          <div className="text-xs text-tertiary mt-0.5">{s.description}</div>
          <div className="text-xs text-amber-400/70 mt-1">{s.example}</div>
        </div>
      ))}
    </div>
  )
}
