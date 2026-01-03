'use client'

import { useState } from 'react'
import { PlanAssessment, AssessmentTest } from '@/types/training-plan'
import { ClipboardCheck, Calendar, CheckCircle2, Circle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { format, isPast, isThisWeek, isFuture } from 'date-fns'

interface AssessmentCheckpointProps {
  assessments: PlanAssessment[]
  onCompleteAssessment?: (assessmentId: string, results: any) => void
  className?: string
}

function getAssessmentTypeLabel(type: string): string {
  switch (type) {
    case 'mid_phase': return 'Mid-Phase Check'
    case 'end_phase': return 'End of Phase'
    case 'deload': return 'Deload Week'
    case 'final': return 'Final Assessment'
    default: return type
  }
}

function getAssessmentTypeColor(type: string): string {
  switch (type) {
    case 'mid_phase': return 'bg-blue-500/20 text-blue-400'
    case 'end_phase': return 'bg-amber-500/20 text-amber-400'
    case 'deload': return 'bg-green-500/20 text-green-400'
    case 'final': return 'bg-purple-500/20 text-purple-400'
    default: return 'bg-white/10 text-white/60'
  }
}

function AssessmentCard({
  assessment,
  isExpanded,
  onToggle,
  onComplete
}: {
  assessment: PlanAssessment
  isExpanded: boolean
  onToggle: () => void
  onComplete?: () => void
}) {
  const assessmentDate = new Date(assessment.assessment_date)
  const isPastDue = isPast(assessmentDate) && !assessment.completed
  const isUpcoming = isThisWeek(assessmentDate) && !assessment.completed
  const isUpcomingFuture = isFuture(assessmentDate)

  return (
    <div
      className={`rounded-lg overflow-hidden border ${
        assessment.completed
          ? 'border-green-500/30 bg-green-500/5'
          : isPastDue
          ? 'border-red-500/30 bg-red-500/5'
          : isUpcoming
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          {assessment.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : isPastDue ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <Circle className="w-5 h-5 text-muted" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Week {assessment.assessment_week}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${getAssessmentTypeColor(assessment.assessment_type)}`}>
                {getAssessmentTypeLabel(assessment.assessment_type)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="w-3 h-3 text-secondary" />
              <span className="text-xs text-tertiary">
                {format(assessmentDate, 'MMM d, yyyy')}
              </span>
              {isUpcoming && !assessment.completed && (
                <span className="text-xs text-amber-400">This week</span>
              )}
              {isPastDue && (
                <span className="text-xs text-red-400">Overdue</span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-white/5">
          {/* Tests */}
          <div className="mt-3">
            <p className="text-xs text-secondary mb-2">Assessment Tests</p>
            <div className="space-y-2">
              {assessment.tests.map((test, idx) => (
                <div key={idx} className="bg-white/5 rounded p-2">
                  <p className="text-sm font-medium">{test.test_name}</p>
                  <p className="text-xs text-tertiary mt-0.5">{test.protocol}</p>
                  {test.target_value && (
                    <p className="text-xs text-amber-400 mt-1">Target: {test.target_value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Results if completed */}
          {assessment.completed && assessment.results && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-green-400 mb-2">Results Recorded</p>
              <div className="space-y-1">
                {assessment.results.map((result, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-white/60">{result.test_name}</span>
                    <span className="font-medium">{result.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {assessment.notes && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-secondary mb-1">Notes</p>
              <p className="text-sm text-white/70">{assessment.notes}</p>
            </div>
          )}

          {/* Complete button */}
          {!assessment.completed && onComplete && (
            <button
              onClick={onComplete}
              className="mt-3 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded text-sm font-medium transition-colors"
            >
              Record Results
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AssessmentCheckpoint({ assessments, onCompleteAssessment, className = '' }: AssessmentCheckpointProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!assessments || assessments.length === 0) return null

  // Sort by week
  const sortedAssessments = [...assessments].sort((a, b) => a.assessment_week - b.assessment_week)

  // Find next upcoming
  const nextUpcoming = sortedAssessments.find(a => !a.completed && !isPast(new Date(a.assessment_date)))

  // Stats
  const completed = assessments.filter(a => a.completed).length
  const total = assessments.length

  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold">Assessment Checkpoints</h3>
          </div>
          <span className="text-sm text-tertiary">
            {completed}/{total} complete
          </span>
        </div>
        {nextUpcoming && (
          <p className="text-xs text-amber-400 mt-1">
            Next: Week {nextUpcoming.assessment_week} - {format(new Date(nextUpcoming.assessment_date), 'MMM d')}
          </p>
        )}
      </div>

      <div className="p-4 space-y-3">
        {sortedAssessments.map(assessment => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            isExpanded={expandedId === assessment.id}
            onToggle={() => setExpandedId(expandedId === assessment.id ? null : assessment.id)}
            onComplete={onCompleteAssessment ? () => onCompleteAssessment(assessment.id, {}) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
