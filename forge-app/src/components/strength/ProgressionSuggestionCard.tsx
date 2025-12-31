'use client'

import { ProgressionSuggestion, ProgressionModel, PlateauInfo } from '@/types/strength'
import { TrendingUp, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react'

interface ProgressionSuggestionCardProps {
  suggestion: ProgressionSuggestion
  plateauInfo?: PlateauInfo | null
  onApply?: (weight: number, reps: number) => void
}

export function ProgressionSuggestionCard({
  suggestion,
  plateauInfo,
  onApply,
}: ProgressionSuggestionCardProps) {
  const { model, currentWeight, currentReps, suggestedWeight, suggestedReps, reasoning } = suggestion

  const getModelLabel = (m: ProgressionModel) => {
    switch (m) {
      case 'linear': return 'Linear Progression'
      case 'double': return 'Double Progression'
      case 'rpe_based': return 'RPE-Based'
      default: return m
    }
  }

  const getModelDescription = (m: ProgressionModel) => {
    switch (m) {
      case 'linear': return 'Add weight each session'
      case 'double': return 'Add reps, then weight'
      case 'rpe_based': return 'Adjust by RPE'
      default: return ''
    }
  }

  const weightChanged = suggestedWeight !== currentWeight
  const repsChanged = suggestedReps !== currentReps

  return (
    <div className="bg-dark-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-green-400" size={18} />
          <span className="font-medium">Progression Suggestion</span>
        </div>
        <span className="text-xs text-white/40 px-2 py-0.5 bg-white/5 rounded">
          {getModelLabel(model)}
        </span>
      </div>

      {/* Plateau warning */}
      {plateauInfo?.plateau_detected && (
        <div className="flex items-start gap-2 p-2 mb-3 bg-amber-500/10 rounded-lg">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="text-amber-400 font-medium">
              Plateau detected ({plateauInfo.weeks_without_progress} weeks)
            </span>
            <p className="text-white/50 mt-0.5">{plateauInfo.suggestion}</p>
          </div>
        </div>
      )}

      {/* Last session */}
      {currentWeight > 0 && (
        <div className="mb-3 text-sm">
          <span className="text-white/40">Last session: </span>
          <span className="text-white/70">{currentWeight} lbs × {currentReps} reps</span>
        </div>
      )}

      {/* Suggestion */}
      <div className="flex items-center gap-4 p-3 bg-green-500/10 rounded-lg mb-3">
        <Lightbulb size={20} className="text-green-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-green-400">
              {suggestedWeight} lbs
            </span>
            <span className="text-white/50">×</span>
            <span className="text-xl font-semibold text-green-400">
              {suggestedReps} reps
            </span>
          </div>
          <div className="flex gap-2 mt-1 text-xs">
            {weightChanged && (
              <span className="text-green-400">
                +{suggestedWeight - currentWeight} lbs
              </span>
            )}
            {repsChanged && !weightChanged && (
              <span className="text-green-400">
                +{suggestedReps - currentReps} reps
              </span>
            )}
            {!weightChanged && !repsChanged && (
              <span className="text-white/50">Maintain current</span>
            )}
          </div>
        </div>
        {onApply && (
          <button
            onClick={() => onApply(suggestedWeight, suggestedReps)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30"
          >
            Apply
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Reasoning */}
      <p className="text-xs text-white/50">{reasoning}</p>
    </div>
  )
}

// Compact inline version
export function ProgressionSuggestionInline({
  suggestedWeight,
  suggestedReps,
  onApply,
}: {
  suggestedWeight: number
  suggestedReps: number
  onApply?: () => void
}) {
  return (
    <button
      onClick={onApply}
      className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs hover:bg-green-500/20"
    >
      <Lightbulb size={12} />
      <span>{suggestedWeight}×{suggestedReps}</span>
    </button>
  )
}
