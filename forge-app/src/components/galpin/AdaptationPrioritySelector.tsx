'use client'

import { useState, useEffect } from 'react'
import {
  GalpinAdaptation,
  ADAPTATION_LABELS,
  ADAPTATION_DESCRIPTIONS,
  UserAdaptationGoals,
} from '@/types/galpin'

interface AdaptationPrioritySelectorProps {
  initialGoals?: UserAdaptationGoals | null
  onSave: (goals: {
    primary_adaptation: GalpinAdaptation
    secondary_adaptation?: GalpinAdaptation
    tertiary_adaptation?: GalpinAdaptation
    priorities?: Record<GalpinAdaptation, number>
  }) => Promise<void>
  className?: string
}

const ALL_ADAPTATIONS: GalpinAdaptation[] = [
  'skill', 'speed_power', 'strength', 'hypertrophy', 'muscular_endurance',
  'anaerobic_capacity', 'vo2max', 'long_duration', 'body_composition'
]

export function AdaptationPrioritySelector({
  initialGoals,
  onSave,
  className = '',
}: AdaptationPrioritySelectorProps) {
  const [primary, setPrimary] = useState<GalpinAdaptation | null>(
    initialGoals?.primary_adaptation || null
  )
  const [secondary, setSecondary] = useState<GalpinAdaptation | null>(
    initialGoals?.secondary_adaptation || null
  )
  const [tertiary, setTertiary] = useState<GalpinAdaptation | null>(
    initialGoals?.tertiary_adaptation || null
  )
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const handleSave = async () => {
    if (!primary) return

    setSaving(true)
    try {
      await onSave({
        primary_adaptation: primary,
        secondary_adaptation: secondary || undefined,
        tertiary_adaptation: tertiary || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const isSelected = (adaptation: GalpinAdaptation) => {
    return adaptation === primary || adaptation === secondary || adaptation === tertiary
  }

  const getSelectionOrder = (adaptation: GalpinAdaptation): number | null => {
    if (adaptation === primary) return 1
    if (adaptation === secondary) return 2
    if (adaptation === tertiary) return 3
    return null
  }

  const handleClick = (adaptation: GalpinAdaptation) => {
    if (adaptation === primary) {
      // Deselect primary, shift others up
      setPrimary(secondary)
      setSecondary(tertiary)
      setTertiary(null)
    } else if (adaptation === secondary) {
      // Deselect secondary, shift tertiary up
      setSecondary(tertiary)
      setTertiary(null)
    } else if (adaptation === tertiary) {
      // Deselect tertiary
      setTertiary(null)
    } else {
      // Select new adaptation
      if (!primary) {
        setPrimary(adaptation)
      } else if (!secondary) {
        setSecondary(adaptation)
      } else if (!tertiary) {
        setTertiary(adaptation)
      }
      // If all 3 slots full, do nothing
    }
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-2">Training Focus</h3>
      <p className="text-sm text-gray-400 mb-4">
        Select up to 3 adaptations in priority order (1 = highest)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {ALL_ADAPTATIONS.slice(0, showAll ? undefined : 6).map((adaptation) => {
          const selected = isSelected(adaptation)
          const order = getSelectionOrder(adaptation)

          return (
            <button
              key={adaptation}
              onClick={() => handleClick(adaptation)}
              className={`
                relative p-3 rounded-lg text-left transition-all
                ${selected
                  ? 'bg-blue-600 border-2 border-blue-400'
                  : 'bg-gray-700 border-2 border-transparent hover:border-gray-500'
                }
              `}
            >
              {order && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {order}
                </span>
              )}
              <div className="font-medium text-white text-sm">
                {ADAPTATION_LABELS[adaptation]}
              </div>
              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                {ADAPTATION_DESCRIPTIONS[adaptation]}
              </div>
            </button>
          )
        })}
      </div>

      {!showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          Show all 9 adaptations
        </button>
      )}

      {primary && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Selected priorities:</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-blue-600 rounded text-sm text-white">
              1. {ADAPTATION_LABELS[primary]}
            </span>
            {secondary && (
              <span className="px-2 py-1 bg-blue-500 rounded text-sm text-white">
                2. {ADAPTATION_LABELS[secondary]}
              </span>
            )}
            {tertiary && (
              <span className="px-2 py-1 bg-blue-400 rounded text-sm text-white">
                3. {ADAPTATION_LABELS[tertiary]}
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!primary || saving}
        className={`
          mt-4 w-full py-2 px-4 rounded-lg font-medium transition-colors
          ${primary && !saving
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {saving ? 'Saving...' : 'Save Goals'}
      </button>
    </div>
  )
}
