'use client'

import { calculateEffectiveReps } from '@/lib/strength-calculations'
import { Zap } from 'lucide-react'

interface EffectiveRepsDisplayProps {
  reps: number
  rpe: number | null
  rir: number | null
  compact?: boolean
}

export function EffectiveRepsDisplay({
  reps,
  rpe,
  rir,
  compact = false,
}: EffectiveRepsDisplayProps) {
  const result = calculateEffectiveReps(reps, rpe, rir)
  const { effectiveReps, rir: calculatedRIR } = result

  // If no RPE/RIR data, can't show effective reps
  if (rpe === null && rir === null) {
    return compact ? null : (
      <span className="text-xs text-muted">
        {reps} reps (add RPE for effective reps)
      </span>
    )
  }

  const efficiency = reps > 0 ? Math.round((effectiveReps / reps) * 100) : 0

  // Color based on RIR (how close to failure)
  const getEfficiencyColor = () => {
    if (calculatedRIR === null) return 'text-tertiary'
    if (calculatedRIR <= 1) return 'text-green-400' // Very effective
    if (calculatedRIR <= 3) return 'text-blue-400' // Good
    if (calculatedRIR <= 5) return 'text-white/70' // Moderate
    return 'text-secondary' // Low effectiveness
  }

  if (compact) {
    return (
      <span className={`text-xs ${getEfficiencyColor()}`}>
        {effectiveReps} eff
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Zap size={12} className={getEfficiencyColor()} />
        <span className={`text-sm ${getEfficiencyColor()}`}>
          {effectiveReps}
        </span>
        <span className="text-xs text-muted">/ {reps}</span>
      </div>
      <span className="text-xs text-muted">
        ({efficiency}% effective)
      </span>
    </div>
  )
}

// Summary version for total workout stats
export function EffectiveRepsSummary({
  totalReps,
  effectiveReps,
}: {
  totalReps: number
  effectiveReps: number
}) {
  const efficiency = totalReps > 0 ? Math.round((effectiveReps / totalReps) * 100) : 0

  const getEfficiencyColor = () => {
    if (efficiency >= 70) return 'text-green-400'
    if (efficiency >= 50) return 'text-blue-400'
    if (efficiency >= 30) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="bg-dark-700/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} className={getEfficiencyColor()} />
        <span className="text-sm text-tertiary">Effective Reps</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold ${getEfficiencyColor()}`}>
          {effectiveReps}
        </span>
        <span className="text-muted">/ {totalReps} total</span>
      </div>
      <div className="mt-2">
        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <div
            className={`h-full ${efficiency >= 70 ? 'bg-green-500' : efficiency >= 50 ? 'bg-blue-500' : efficiency >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${efficiency}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted">
          <span>{efficiency}% efficiency</span>
          <span>Target: 60-80%</span>
        </div>
      </div>
    </div>
  )
}

// Tooltip explanation
export function EffectiveRepsExplanation() {
  return (
    <div className="bg-dark-700 rounded-lg p-3 text-sm max-w-xs">
      <h4 className="font-medium mb-2 flex items-center gap-2">
        <Zap size={14} className="text-amber-400" />
        Effective Reps
      </h4>
      <p className="text-white/60 text-xs mb-2">
        Reps that provide a strong hypertrophy stimulus based on proximity to failure.
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-secondary">RPE 10 (0 RIR)</span>
          <span className="text-green-400">All reps count</span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">RPE 9 (1 RIR)</span>
          <span className="text-green-400">Last 5 reps</span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">RPE 8 (2 RIR)</span>
          <span className="text-blue-400">Last 4 reps</span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">RPE 7 (3 RIR)</span>
          <span className="text-white/60">Last 3 reps</span>
        </div>
      </div>
    </div>
  )
}
