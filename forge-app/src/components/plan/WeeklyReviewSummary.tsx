'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Battery,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  ChevronRight,
  Clock,
  Target,
  Zap,
  Heart,
} from 'lucide-react'

interface WeekAnalysis {
  weekId: string | null
  weekNumber: number
  weekStartDate: string
  weekType: string
  compliance: {
    hoursPercent: number
    tssPercent: number
    isLow: boolean
    consecutiveLowWeeks: number
  }
  recovery: {
    needsRecovery: boolean
    tsbStatus: 'fresh' | 'neutral' | 'fatigued' | 'very_fatigued'
    readinessTrend: 'improving' | 'stable' | 'declining'
    avgReadiness7Day: number
  }
  volumeRecommendation: 'increase' | 'maintain' | 'decrease' | null
  suggestedWeekType: string | null
}

interface WeeklyReviewSummaryProps {
  planId: string
  onRunReview?: () => void
}

export function WeeklyReviewSummary({ planId, onRunReview }: WeeklyReviewSummaryProps) {
  const [analysis, setAnalysis] = useState<WeekAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [hasRecommendation, setHasRecommendation] = useState(false)
  const [potentialRecs, setPotentialRecs] = useState(0)

  // Fetch weekly analysis
  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/adaptation/weekly-review?plan_id=${planId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch weekly review')
      }

      const data = await res.json()
      setAnalysis(data.analysis)
      setHasRecommendation(data.has_recommendation)
      setPotentialRecs(data.potential_recommendations)
    } catch (err) {
      console.error('Error fetching weekly review:', err)
      setError(err instanceof Error ? err.message : 'Failed to load weekly review')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  // Run full weekly review
  const handleRunReview = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/adaptation/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })

      if (!res.ok) {
        throw new Error('Failed to run weekly review')
      }

      // Refresh analysis
      await fetchAnalysis()

      if (onRunReview) {
        onRunReview()
      }
    } catch (err) {
      console.error('Error running weekly review:', err)
    } finally {
      setRunning(false)
    }
  }

  // Get TSB status color and icon
  const getTsbDisplay = (status: string) => {
    switch (status) {
      case 'fresh':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Fresh' }
      case 'neutral':
        return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Balanced' }
      case 'fatigued':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Fatigued' }
      case 'very_fatigued':
        return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Very Fatigued' }
      default:
        return { color: 'text-white/60', bg: 'bg-white/10', label: status }
    }
  }

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={14} className="text-emerald-400" />
      case 'declining':
        return <TrendingDown size={14} className="text-red-400" />
      default:
        return <Activity size={14} className="text-white/60" />
    }
  }

  // Get compliance color
  const getComplianceColor = (percent: number) => {
    if (percent >= 0.9) return 'text-emerald-400'
    if (percent >= 0.8) return 'text-blue-400'
    if (percent >= 0.6) return 'text-amber-400'
    return 'text-red-400'
  }

  // Format week dates
  const formatWeekDates = (startDate: string) => {
    const start = new Date(startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`
  }

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-blue-400" />
          <span className="ml-2 text-sm text-white/60">Analyzing this week...</span>
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
          onClick={fetchAnalysis}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    )
  }

  // No analysis available
  if (!analysis) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/10">
            <Calendar size={16} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-medium">No Week Data</p>
            <p className="text-xs text-tertiary">No weekly target found for this week</p>
          </div>
        </div>
      </div>
    )
  }

  const tsbDisplay = getTsbDisplay(analysis.recovery.tsbStatus)

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-400" />
            <div>
              <h3 className="font-semibold">Week {analysis.weekNumber} Review</h3>
              <p className="text-xs text-tertiary">{formatWeekDates(analysis.weekStartDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${
              analysis.weekType === 'recovery' ? 'bg-emerald-500/20 text-emerald-400' :
              analysis.weekType === 'deload' ? 'bg-blue-500/20 text-blue-400' :
              'bg-white/10 text-white/60'
            }`}>
              {analysis.weekType}
            </span>
            <button
              onClick={fetchAnalysis}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className="text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4">
        {/* Compliance metrics */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-white/60" />
            <span className="text-xs text-tertiary uppercase tracking-wide">Compliance</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-white/60" />
                  <span className="text-xs text-white/60">Hours</span>
                </div>
                <span className={`text-sm font-semibold ${getComplianceColor(analysis.compliance.hoursPercent)}`}>
                  {Math.round(analysis.compliance.hoursPercent * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    analysis.compliance.hoursPercent >= 0.8 ? 'bg-emerald-400' :
                    analysis.compliance.hoursPercent >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(100, analysis.compliance.hoursPercent * 100)}%` }}
                />
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-white/60" />
                  <span className="text-xs text-white/60">TSS</span>
                </div>
                <span className={`text-sm font-semibold ${getComplianceColor(analysis.compliance.tssPercent)}`}>
                  {Math.round(analysis.compliance.tssPercent * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    analysis.compliance.tssPercent >= 0.8 ? 'bg-emerald-400' :
                    analysis.compliance.tssPercent >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(100, analysis.compliance.tssPercent * 100)}%` }}
                />
              </div>
            </div>
          </div>
          {analysis.compliance.consecutiveLowWeeks >= 2 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle size={12} />
              <span>{analysis.compliance.consecutiveLowWeeks} weeks below target</span>
            </div>
          )}
        </div>

        {/* Recovery state */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} className="text-white/60" />
            <span className="text-xs text-tertiary uppercase tracking-wide">Recovery State</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <span className="text-xs text-white/60 block mb-1">TSB Status</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${tsbDisplay.bg} ${tsbDisplay.color}`}>
                {tsbDisplay.label}
              </span>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <span className="text-xs text-white/60 block mb-1">Trend</span>
              <div className="flex items-center justify-center gap-1">
                {getTrendIcon(analysis.recovery.readinessTrend)}
                <span className="text-xs capitalize">{analysis.recovery.readinessTrend}</span>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <span className="text-xs text-white/60 block mb-1">Readiness</span>
              <span className={`text-sm font-semibold ${
                analysis.recovery.avgReadiness7Day >= 70 ? 'text-emerald-400' :
                analysis.recovery.avgReadiness7Day >= 50 ? 'text-blue-400' :
                analysis.recovery.avgReadiness7Day >= 40 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {Math.round(analysis.recovery.avgReadiness7Day)}
              </span>
            </div>
          </div>
        </div>

        {/* Recommendations indicator */}
        {(analysis.recovery.needsRecovery || analysis.volumeRecommendation || analysis.suggestedWeekType) && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Battery size={16} className="text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-400">
                  {analysis.recovery.needsRecovery
                    ? 'Recovery Recommended'
                    : analysis.volumeRecommendation === 'decrease'
                    ? 'Volume Reduction Suggested'
                    : analysis.volumeRecommendation === 'increase'
                    ? 'Ready for More Volume'
                    : 'Adjustment Suggested'}
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  {analysis.recovery.needsRecovery
                    ? 'Your body is showing signs of accumulated fatigue'
                    : analysis.volumeRecommendation === 'decrease'
                    ? 'Consider reducing weekly targets'
                    : analysis.volumeRecommendation === 'increase'
                    ? 'Good recovery state indicates capacity for progression'
                    : 'Review recommendations for details'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No issues indicator */}
        {!analysis.recovery.needsRecovery && !analysis.volumeRecommendation && !analysis.compliance.isLow && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-400">On Track</p>
                <p className="text-xs text-white/60">Training load and recovery are balanced</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with action */}
      {potentialRecs > 0 && (
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleRunReview}
            disabled={running}
            className="w-full py-2.5 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running Review...
              </>
            ) : (
              <>
                Generate {potentialRecs} Recommendation{potentialRecs > 1 ? 's' : ''}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
