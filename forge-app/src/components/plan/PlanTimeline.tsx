'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  TrainingPhase,
  PlanEvent,
  PHASE_COLORS,
  PHASE_LABELS,
  EVENT_TYPE_ICONS,
  ACTIVITY_LABELS,
  ActivityType,
} from '@/types/training-plan'

interface PlanTimelineProps {
  phases: TrainingPhase[]
  events: PlanEvent[]
  expandedPhases: string[]
  onTogglePhase: (phaseId: string) => void
}

export function PlanTimeline({
  phases,
  events,
  expandedPhases,
  onTogglePhase,
}: PlanTimelineProps) {
  const today = new Date().toISOString().split('T')[0]

  // Calculate timeline bounds
  const { startDate, endDate, totalWeeks } = useMemo(() => {
    if (phases.length === 0) {
      return { startDate: today, endDate: today, totalWeeks: 0 }
    }

    const dates = phases.flatMap(p => [p.start_date, p.end_date])
    const start = dates.reduce((a, b) => (a < b ? a : b))
    const end = dates.reduce((a, b) => (a > b ? a : b))

    const startD = new Date(start)
    const endD = new Date(end)
    const weeks = Math.ceil((endD.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000))

    return { startDate: start, endDate: end, totalWeeks: weeks }
  }, [phases, today])

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { date: string; label: string; position: number }[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    let current = new Date(start.getFullYear(), start.getMonth(), 1)

    while (current <= end) {
      const position = getPositionPercent(current.toISOString().split('T')[0], startDate, totalWeeks)
      if (position >= 0 && position <= 100) {
        markers.push({
          date: current.toISOString().split('T')[0],
          label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          position,
        })
      }
      current.setMonth(current.getMonth() + 1)
    }

    return markers
  }, [startDate, endDate, totalWeeks])

  // Position helper
  function getPositionPercent(date: string, start: string, weeks: number): number {
    const startMs = new Date(start).getTime()
    const dateMs = new Date(date).getTime()
    const totalMs = weeks * 7 * 24 * 60 * 60 * 1000
    return ((dateMs - startMs) / totalMs) * 100
  }

  // Get phase width
  function getPhaseWidth(phase: TrainingPhase): number {
    const startPos = getPositionPercent(phase.start_date, startDate, totalWeeks)
    const endPos = getPositionPercent(phase.end_date, startDate, totalWeeks)
    return Math.max(endPos - startPos, 2) // minimum 2% width
  }

  // Get phase position
  function getPhasePosition(phase: TrainingPhase): number {
    return getPositionPercent(phase.start_date, startDate, totalWeeks)
  }

  // Today marker position
  const todayPosition = getPositionPercent(today, startDate, totalWeeks)

  if (phases.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-tertiary">No phases defined yet</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 lg:p-6">
      <h3 className="text-sm font-medium text-white/60 mb-4">Training Timeline</h3>

      {/* Timeline Container */}
      <div className="relative">
        {/* Month markers */}
        <div className="relative h-6 mb-2">
          {monthMarkers.map((marker, idx) => (
            <div
              key={idx}
              className="absolute text-xs text-secondary"
              style={{ left: `${marker.position}%` }}
            >
              {marker.label}
            </div>
          ))}
        </div>

        {/* Phase bars */}
        <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden">
          {phases.map(phase => {
            const width = getPhaseWidth(phase)
            const left = getPhasePosition(phase)
            const isExpanded = expandedPhases.includes(phase.id)

            return (
              <button
                key={phase.id}
                onClick={() => onTogglePhase(phase.id)}
                className={`absolute top-1 bottom-1 rounded-md transition-all hover:brightness-110 ${PHASE_COLORS[phase.phase_type]} flex items-center justify-center overflow-hidden`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  minWidth: '40px',
                }}
                title={`${phase.name} (${PHASE_LABELS[phase.phase_type]})`}
              >
                <span className="text-xs font-medium text-black/80 truncate px-1">
                  {width > 8 ? phase.name : ''}
                </span>
              </button>
            )
          })}

          {/* Today marker */}
          {todayPosition >= 0 && todayPosition <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
              style={{ left: `${todayPosition}%` }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-white bg-white/20 px-1 rounded">
                Today
              </div>
            </div>
          )}
        </div>

        {/* Events row */}
        {events.length > 0 && (
          <div className="relative h-8 mt-2">
            {events.map(event => {
              const position = getPositionPercent(event.event_date, startDate, totalWeeks)
              if (position < 0 || position > 100) return null

              return (
                <div
                  key={event.id}
                  className="absolute -translate-x-1/2 cursor-pointer group"
                  style={{ left: `${position}%` }}
                  title={`${event.name} (${event.event_type})`}
                >
                  <span className="text-lg">{EVENT_TYPE_ICONS[event.event_type]}</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                    <div className="bg-zinc-800 text-xs px-2 py-1 rounded whitespace-nowrap">
                      {event.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Expanded Phase Details */}
      {phases.filter(p => expandedPhases.includes(p.id)).map(phase => (
        <PhaseDetail key={phase.id} phase={phase} />
      ))}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="text-xs text-secondary mb-2">Phase Types</p>
        <div className="flex flex-wrap gap-3">
          {(['base', 'build', 'peak', 'taper', 'recovery', 'transition'] as const).map(type => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${PHASE_COLORS[type]}`} />
              <span className="text-xs text-white/60">{PHASE_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PhaseDetail({ phase }: { phase: TrainingPhase }) {
  const activities = Object.entries(phase.activity_distribution || {}) as [ActivityType, number][]

  return (
    <div className="mt-4 p-4 bg-white/5 rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-4 h-4 rounded ${PHASE_COLORS[phase.phase_type]}`} />
        <h4 className="font-semibold">{phase.name}</h4>
        <span className="text-sm text-tertiary">
          {new Date(phase.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' - '}
          {new Date(phase.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-tertiary">Type</p>
          <p className="font-medium">{PHASE_LABELS[phase.phase_type]}</p>
        </div>
        <div>
          <p className="text-xs text-tertiary">Volume</p>
          <p className="font-medium">{Math.round(phase.volume_modifier * 100)}%</p>
        </div>
        <div>
          <p className="text-xs text-tertiary">Intensity</p>
          <p className="font-medium">{Math.round(phase.intensity_modifier * 100)}%</p>
        </div>
        <div>
          <p className="text-xs text-tertiary">Focus</p>
          <p className="font-medium capitalize">{phase.intensity_focus || 'Balanced'}</p>
        </div>
      </div>

      {/* Activity Distribution Bar */}
      {activities.length > 0 && (
        <div>
          <p className="text-xs text-tertiary mb-2">Activity Distribution</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-white/10">
            {activities.map(([activity, pct], idx) => (
              <div
                key={activity}
                className={`h-full ${getActivityColor(activity)}`}
                style={{ width: `${pct}%` }}
                title={`${ACTIVITY_LABELS[activity]}: ${pct}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {activities.map(([activity, pct]) => (
              <div key={activity} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded ${getActivityColor(activity)}`} />
                <span className="text-xs text-white/60">
                  {ACTIVITY_LABELS[activity]}: {pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase.description && (
        <p className="text-sm text-white/60 mt-3">{phase.description}</p>
      )}

      {/* Weekly Targets Preview */}
      {phase.weekly_targets && phase.weekly_targets.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-tertiary mb-2">Weekly Breakdown</p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-1">
            {phase.weekly_targets.slice(0, 7).map(week => (
              <div
                key={week.id}
                className={`p-2 rounded text-center text-xs ${
                  week.week_type === 'deload' || week.week_type === 'recovery'
                    ? 'bg-green-500/20'
                    : week.week_type === 'race'
                    ? 'bg-red-500/20'
                    : 'bg-white/10'
                }`}
              >
                <p className="font-medium">W{week.week_number}</p>
                <p className="text-tertiary">{week.target_hours || '—'}h</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getActivityColor(activity: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    cycling: 'bg-blue-500',
    running: 'bg-green-500',
    swimming: 'bg-cyan-500',
    lifting: 'bg-amber-500',
    soccer: 'bg-emerald-500',
    tennis: 'bg-yellow-500',
    skiing: 'bg-sky-500',
    other: 'bg-purple-500',
    rest: 'bg-gray-500',
  }
  return colors[activity] || 'bg-gray-500'
}
