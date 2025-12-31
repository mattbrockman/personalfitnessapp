'use client'

import { calculateRelativeIntensity } from '@/lib/strength-calculations'

interface RelativeIntensityBadgeProps {
  weight: number
  estimated1RM: number | null
  showWeight?: boolean
  compact?: boolean
}

export function RelativeIntensityBadge({
  weight,
  estimated1RM,
  showWeight = true,
  compact = false,
}: RelativeIntensityBadgeProps) {
  if (!estimated1RM || estimated1RM <= 0 || weight <= 0) {
    return showWeight ? (
      <span className="text-white/70">{weight} lbs</span>
    ) : null
  }

  const relativeIntensity = calculateRelativeIntensity(weight, estimated1RM)

  // Color based on intensity zone
  const getIntensityColor = (ri: number) => {
    if (ri >= 90) return 'text-red-400 bg-red-500/10' // Very heavy
    if (ri >= 80) return 'text-amber-400 bg-amber-500/10' // Heavy
    if (ri >= 70) return 'text-yellow-400 bg-yellow-500/10' // Moderate-heavy
    if (ri >= 60) return 'text-green-400 bg-green-500/10' // Moderate
    return 'text-blue-400 bg-blue-500/10' // Light
  }

  const getIntensityLabel = (ri: number) => {
    if (ri >= 90) return 'Max'
    if (ri >= 80) return 'Heavy'
    if (ri >= 70) return 'Mod-Heavy'
    if (ri >= 60) return 'Moderate'
    return 'Light'
  }

  const colorClass = getIntensityColor(relativeIntensity)

  if (compact) {
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
        {relativeIntensity}%
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showWeight && (
        <span className="text-white/90 font-medium">{weight} lbs</span>
      )}
      <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
        {relativeIntensity}% 1RM
      </span>
    </div>
  )
}

// Tooltip version for more detail
export function RelativeIntensityTooltip({
  weight,
  estimated1RM,
}: {
  weight: number
  estimated1RM: number | null
}) {
  if (!estimated1RM || estimated1RM <= 0 || weight <= 0) {
    return null
  }

  const relativeIntensity = calculateRelativeIntensity(weight, estimated1RM)

  const getZoneDescription = (ri: number) => {
    if (ri >= 90) return 'Maximal zone (1-3 reps typical)'
    if (ri >= 80) return 'Strength zone (3-6 reps typical)'
    if (ri >= 70) return 'Power/Strength zone (6-8 reps typical)'
    if (ri >= 60) return 'Hypertrophy zone (8-12 reps typical)'
    return 'Endurance zone (12+ reps)'
  }

  return (
    <div className="bg-dark-700 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50">Weight</span>
        <span className="font-medium">{weight} lbs</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50">Estimated 1RM</span>
        <span className="font-medium">{estimated1RM} lbs</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50">Relative Intensity</span>
        <span className="font-medium text-amber-400">{relativeIntensity}%</span>
      </div>
      <div className="pt-2 border-t border-white/10 text-xs text-white/40">
        {getZoneDescription(relativeIntensity)}
      </div>
    </div>
  )
}
