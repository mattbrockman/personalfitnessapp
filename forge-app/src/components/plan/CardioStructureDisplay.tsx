'use client'

import { CardioStructure, CARDIO_TYPE_LABELS, INTENSITY_COLORS, PrimaryIntensity } from '@/types/training-plan'

interface CardioStructureDisplayProps {
  structure: CardioStructure
  compact?: boolean
}

export function CardioStructureDisplay({ structure, compact = false }: CardioStructureDisplayProps) {
  const totalMinutes = structure.warmup_minutes +
    structure.main_set.reduce((acc, interval) => {
      const duration = interval.duration_minutes * (interval.repeats || 1)
      return acc + duration
    }, 0) +
    structure.cooldown_minutes

  if (compact) {
    return (
      <div className="text-xs text-white/60">
        <span className="text-white/80">{CARDIO_TYPE_LABELS[structure.type]}</span>
        <span className="mx-1">•</span>
        <span>{totalMinutes}min</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <span className="font-medium text-white/80">{CARDIO_TYPE_LABELS[structure.type]}</span>
        <span>•</span>
        <span>{totalMinutes} min total</span>
      </div>

      {/* Visual timeline */}
      <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
        {/* Warmup */}
        <div
          className="bg-gray-500 flex items-center justify-center"
          style={{ width: `${(structure.warmup_minutes / totalMinutes) * 100}%` }}
          title={`Warmup: ${structure.warmup_minutes}min`}
        >
          {structure.warmup_minutes >= 5 && (
            <span className="text-xs text-white/70">W</span>
          )}
        </div>

        {/* Main set intervals */}
        {structure.main_set.map((interval, idx) => {
          const repeats = interval.repeats || 1
          const widthPct = ((interval.duration_minutes * repeats) / totalMinutes) * 100
          const colorClass = INTENSITY_COLORS[interval.intensity as PrimaryIntensity] || 'bg-purple-400'

          return (
            <div
              key={idx}
              className={`${colorClass} flex items-center justify-center`}
              style={{ width: `${widthPct}%` }}
              title={`${interval.intensity.toUpperCase()}: ${interval.duration_minutes}min${repeats > 1 ? ` x${repeats}` : ''}`}
            >
              {widthPct >= 10 && (
                <span className="text-xs text-black/70 font-medium">
                  {interval.intensity.toUpperCase()}
                </span>
              )}
            </div>
          )
        })}

        {/* Cooldown */}
        <div
          className="bg-gray-500 flex items-center justify-center"
          style={{ width: `${(structure.cooldown_minutes / totalMinutes) * 100}%` }}
          title={`Cooldown: ${structure.cooldown_minutes}min`}
        >
          {structure.cooldown_minutes >= 5 && (
            <span className="text-xs text-white/70">C</span>
          )}
        </div>
      </div>

      {/* Legend for intervals */}
      {structure.type === 'intervals' && (
        <div className="flex flex-wrap gap-2 text-xs">
          {structure.main_set.map((interval, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${INTENSITY_COLORS[interval.intensity as PrimaryIntensity] || 'bg-purple-400'}`} />
              <span className="text-white/60">
                {interval.duration_minutes}min {interval.intensity.toUpperCase()}
                {interval.repeats && interval.repeats > 1 && ` x${interval.repeats}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
