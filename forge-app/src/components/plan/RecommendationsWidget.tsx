'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Lightbulb,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  Loader2,
  Zap,
  RefreshCw,
  Clock,
  Eye,
} from 'lucide-react'
import type { PlanRecommendation } from '@/types/training-plan'
import { WhatIfPreviewModal } from './WhatIfPreviewModal'

interface RecommendationsWidgetProps {
  planId: string
  onRecommendationApplied?: () => void
  compact?: boolean
}

interface RecommendationWithMeta extends PlanRecommendation {
  plan_name?: string
}

export function RecommendationsWidget({
  planId,
  onRecommendationApplied,
  compact = false,
}: RecommendationsWidgetProps) {
  const [recommendations, setRecommendations] = useState<RecommendationWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [responding, setResponding] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [previewingRec, setPreviewingRec] = useState<RecommendationWithMeta | null>(null)

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/recommendations?plan_id=${planId}&status=pending`)
      if (!res.ok) {
        throw new Error('Failed to fetch recommendations')
      }

      const data = await res.json()
      setRecommendations(data.recommendations || [])
      setPendingCount(data.pending_count || 0)
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  // Handle response to recommendation
  const handleRespond = async (
    recommendationId: string,
    action: 'accept' | 'modify' | 'dismiss',
    notes?: string
  ) => {
    setResponding(recommendationId)
    try {
      const res = await fetch(`/api/recommendations/${recommendationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_notes: notes }),
      })

      if (!res.ok) {
        throw new Error('Failed to respond to recommendation')
      }

      // Remove from list
      setRecommendations(prev => prev.filter(r => r.id !== recommendationId))
      setPendingCount(prev => Math.max(0, prev - 1))

      if (action === 'accept' && onRecommendationApplied) {
        onRecommendationApplied()
      }
    } catch (err) {
      console.error('Error responding to recommendation:', err)
    } finally {
      setResponding(null)
    }
  }

  // Get recommendation icon
  const getRecommendationIcon = (rec: PlanRecommendation) => {
    switch (rec.recommendation_type) {
      case 'workout_intensity_scale':
        return <TrendingDown size={16} className="text-amber-400" />
      case 'phase_extension':
      case 'phase_insert':
        return <AlertTriangle size={16} className="text-orange-400" />
      case 'week_volume_adjust':
      case 'week_type_change':
        return <RefreshCw size={16} className="text-blue-400" />
      default:
        return <Lightbulb size={16} className="text-amber-400" />
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'bg-red-500/20 text-red-400'
    if (priority <= 3) return 'bg-orange-500/20 text-orange-400'
    if (priority <= 4) return 'bg-amber-500/20 text-amber-400'
    return 'bg-white/10 text-white/60'
  }

  // Get recommendation title
  const getRecommendationTitle = (rec: PlanRecommendation) => {
    switch (rec.recommendation_type) {
      case 'workout_intensity_scale':
        return 'Adjust Workout Intensity'
      case 'phase_extension':
        return 'Extend Current Phase'
      case 'phase_shorten':
        return 'Shorten Current Phase'
      case 'phase_insert':
        return 'Insert Recovery Phase'
      case 'week_volume_adjust':
        return 'Adjust Weekly Volume'
      case 'week_type_change':
        return 'Change Week Type'
      case 'workout_substitute':
        return 'Substitute Workout'
      default:
        return 'Plan Recommendation'
    }
  }

  // Format time remaining until expiration
  const formatTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const expires = new Date(expiresAt)
    const now = new Date()
    const diffHours = Math.round((expires.getTime() - now.getTime()) / (1000 * 60 * 60))

    if (diffHours < 0) return 'Expired'
    if (diffHours < 1) return 'Less than 1 hour'
    if (diffHours < 24) return `${diffHours} hours`
    const days = Math.round(diffHours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="animate-spin text-amber-400" />
          <span className="ml-2 text-sm text-white/60">Loading recommendations...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchRecommendations}
          className="mt-2 text-sm text-amber-400 hover:text-amber-300"
        >
          Try again
        </button>
      </div>
    )
  }

  // Empty state
  if (recommendations.length === 0) {
    return compact ? null : (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Check size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">All Caught Up</p>
            <p className="text-xs text-tertiary">No pending recommendations</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold">Recommendations</h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
          <button
            onClick={fetchRecommendations}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="divide-y divide-white/5">
        {recommendations.map(rec => (
          <div key={rec.id} className="p-4">
            {/* Header row */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                {getRecommendationIcon(rec)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{getRecommendationTitle(rec)}</p>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getPriorityColor(rec.priority)}`}>
                    P{rec.priority}
                  </span>
                  {rec.expires_at && (
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <Clock size={10} />
                      {formatTimeRemaining(rec.expires_at)}
                    </span>
                  )}
                </div>
                {rec.confidence_score && (
                  <p className="text-xs text-tertiary mt-0.5">
                    {Math.round(rec.confidence_score * 100)}% confidence
                  </p>
                )}
              </div>
              <button
                onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                className="p-1 hover:bg-white/10 rounded"
              >
                {expandedId === rec.id ? (
                  <ChevronUp size={16} className="text-white/60" />
                ) : (
                  <ChevronDown size={16} className="text-white/60" />
                )}
              </button>
            </div>

            {/* Expanded content */}
            {expandedId === rec.id && (
              <div className="mt-3 pt-3 border-t border-white/5">
                {/* Reasoning */}
                {rec.reasoning && (
                  <div className="mb-3">
                    <p className="text-xs text-tertiary mb-1">Why this recommendation?</p>
                    <p className="text-sm text-white/80">{rec.reasoning}</p>
                  </div>
                )}

                {/* Proposed changes preview */}
                {rec.proposed_changes && (
                  <div className="mb-3 p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-tertiary mb-1">Proposed Changes</p>
                    <ProposedChangesPreview
                      type={rec.recommendation_type}
                      changes={rec.proposed_changes}
                    />
                  </div>
                )}

                {/* Evidence summary */}
                {rec.evidence_summary && (
                  <div className="mb-3">
                    <p className="text-xs text-tertiary mb-1">Evidence</p>
                    <EvidenceSummary evidence={rec.evidence_summary as Record<string, unknown>} />
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setPreviewingRec(rec)}
                disabled={responding === rec.id}
                className="py-2 px-3 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Preview impact"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => handleRespond(rec.id, 'accept')}
                disabled={responding === rec.id}
                className="flex-1 py-2 px-3 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {responding === rec.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Accept
              </button>
              <button
                onClick={() => handleRespond(rec.id, 'dismiss')}
                disabled={responding === rec.id}
                className="py-2 px-3 text-sm bg-white/10 hover:bg-white/20 text-white/60 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <X size={14} />
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* What-If Preview Modal */}
      {previewingRec && (
        <WhatIfPreviewModal
          recommendationId={previewingRec.id}
          recommendationType={previewingRec.recommendation_type}
          onClose={() => setPreviewingRec(null)}
          onAccept={() => {
            handleRespond(previewingRec.id, 'accept')
            setPreviewingRec(null)
          }}
        />
      )}
    </div>
  )
}

// Proposed changes preview component
function ProposedChangesPreview({
  type,
  changes,
}: {
  type: string
  changes: Record<string, unknown>
}) {
  if (type === 'workout_intensity_scale') {
    const factor = (changes as { adjustment_factor?: number }).adjustment_factor || 1
    const reductionPercent = Math.round((1 - factor) * 100)
    const applyTo = (changes as { apply_to?: string }).apply_to || 'all'

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Intensity reduction</span>
          <span className="text-amber-400 font-medium">{reductionPercent}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Apply to</span>
          <span className="capitalize">{applyTo} workouts</span>
        </div>
        {(changes as { original_intensity?: string }).original_intensity && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Original</span>
            <span>{(changes as { original_intensity: string }).original_intensity}</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'week_volume_adjust') {
    const volumeChange = (changes as { volume_percentage_change?: number }).volume_percentage_change || 0
    const direction = volumeChange > 0 ? '+' : ''

    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">Volume change</span>
        <span className={volumeChange > 0 ? 'text-emerald-400' : 'text-amber-400'}>
          {direction}{volumeChange}%
        </span>
      </div>
    )
  }

  if (type === 'week_type_change') {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">Change to</span>
        <span className="text-blue-400 capitalize">
          {(changes as { new_type?: string }).new_type || 'recovery'} week
        </span>
      </div>
    )
  }

  // Fallback for other types
  return (
    <p className="text-xs text-white/60">
      {Object.keys(changes).length} change(s) proposed
    </p>
  )
}

// Evidence summary component
function EvidenceSummary({ evidence }: { evidence: Record<string, unknown> }) {
  const items: { label: string; value: string }[] = []

  // Parse readiness evidence
  if (evidence.readiness) {
    const readiness = evidence.readiness as { current?: number; trend?: string }
    if (readiness.current !== undefined) {
      items.push({ label: 'Readiness', value: `${readiness.current}/100` })
    }
    if (readiness.trend) {
      items.push({ label: 'Trend', value: readiness.trend })
    }
  }

  // Parse recovery quality
  if (evidence.recovery_quality) {
    const recovery = evidence.recovery_quality as { sleep_avg?: number }
    if (recovery.sleep_avg) {
      items.push({ label: 'Avg Sleep', value: `${recovery.sleep_avg.toFixed(1)}h` })
    }
  }

  // Parse training load
  if (evidence.training_load) {
    const load = evidence.training_load as { tsb?: number; ctl?: number }
    if (load.tsb !== undefined) {
      items.push({ label: 'TSB', value: load.tsb.toString() })
    }
    if (load.ctl !== undefined) {
      items.push({ label: 'Fitness', value: load.ctl.toString() })
    }
  }

  // Parse compliance
  if (evidence.compliance) {
    const compliance = evidence.compliance as { recent?: number }
    if (compliance.recent !== undefined) {
      items.push({ label: 'Compliance', value: `${Math.round(compliance.recent * 100)}%` })
    }
  }

  if (items.length === 0) {
    return <p className="text-xs text-white/60">No evidence summary available</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <div key={idx} className="px-2 py-1 bg-white/5 rounded text-xs">
          <span className="text-white/60">{item.label}:</span>{' '}
          <span className="text-white">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
