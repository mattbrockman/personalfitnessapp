'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Flag,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  ChevronRight,
  Calendar,
  Target,
  Clock,
  Zap,
  Activity,
} from 'lucide-react'

interface PhaseTimelineData {
  id: string
  name: string
  type: string
  startDate: string
  endDate: string
  originalEndDate: string | null
  projectedEndDate: string
  status: 'completed' | 'current' | 'upcoming'
  progressPercent: number
}

interface PhaseAnalysis {
  phaseId: string | null
  phaseName: string
  phaseType: string
  startDate: string
  originalEndDate: string
  projectedEndDate: string
  daysRemaining: number
  percentComplete: number
  progress: {
    status: 'ahead' | 'on_track' | 'behind' | 'at_risk'
    strengthProgressPercent: number
    complianceAvg: number
    weeksCompleted: number
    weeksTotal: number
  }
  recommendations: {
    shouldExtend: boolean
    shouldShorten: boolean
    shouldInsertRecovery: boolean
    extensionDays: number
    reason: string | null
  }
}

interface PhaseTimelineWidgetProps {
  planId: string
  compact?: boolean
}

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  base: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  build: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  peak: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  taper: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  recovery: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  competition: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
}

const PHASE_LABELS: Record<string, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  recovery: 'Recovery',
  competition: 'Competition',
}

export function PhaseTimelineWidget({ planId, compact = false }: PhaseTimelineWidgetProps) {
  const [phases, setPhases] = useState<PhaseTimelineData[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<PhaseAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  // Fetch phase timeline
  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/adaptation/phase-review?plan_id=${planId}&include_timeline=true`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch phase timeline')
      }

      const data = await res.json()
      if (data.timeline) {
        setPhases(data.timeline.phases || [])
        setCurrentAnalysis(data.timeline.currentPhaseAnalysis || null)
      }
    } catch (err) {
      console.error('Error fetching phase timeline:', err)
      setError(err instanceof Error ? err.message : 'Failed to load phase timeline')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  // Run phase review
  const handleRunReview = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/adaptation/phase-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })

      if (!res.ok) {
        throw new Error('Failed to run phase review')
      }

      await fetchTimeline()
    } catch (err) {
      console.error('Error running phase review:', err)
    } finally {
      setRunning(false)
    }
  }

  // Get progress status display
  const getProgressStatusDisplay = (status: string) => {
    switch (status) {
      case 'ahead':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Ahead', icon: TrendingUp }
      case 'on_track':
        return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'On Track', icon: Check }
      case 'behind':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Behind', icon: TrendingDown }
      case 'at_risk':
        return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'At Risk', icon: AlertTriangle }
      default:
        return { color: 'text-white/60', bg: 'bg-white/10', label: status, icon: Activity }
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Calculate days between dates
  const daysBetween = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-purple-400" />
          <span className="ml-2 text-sm text-white/60">Loading phase timeline...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle size={16} />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchTimeline}
          className="mt-2 text-sm text-purple-400 hover:text-purple-300"
        >
          Try again
        </button>
      </div>
    )
  }

  // No phases
  if (phases.length === 0) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/10">
            <Calendar size={16} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-medium">No Phases</p>
            <p className="text-xs text-tertiary">No training phases defined</p>
          </div>
        </div>
      </div>
    )
  }

  const currentPhase = phases.find(p => p.status === 'current')
  const progressStatus = currentAnalysis?.progress.status
    ? getProgressStatusDisplay(currentAnalysis.progress.status)
    : null

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-purple-400" />
            <h3 className="font-semibold">Phase Timeline</h3>
          </div>
          <button
            onClick={fetchTimeline}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Current Phase Summary */}
      {currentAnalysis && (
        <div className="p-4 border-b border-white/5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-tertiary uppercase tracking-wide mb-1">Current Phase</p>
              <p className="font-semibold">{currentAnalysis.phaseName}</p>
            </div>
            {progressStatus && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${progressStatus.bg}`}>
                <progressStatus.icon size={12} className={progressStatus.color} />
                <span className={`text-xs ${progressStatus.color}`}>{progressStatus.label}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/60">Progress</span>
              <span>{currentAnalysis.percentComplete}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  currentAnalysis.progress.status === 'ahead' ? 'bg-emerald-400' :
                  currentAnalysis.progress.status === 'at_risk' ? 'bg-red-400' :
                  currentAnalysis.progress.status === 'behind' ? 'bg-amber-400' :
                  'bg-blue-400'
                }`}
                style={{ width: `${currentAnalysis.percentComplete}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Clock size={12} className="text-white/60 mx-auto mb-1" />
              <p className="text-sm font-semibold">{currentAnalysis.daysRemaining}</p>
              <p className="text-xs text-tertiary">days left</p>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Target size={12} className="text-white/60 mx-auto mb-1" />
              <p className="text-sm font-semibold">{Math.round(currentAnalysis.progress.strengthProgressPercent)}%</p>
              <p className="text-xs text-tertiary">strength</p>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Zap size={12} className="text-white/60 mx-auto mb-1" />
              <p className="text-sm font-semibold">
                {currentAnalysis.progress.complianceAvg != null && !isNaN(currentAnalysis.progress.complianceAvg)
                  ? `${Math.round(currentAnalysis.progress.complianceAvg * 100)}%`
                  : '—'}
              </p>
              <p className="text-xs text-tertiary">compliance</p>
            </div>
          </div>

          {/* Projection alert */}
          {currentAnalysis.projectedEndDate !== currentAnalysis.originalEndDate && (
            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-amber-400">
                  {currentAnalysis.projectedEndDate > currentAnalysis.originalEndDate
                    ? `May extend to ${formatDate(currentAnalysis.projectedEndDate)}`
                    : `Could end early: ${formatDate(currentAnalysis.projectedEndDate)}`
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase Timeline Visual */}
      {!compact && (
        <div className="p-4">
          <p className="text-xs text-tertiary uppercase tracking-wide mb-3">All Phases</p>
          <div className="space-y-2">
            {phases.map((phase, index) => {
              const colors = PHASE_COLORS[phase.type] || PHASE_COLORS.build
              const isLast = index === phases.length - 1

              return (
                <div key={phase.id} className="relative">
                  {/* Connector line */}
                  {!isLast && (
                    <div className="absolute left-4 top-10 w-0.5 h-4 bg-white/10" />
                  )}

                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    phase.status === 'current'
                      ? `${colors.bg} ${colors.border}`
                      : 'bg-white/5 border-transparent'
                  }`}>
                    {/* Status indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      phase.status === 'completed' ? 'bg-emerald-500/20' :
                      phase.status === 'current' ? colors.bg :
                      'bg-white/10'
                    }`}>
                      {phase.status === 'completed' ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : phase.status === 'current' ? (
                        <Activity size={14} className={colors.text} />
                      ) : (
                        <Clock size={14} className="text-white/40" />
                      )}
                    </div>

                    {/* Phase info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${
                          phase.status === 'upcoming' ? 'text-white/60' : ''
                        }`}>
                          {phase.name}
                        </p>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${colors.bg} ${colors.text}`}>
                          {PHASE_LABELS[phase.type] || phase.type}
                        </span>
                      </div>
                      <p className="text-xs text-tertiary">
                        {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
                        {phase.originalEndDate && phase.originalEndDate !== phase.endDate && (
                          <span className="text-amber-400 ml-1">
                            (was {formatDate(phase.originalEndDate)})
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Progress for current/completed */}
                    {phase.status !== 'upcoming' && (
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          phase.status === 'completed' ? 'text-emerald-400' : colors.text
                        }`}>
                          {phase.progressPercent}%
                        </p>
                        <p className="text-xs text-tertiary">
                          {daysBetween(phase.startDate, phase.endDate)} days
                        </p>
                      </div>
                    )}

                    {/* Duration for upcoming */}
                    {phase.status === 'upcoming' && (
                      <div className="text-right">
                        <p className="text-sm text-white/60">
                          {daysBetween(phase.startDate, phase.endDate)} days
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Run Review Button */}
      {currentAnalysis?.recommendations.reason && (
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleRunReview}
            disabled={running}
            className="w-full py-2.5 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running Review...
              </>
            ) : (
              <>
                Run Phase Review
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
