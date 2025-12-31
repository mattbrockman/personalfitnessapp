'use client'

import { useState, useEffect } from 'react'
import { MuscleVolumeAnalysis, WeeklyVolumeAnalysis, VolumeAlert } from '@/types/strength'
import { VolumeLandmarksCard } from './VolumeLandmarksCard'
import { RefreshCw, AlertTriangle, CheckCircle, Dumbbell, Activity } from 'lucide-react'

interface WeeklyVolumeOverviewProps {
  onRefresh?: () => void
}

export function WeeklyVolumeOverview({ onRefresh }: WeeklyVolumeOverviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [analysis, setAnalysis] = useState<WeeklyVolumeAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/strength/volume-analysis?weeks=1')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAnalysis(data.analysis)
      setError(null)
    } catch (err) {
      console.error('Error fetching volume analysis:', err)
      setError('Failed to load volume data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const handleRefresh = async () => {
    await fetchAnalysis()
    onRefresh?.()
  }

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="animate-spin text-white/30" size={24} />
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="bg-dark-800 rounded-xl p-6">
        <div className="text-center text-white/50">
          <p>{error || 'No data available'}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { muscles, alerts, summary, week_start_date } = analysis

  // Categorize muscles by status
  const overMRV = muscles.filter(m => m.volume_status.status === 'over_mrv')
  const belowMEV = muscles.filter(m => m.volume_status.status === 'below_mev')
  const optimal = muscles.filter(m => m.volume_status.status === 'in_mav')
  const other = muscles.filter(m =>
    !['over_mrv', 'below_mev', 'in_mav'].includes(m.volume_status.status)
  )

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold">Weekly Volume</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 hover:bg-white/10 rounded-lg"
        >
          <RefreshCw size={16} className="text-white/50" />
        </button>
      </div>

      {/* Week info */}
      <div className="text-xs text-white/40 mb-4">
        Week of {new Date(week_start_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-dark-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-white/40 mb-1">Hard Sets</div>
          <div className="text-xl font-semibold">{summary.total_hard_sets}</div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-white/40 mb-1">Effective Reps</div>
          <div className="text-xl font-semibold">{summary.total_effective_reps}</div>
        </div>
        <div className="bg-dark-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-white/40 mb-1">Volume</div>
          <div className="text-xl font-semibold">{(summary.total_volume_lbs / 1000).toFixed(1)}k</div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 p-2 rounded-lg ${
                alert.severity === 'critical' ? 'bg-red-500/10' :
                alert.severity === 'warning' ? 'bg-amber-500/10' :
                'bg-blue-500/10'
              }`}
            >
              <AlertTriangle
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  alert.severity === 'critical' ? 'text-red-400' :
                  alert.severity === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`}
              />
              <div className="text-xs">
                <span className="text-white/80">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Muscle groups by status */}
      {muscles.length === 0 ? (
        <div className="text-center py-8 text-white/40">
          <Activity size={32} className="mx-auto mb-2 opacity-50" />
          <p>No workout data this week</p>
          <p className="text-xs mt-1">Complete a workout to see volume analysis</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Over MRV (priority) */}
          {overMRV.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-400">Over MRV</span>
              </div>
              <div className="space-y-2">
                {overMRV.map((m) => (
                  <VolumeLandmarksCard key={m.muscle_group} status={m.volume_status} />
                ))}
              </div>
            </div>
          )}

          {/* Below MEV */}
          {belowMEV.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs font-medium text-yellow-400">Below MEV</span>
              </div>
              <div className="space-y-2">
                {belowMEV.map((m) => (
                  <VolumeLandmarksCard key={m.muscle_group} status={m.volume_status} />
                ))}
              </div>
            </div>
          )}

          {/* Optimal (in MAV) */}
          {optimal.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-400">Optimal Volume</span>
              </div>
              <div className="space-y-2">
                {optimal.map((m) => (
                  <VolumeLandmarksCard key={m.muscle_group} status={m.volume_status} showDetails={false} />
                ))}
              </div>
            </div>
          )}

          {/* Others */}
          {other.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-white/30" />
                <span className="text-xs font-medium text-white/50">Other</span>
              </div>
              <div className="space-y-2">
                {other.map((m) => (
                  <VolumeLandmarksCard key={m.muscle_group} status={m.volume_status} showDetails={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="text-xs text-white/30 mb-2">Volume Landmarks</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-yellow-500/30 rounded" />
            <span className="text-white/40">MEV (Minimum)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-green-500/30 rounded" />
            <span className="text-white/40">MAV (Optimal)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-red-500/30 rounded" />
            <span className="text-white/40">MRV (Maximum)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
