'use client'

import { TrainingPhase, PHASE_COLORS, PHASE_LABELS, TrainingParameters } from '@/types/training-plan'
import { Calendar, Zap, TrendingUp, Activity } from 'lucide-react'
import { format, differenceInWeeks } from 'date-fns'

interface EnhancedTrainingPhase extends TrainingPhase {
  training_parameters?: TrainingParameters
}

interface ProgramArchitectureTableProps {
  phases: EnhancedTrainingPhase[]
  className?: string
}

function formatDateCompact(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d')
}

function getPhaseWeeks(phase: TrainingPhase): number {
  return differenceInWeeks(new Date(phase.end_date), new Date(phase.start_date)) + 1
}

export function ProgramArchitectureTable({ phases, className = '' }: ProgramArchitectureTableProps) {
  if (!phases || phases.length === 0) return null

  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold">Program Architecture</h3>
        </div>
        <p className="text-xs text-tertiary mt-1">
          {phases.length} phases • {phases.reduce((acc, p) => acc + getPhaseWeeks(p), 0)} weeks total
        </p>
      </div>

      {/* Timeline Visual */}
      <div className="p-4 border-b border-white/5">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {phases.map((phase, idx) => {
            const weeks = getPhaseWeeks(phase)
            const totalWeeks = phases.reduce((acc, p) => acc + getPhaseWeeks(p), 0)
            const widthPercent = (weeks / totalWeeks) * 100

            return (
              <div
                key={phase.id || idx}
                className={`${PHASE_COLORS[phase.phase_type]} flex items-center justify-center transition-all hover:brightness-110`}
                style={{ width: `${widthPercent}%` }}
                title={`${phase.name}: ${weeks} weeks`}
              >
                <span className="text-xs font-medium text-white/90 truncate px-1">
                  {weeks}w
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex mt-2 gap-3 flex-wrap">
          {phases.map((phase, idx) => (
            <div key={phase.id || idx} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${PHASE_COLORS[phase.phase_type]}`} />
              <span className="text-xs text-white/60">{PHASE_LABELS[phase.phase_type]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Details Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-3 text-xs text-secondary font-medium">Phase</th>
              <th className="text-left p-3 text-xs text-secondary font-medium">Dates</th>
              <th className="text-center p-3 text-xs text-secondary font-medium">Weeks</th>
              <th className="text-left p-3 text-xs text-secondary font-medium">Focus</th>
              <th className="text-left p-3 text-xs text-secondary font-medium hidden md:table-cell">Parameters</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase, idx) => (
              <tr
                key={phase.id || idx}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-8 rounded-sm ${PHASE_COLORS[phase.phase_type]}`} />
                    <div>
                      <p className="font-medium">{phase.name}</p>
                      <p className="text-xs text-secondary capitalize">{phase.phase_type}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <p className="text-white/80">
                    {formatDateCompact(phase.start_date)} - {formatDateCompact(phase.end_date)}
                  </p>
                </td>
                <td className="p-3 text-center">
                  <span className="px-2 py-1 bg-white/10 rounded text-white/80">
                    {getPhaseWeeks(phase)}
                  </span>
                </td>
                <td className="p-3">
                  <span className="capitalize text-white/80">{phase.intensity_focus}</span>
                  {phase.volume_modifier !== 1.0 && (
                    <span className="ml-2 text-xs text-amber-400">
                      {phase.volume_modifier > 1 ? '+' : ''}{Math.round((phase.volume_modifier - 1) * 100)}% vol
                    </span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell">
                  {phase.training_parameters ? (
                    <div className="text-xs text-white/60 space-y-0.5">
                      {phase.training_parameters.rep_range && (
                        <p>Reps: {phase.training_parameters.rep_range}</p>
                      )}
                      {phase.training_parameters.intensity_percent && (
                        <p>Intensity: {phase.training_parameters.intensity_percent}</p>
                      )}
                      {phase.training_parameters.tempo && (
                        <p>Tempo: {phase.training_parameters.tempo}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phase Descriptions */}
      <div className="p-4 space-y-3">
        {phases.map((phase, idx) => (
          phase.description && (
            <div key={phase.id || idx} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-sm ${PHASE_COLORS[phase.phase_type]}`} />
                <span className="text-sm font-medium">{phase.name}</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{phase.description}</p>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
