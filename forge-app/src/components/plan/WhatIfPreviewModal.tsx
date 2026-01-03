'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  AlertTriangle,
  Check,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Zap,
  Activity,
  Shield,
  Target,
} from 'lucide-react'

interface PreviewResult {
  recommendation_id: string
  recommendation_type: string
  current_state: Record<string, unknown>
  projected_state: Record<string, unknown>
  affected_items: {
    phases: string[]
    weeks: string[]
    workouts: string[]
  }
  timeline_impact: {
    original_end_date: string | null
    projected_end_date: string | null
    days_difference: number
  }
  training_load_projection: {
    current_tsb: number
    projected_tsb_7_days: number
    projected_tsb_14_days: number
  }
  risks: string[]
  benefits: string[]
}

interface WhatIfPreviewModalProps {
  recommendationId: string
  recommendationType: string
  onClose: () => void
  onAccept: () => void
}

export function WhatIfPreviewModal({
  recommendationId,
  recommendationType,
  onClose,
  onAccept,
}: WhatIfPreviewModalProps) {
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPreview()
  }, [recommendationId])

  const fetchPreview = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/recommendations/${recommendationId}/preview`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to generate preview')
      }

      const data = await res.json()
      setPreview(data)
    } catch (err) {
      console.error('Error fetching preview:', err)
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getRecommendationTitle = (type: string) => {
    switch (type) {
      case 'workout_intensity_scale':
        return 'Workout Intensity Adjustment'
      case 'week_type_change':
        return 'Week Type Change'
      case 'week_volume_adjust':
        return 'Volume Adjustment'
      case 'phase_extension':
        return 'Phase Extension'
      case 'phase_shorten':
        return 'Phase Shortening'
      case 'phase_insert':
        return 'Recovery Phase Insertion'
      default:
        return 'Recommendation Preview'
    }
  }

  const getTsbColor = (tsb: number) => {
    if (tsb > 10) return 'text-emerald-400'
    if (tsb >= -10) return 'text-blue-400'
    if (tsb >= -20) return 'text-amber-400'
    return 'text-red-400'
  }

  const getTsbLabel = (tsb: number) => {
    if (tsb > 10) return 'Fresh'
    if (tsb >= -10) return 'Balanced'
    if (tsb >= -20) return 'Fatigued'
    return 'Very Fatigued'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity size={20} className="text-blue-400" />
            {getRecommendationTitle(recommendationType)}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <span className="ml-2 text-white/60">Generating preview...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" />
              <p className="text-white/60">{error}</p>
              <button
                onClick={fetchPreview}
                className="mt-4 text-sm text-blue-400 hover:text-blue-300"
              >
                Try again
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              {/* TSB Projection */}
              <div>
                <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Zap size={14} />
                  Training Load Projection
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-xs text-tertiary mb-1">Current</p>
                    <p className={`text-xl font-bold ${getTsbColor(preview.training_load_projection.current_tsb)}`}>
                      {Math.round(preview.training_load_projection.current_tsb)}
                    </p>
                    <p className="text-xs text-tertiary">{getTsbLabel(preview.training_load_projection.current_tsb)}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-xs text-tertiary mb-1">7 Days</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className={`text-xl font-bold ${getTsbColor(preview.training_load_projection.projected_tsb_7_days)}`}>
                        {Math.round(preview.training_load_projection.projected_tsb_7_days)}
                      </p>
                      {preview.training_load_projection.projected_tsb_7_days > preview.training_load_projection.current_tsb ? (
                        <TrendingUp size={16} className="text-emerald-400" />
                      ) : preview.training_load_projection.projected_tsb_7_days < preview.training_load_projection.current_tsb ? (
                        <TrendingDown size={16} className="text-red-400" />
                      ) : null}
                    </div>
                    <p className="text-xs text-tertiary">{getTsbLabel(preview.training_load_projection.projected_tsb_7_days)}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-xs text-tertiary mb-1">14 Days</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className={`text-xl font-bold ${getTsbColor(preview.training_load_projection.projected_tsb_14_days)}`}>
                        {Math.round(preview.training_load_projection.projected_tsb_14_days)}
                      </p>
                      {preview.training_load_projection.projected_tsb_14_days > preview.training_load_projection.current_tsb ? (
                        <TrendingUp size={16} className="text-emerald-400" />
                      ) : preview.training_load_projection.projected_tsb_14_days < preview.training_load_projection.current_tsb ? (
                        <TrendingDown size={16} className="text-red-400" />
                      ) : null}
                    </div>
                    <p className="text-xs text-tertiary">{getTsbLabel(preview.training_load_projection.projected_tsb_14_days)}</p>
                  </div>
                </div>
              </div>

              {/* Timeline Impact */}
              {preview.timeline_impact.days_difference !== 0 && (
                <div>
                  <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar size={14} />
                    Timeline Impact
                  </h4>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-tertiary">Original End</p>
                        <p className="text-sm font-medium">
                          {preview.timeline_impact.original_end_date
                            ? formatDate(preview.timeline_impact.original_end_date)
                            : 'No end date'}
                        </p>
                      </div>
                      <div className="px-3">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          preview.timeline_impact.days_difference > 0
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          <Clock size={12} />
                          <span className="text-xs">
                            {preview.timeline_impact.days_difference > 0 ? '+' : ''}
                            {preview.timeline_impact.days_difference} days
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-tertiary">Projected End</p>
                        <p className="text-sm font-medium">
                          {preview.timeline_impact.projected_end_date
                            ? formatDate(preview.timeline_impact.projected_end_date)
                            : 'No end date'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Affected Items */}
              {(preview.affected_items.phases.length > 0 ||
                preview.affected_items.weeks.length > 0 ||
                preview.affected_items.workouts.length > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Target size={14} />
                    Affected Items
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.affected_items.phases.length > 0 && (
                      <span className="px-2.5 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                        {preview.affected_items.phases.length} phase{preview.affected_items.phases.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {preview.affected_items.weeks.length > 0 && (
                      <span className="px-2.5 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                        {preview.affected_items.weeks.length} week{preview.affected_items.weeks.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {preview.affected_items.workouts.length > 0 && (
                      <span className="px-2.5 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                        {preview.affected_items.workouts.length} workout{preview.affected_items.workouts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Benefits */}
              {preview.benefits.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    Benefits
                  </h4>
                  <ul className="space-y-2">
                    {preview.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {preview.risks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Shield size={14} className="text-amber-400" />
                    Considerations
                  </h4>
                  <ul className="space-y-2">
                    {preview.risks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="text-white/80">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* State comparison */}
              {(Object.keys(preview.current_state).length > 0 || Object.keys(preview.projected_state).length > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-tertiary uppercase tracking-wide mb-3">
                    State Comparison
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-tertiary mb-2">Current</p>
                      <pre className="text-xs text-white/80 overflow-auto max-h-32">
                        {JSON.stringify(preview.current_state, null, 2)}
                      </pre>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-xs text-emerald-400 mb-2">After Accepting</p>
                      <pre className="text-xs text-white/80 overflow-auto max-h-32">
                        {JSON.stringify(preview.projected_state, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={loading || !!error}
            className="flex-1 py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Check size={16} />
            Accept Recommendation
          </button>
        </div>
      </div>
    </div>
  )
}
