'use client'

import { useState } from 'react'
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { HealthMetric } from '@/types/longevity'
import { format, parseISO, subDays } from 'date-fns'

interface RHRCardProps {
  currentRHR: number | null
  recentReadings?: HealthMetric[]
  avgRHR7Day?: number
  avgRHR30Day?: number
  onRefresh?: () => void
}

export function RHRCard({
  currentRHR,
  recentReadings = [],
  avgRHR7Day,
  avgRHR30Day,
  onRefresh,
}: RHRCardProps) {
  const [showInfo, setShowInfo] = useState(false)

  // Calculate trend
  const trend = avgRHR7Day && avgRHR30Day
    ? avgRHR7Day - avgRHR30Day
    : null

  // Check for concerning trend (RHR increasing over time = possible overtraining/illness)
  const concerningTrend = trend !== null && trend > 5

  // RHR classification
  const getClassification = (rhr: number): { label: string; color: string } => {
    if (rhr < 50) return { label: 'Athlete', color: 'text-green-400' }
    if (rhr <= 60) return { label: 'Excellent', color: 'text-green-400' }
    if (rhr <= 70) return { label: 'Good', color: 'text-blue-400' }
    if (rhr <= 80) return { label: 'Average', color: 'text-white' }
    if (rhr <= 90) return { label: 'Below Average', color: 'text-amber-400' }
    return { label: 'Poor', color: 'text-red-400' }
  }

  const classification = currentRHR ? getClassification(currentRHR) : null

  // Mini sparkline data
  const last7DaysReadings = recentReadings
    .filter(r => parseISO(r.metric_date) >= subDays(new Date(), 7))
    .sort((a, b) => parseISO(a.metric_date).getTime() - parseISO(b.metric_date).getTime())

  return (
    <div className="glass rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-pink-500/20 rounded-lg">
            <Heart size={18} className="text-pink-400" />
          </div>
          <h3 className="font-medium">Resting Heart Rate</h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 hover:bg-white/10 rounded-lg"
        >
          <Info size={16} className="text-white/40" />
        </button>
      </div>

      {/* Info tooltip */}
      {showInfo && (
        <div className="mb-3 p-3 bg-white/5 rounded-lg text-xs text-white/60">
          Lower RHR generally indicates better cardiovascular fitness.
          Watch for sudden increases which may indicate overtraining, stress, or illness.
        </div>
      )}

      {/* Main value */}
      {currentRHR ? (
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{currentRHR}</span>
            <span className="text-white/50 text-sm">bpm</span>
            {classification && (
              <span className={`text-sm ${classification.color}`}>
                {classification.label}
              </span>
            )}
          </div>

          {/* Trend */}
          {trend !== null && (
            <div className="flex items-center gap-1 mt-1 text-sm">
              {trend > 2 ? (
                <>
                  <TrendingUp size={14} className={concerningTrend ? 'text-red-400' : 'text-amber-400'} />
                  <span className={concerningTrend ? 'text-red-400' : 'text-amber-400'}>
                    +{trend.toFixed(0)} vs 30d avg
                  </span>
                </>
              ) : trend < -2 ? (
                <>
                  <TrendingDown size={14} className="text-green-400" />
                  <span className="text-green-400">
                    {trend.toFixed(0)} vs 30d avg
                  </span>
                </>
              ) : (
                <>
                  <Minus size={14} className="text-white/40" />
                  <span className="text-white/40">Stable</span>
                </>
              )}
            </div>
          )}

          {/* Warning for concerning trend */}
          {concerningTrend && (
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
              <AlertTriangle size={12} />
              <span>RHR trending up - consider rest or check-in with health</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-2xl font-bold text-white/30">--</div>
          <p className="text-sm text-white/50 mt-1">No RHR data</p>
        </div>
      )}

      {/* Mini sparkline */}
      {last7DaysReadings.length > 2 && (
        <div className="mb-3">
          <div className="flex items-end gap-1 h-12">
            {last7DaysReadings.map((reading, i) => {
              const min = Math.min(...last7DaysReadings.map(r => Number(r.value)))
              const max = Math.max(...last7DaysReadings.map(r => Number(r.value)))
              const range = max - min || 1
              const height = ((Number(reading.value) - min) / range) * 80 + 20
              return (
                <div
                  key={reading.id || i}
                  className="flex-1 bg-pink-500/40 rounded-t"
                  style={{ height: `${height}%` }}
                  title={`${reading.value} bpm - ${format(parseISO(reading.metric_date), 'MMM d')}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>7 days ago</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* 7d vs 30d comparison */}
      {avgRHR7Day && avgRHR30Day && (
        <div className="grid grid-cols-2 gap-3 p-2 bg-white/5 rounded-lg text-sm">
          <div>
            <span className="text-white/40 text-xs">7-day avg</span>
            <p className="font-medium">{avgRHR7Day.toFixed(0)} bpm</p>
          </div>
          <div>
            <span className="text-white/40 text-xs">30-day avg</span>
            <p className="font-medium">{avgRHR30Day.toFixed(0)} bpm</p>
          </div>
        </div>
      )}
    </div>
  )
}
