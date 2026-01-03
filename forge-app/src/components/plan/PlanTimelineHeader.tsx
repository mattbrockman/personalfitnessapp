'use client'

import { useMemo } from 'react'
import {
  TrainingPhase,
  PHASE_COLORS,
  PHASE_LABELS,
} from '@/types/training-plan'
import { format, parseISO, differenceInWeeks, startOfWeek, addWeeks, isSameWeek } from 'date-fns'

interface PlanTimelineHeaderProps {
  phases: TrainingPhase[]
  planStartDate: string
  planEndDate: string | null
  currentWeekStart: Date
  onWeekSelect: (weekStart: Date) => void
}

export function PlanTimelineHeader({
  phases,
  planStartDate,
  planEndDate,
  currentWeekStart,
  onWeekSelect,
}: PlanTimelineHeaderProps) {
  // Calculate total plan duration and phase widths
  const timelineData = useMemo(() => {
    if (!phases.length) return null

    const planStart = parseISO(planStartDate)
    const planEnd = planEndDate ? parseISO(planEndDate) : addWeeks(planStart, 12)
    const totalWeeks = differenceInWeeks(planEnd, planStart) + 1

    // Calculate weeks for each phase
    const phasesWithWeeks = phases.map(phase => {
      const phaseStart = parseISO(phase.start_date)
      const phaseEnd = parseISO(phase.end_date)
      const weeks = differenceInWeeks(phaseEnd, phaseStart) + 1
      const startWeek = differenceInWeeks(phaseStart, planStart) + 1
      return {
        ...phase,
        weeks,
        startWeek,
        widthPercent: (weeks / totalWeeks) * 100,
      }
    })

    // Generate week markers
    const weekMarkers: Array<{
      weekNumber: number
      weekStart: Date
      phaseId: string
    }> = []

    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = addWeeks(startOfWeek(planStart, { weekStartsOn: 1 }), i)
      const phase = phasesWithWeeks.find(p => {
        const pStart = parseISO(p.start_date)
        const pEnd = parseISO(p.end_date)
        return weekStart >= startOfWeek(pStart, { weekStartsOn: 1 }) &&
               weekStart <= pEnd
      })
      weekMarkers.push({
        weekNumber: i + 1,
        weekStart,
        phaseId: phase?.id || '',
      })
    }

    // Find current week index
    const today = new Date()
    const currentWeekIndex = weekMarkers.findIndex(w =>
      isSameWeek(w.weekStart, today, { weekStartsOn: 1 })
    )

    return {
      totalWeeks,
      phases: phasesWithWeeks,
      weekMarkers,
      currentWeekIndex,
    }
  }, [phases, planStartDate, planEndDate])

  if (!timelineData) {
    return null
  }

  const { phases: phasesWithWeeks, weekMarkers, currentWeekIndex } = timelineData

  // Find selected week index
  const selectedWeekIndex = weekMarkers.findIndex(w =>
    isSameWeek(w.weekStart, currentWeekStart, { weekStartsOn: 1 })
  )

  return (
    <div className="glass rounded-xl p-4 mb-6">
      {/* Macro level - Phases */}
      <div className="mb-1">
        <p className="text-xs text-secondary uppercase tracking-wider mb-1">Phases</p>
        <div className="flex h-8 rounded-lg overflow-hidden">
          {phasesWithWeeks.map((phase, idx) => (
            <button
              key={phase.id}
              onClick={() => {
                const firstWeek = weekMarkers.find(w => w.phaseId === phase.id)
                if (firstWeek) onWeekSelect(firstWeek.weekStart)
              }}
              className={`${PHASE_COLORS[phase.phase_type]} hover:brightness-110 transition-all relative group`}
              style={{ width: `${phase.widthPercent}%` }}
              title={`${phase.name} (${phase.weeks} weeks)`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90 truncate px-1">
                {phase.widthPercent > 15 ? PHASE_LABELS[phase.phase_type] : ''}
              </span>
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {phase.name} ({phase.weeks}w)
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Meso level - Weeks */}
      <div className="relative mt-3">
        <p className="text-xs text-secondary uppercase tracking-wider mb-1">Weeks</p>
        <div className="flex h-6 bg-white/5 rounded overflow-hidden">
          {weekMarkers.map((week, idx) => {
            const isCurrentWeek = idx === currentWeekIndex
            const isSelectedWeek = idx === selectedWeekIndex
            const phase = phasesWithWeeks.find(p => p.id === week.phaseId)

            return (
              <button
                key={idx}
                onClick={() => onWeekSelect(week.weekStart)}
                className={`flex-1 min-w-0 text-xs font-medium transition-all border-r border-white/5 last:border-r-0 ${
                  isSelectedWeek
                    ? 'bg-amber-500 text-black'
                    : isCurrentWeek
                    ? 'bg-white/20 text-white'
                    : 'hover:bg-white/10 text-white/60'
                }`}
                title={`Week ${week.weekNumber} - ${format(week.weekStart, 'MMM d')}`}
              >
                {weekMarkers.length <= 16 ? week.weekNumber : (idx % 2 === 0 ? week.weekNumber : '')}
              </button>
            )
          })}
        </div>

        {/* Current week indicator line */}
        {currentWeekIndex >= 0 && currentWeekIndex !== selectedWeekIndex && (
          <div
            className="absolute top-6 h-6 w-0.5 bg-red-500 pointer-events-none"
            style={{
              left: `${((currentWeekIndex + 0.5) / weekMarkers.length) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 text-xs">
        <div className="flex items-center gap-4">
          {currentWeekIndex >= 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-tertiary">Today</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-tertiary">Selected</span>
          </div>
        </div>
        <div className="text-secondary">
          {format(currentWeekStart, 'MMM d')} - {format(addWeeks(currentWeekStart, 1), 'MMM d, yyyy')}
        </div>
      </div>
    </div>
  )
}
