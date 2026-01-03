'use client'

import { useState } from 'react'
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Info,
  AlertCircle,
} from 'lucide-react'
import { VO2maxTest, HealthMetric } from '@/types/longevity'
import { getVO2maxPercentile, getMortalityRiskInfo } from '@/lib/vo2max'
import { format, parseISO, differenceInDays } from 'date-fns'
import { VO2maxModal } from './VO2maxModal'

interface VO2maxCardProps {
  currentVO2max: number | null
  lastTestDate: string | null
  age: number
  sex: 'male' | 'female'
  recentTests?: VO2maxTest[]
  onRefresh?: () => void
}

export function VO2maxCard({
  currentVO2max,
  lastTestDate,
  age,
  sex,
  recentTests = [],
  onRefresh,
}: VO2maxCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Calculate percentile and classification
  const percentileInfo = currentVO2max
    ? getVO2maxPercentile(currentVO2max, age, sex)
    : null

  const riskInfo = percentileInfo
    ? getMortalityRiskInfo(percentileInfo.percentile)
    : null

  // Calculate trend from recent tests
  const trend = recentTests.length >= 2
    ? recentTests[0].estimated_vo2max - recentTests[1].estimated_vo2max
    : null

  // Check if test is due (recommend every 3-6 months)
  const daysSinceTest = lastTestDate
    ? differenceInDays(new Date(), parseISO(lastTestDate))
    : null
  const testOverdue = daysSinceTest !== null && daysSinceTest > 180

  // Color based on percentile
  const getPercentileColor = (p: number) => {
    if (p >= 75) return 'text-green-400'
    if (p >= 50) return 'text-blue-400'
    if (p >= 25) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <>
      <div
        className="glass rounded-xl p-5 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => setShowModal(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Heart size={18} className="text-red-400" />
            </div>
            <h3 className="font-medium">VO2max</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowInfo(!showInfo)
            }}
            className="p-1 hover:bg-white/10 rounded-lg"
          >
            <Info size={16} className="text-secondary" />
          </button>
        </div>

        {/* Info tooltip */}
        {showInfo && (
          <div className="mb-3 p-3 bg-white/5 rounded-lg text-xs text-white/60">
            VO2max is the #1 predictor of all-cause mortality. Higher is better.
            Elite athletes: 60-85+ ml/kg/min. Average adult: 30-40 ml/kg/min.
          </div>
        )}

        {/* Main value */}
        {currentVO2max ? (
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{currentVO2max}</span>
              <span className="text-tertiary text-sm">ml/kg/min</span>
            </div>

            {percentileInfo && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-medium ${getPercentileColor(percentileInfo.percentile)}`}>
                  {percentileInfo.percentile}th percentile
                </span>
                <span className="text-muted">•</span>
                <span className="text-sm text-white/60">{percentileInfo.classification}</span>
              </div>
            )}

            {/* Trend indicator */}
            {trend !== null && (
              <div className="flex items-center gap-1 mt-1 text-sm">
                {trend > 0.5 ? (
                  <>
                    <TrendingUp size={14} className="text-green-400" />
                    <span className="text-green-400">+{trend.toFixed(1)}</span>
                  </>
                ) : trend < -0.5 ? (
                  <>
                    <TrendingDown size={14} className="text-red-400" />
                    <span className="text-red-400">{trend.toFixed(1)}</span>
                  </>
                ) : (
                  <>
                    <Minus size={14} className="text-secondary" />
                    <span className="text-secondary">Stable</span>
                  </>
                )}
                <span className="text-muted ml-1">vs last test</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-2xl font-bold text-muted">--</div>
            <p className="text-sm text-tertiary mt-1">No VO2max recorded</p>
          </div>
        )}

        {/* Fitness age */}
        {percentileInfo && (
          <div className="mb-3 p-2 bg-white/5 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">Fitness Age</span>
              <span className={`font-medium ${
                percentileInfo.fitnessAge < age ? 'text-green-400' :
                percentileInfo.fitnessAge > age ? 'text-amber-400' : 'text-white'
              }`}>
                {percentileInfo.fitnessAge} years
              </span>
            </div>
            <div className="text-xs text-secondary mt-0.5">
              {percentileInfo.fitnessAge < age
                ? `${age - percentileInfo.fitnessAge} years younger than chronological age`
                : percentileInfo.fitnessAge > age
                ? `${percentileInfo.fitnessAge - age} years older than chronological age`
                : 'Matches chronological age'}
            </div>
          </div>
        )}

        {/* Last test date / warning */}
        <div className="flex items-center justify-between text-xs">
          {lastTestDate ? (
            <span className={`${testOverdue ? 'text-amber-400' : 'text-secondary'}`}>
              {testOverdue && <AlertCircle size={12} className="inline mr-1" />}
              Last tested: {format(parseISO(lastTestDate), 'MMM d, yyyy')}
            </span>
          ) : (
            <span className="text-amber-400">
              <AlertCircle size={12} className="inline mr-1" />
              Take a field test to get started
            </span>
          )}
          <ChevronRight size={16} className="text-muted" />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <VO2maxModal
          currentVO2max={currentVO2max}
          age={age}
          sex={sex}
          recentTests={recentTests}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false)
            onRefresh?.()
          }}
        />
      )}
    </>
  )
}
