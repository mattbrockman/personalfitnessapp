'use client'

import { useState } from 'react'
import {
  Grip,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { GripStrengthReading, GRIP_PERCENTILES } from '@/types/longevity'
import { format, parseISO, differenceInDays } from 'date-fns'
import { GripStrengthModal } from './GripStrengthModal'

interface GripStrengthCardProps {
  leftGrip: number | null
  rightGrip: number | null
  lastTestDate: string | null
  age: number
  sex: 'male' | 'female'
  recentReadings?: GripStrengthReading[]
  onRefresh?: () => void
}

export function GripStrengthCard({
  leftGrip,
  rightGrip,
  lastTestDate,
  age,
  sex,
  recentReadings = [],
  onRefresh,
}: GripStrengthCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Get percentile bracket
  const getAgeBracket = (age: number): string => {
    const brackets = Object.keys(GRIP_PERCENTILES[sex])
    for (const bracket of brackets) {
      const [start, end] = bracket.split('-').map(Number)
      if (age >= start && age <= end) return bracket
    }
    return brackets[brackets.length - 1]
  }

  const bracket = getAgeBracket(age)
  const percentiles = GRIP_PERCENTILES[sex][bracket]

  // Calculate percentile for a value
  const getPercentile = (value: number): number => {
    if (value >= percentiles[90]) return 90 + (value - percentiles[90]) / 10
    if (value >= percentiles[75]) return 75 + (value - percentiles[75]) / (percentiles[90] - percentiles[75]) * 15
    if (value >= percentiles[50]) return 50 + (value - percentiles[50]) / (percentiles[75] - percentiles[50]) * 25
    if (value >= percentiles[25]) return 25 + (value - percentiles[25]) / (percentiles[50] - percentiles[25]) * 25
    if (value >= percentiles[10]) return 10 + (value - percentiles[10]) / (percentiles[25] - percentiles[10]) * 15
    return Math.max(1, (value / percentiles[10]) * 10)
  }

  // Best grip (dominant hand usually stronger)
  const bestGrip = leftGrip && rightGrip
    ? Math.max(leftGrip, rightGrip)
    : leftGrip || rightGrip

  const percentile = bestGrip ? Math.round(getPercentile(bestGrip)) : null

  // Asymmetry check (>10% difference is concerning)
  const asymmetry = leftGrip && rightGrip
    ? Math.abs(leftGrip - rightGrip) / Math.max(leftGrip, rightGrip) * 100
    : null
  const hasAsymmetry = asymmetry !== null && asymmetry > 10

  // Check if test is due (recommend monthly)
  const daysSinceTest = lastTestDate
    ? differenceInDays(new Date(), parseISO(lastTestDate))
    : null
  const testOverdue = daysSinceTest !== null && daysSinceTest > 30

  // Get classification
  const getClassification = (p: number): string => {
    if (p >= 90) return 'Excellent'
    if (p >= 75) return 'Good'
    if (p >= 50) return 'Average'
    if (p >= 25) return 'Below Average'
    return 'Needs Improvement'
  }

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
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Grip size={18} className="text-purple-400" />
            </div>
            <h3 className="font-medium">Grip Strength</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowInfo(!showInfo)
            }}
            className="p-1 hover:bg-white/10 rounded-lg"
          >
            <Info size={16} className="text-white/40" />
          </button>
        </div>

        {/* Info tooltip */}
        {showInfo && (
          <div className="mb-3 p-3 bg-white/5 rounded-lg text-xs text-white/60">
            Grip strength strongly predicts mortality and overall health.
            It reflects total body strength and neuromuscular function.
          </div>
        )}

        {/* Main values */}
        {bestGrip ? (
          <div className="mb-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-white/50">L</span>
                <span className="text-2xl font-bold ml-1">{leftGrip || '--'}</span>
              </div>
              <div>
                <span className="text-xs text-white/50">R</span>
                <span className="text-2xl font-bold ml-1">{rightGrip || '--'}</span>
              </div>
              <span className="text-white/50 text-sm">lbs</span>
            </div>

            {percentile && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-medium ${getPercentileColor(percentile)}`}>
                  {percentile}th percentile
                </span>
                <span className="text-white/30">•</span>
                <span className="text-sm text-white/60">{getClassification(percentile)}</span>
              </div>
            )}

            {/* Asymmetry warning */}
            {hasAsymmetry && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                <AlertTriangle size={12} />
                <span>{asymmetry?.toFixed(0)}% asymmetry detected</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-2xl font-bold text-white/30">-- / --</div>
            <p className="text-sm text-white/50 mt-1">No grip strength recorded</p>
          </div>
        )}

        {/* Reference values */}
        {bestGrip && (
          <div className="mb-3 p-2 bg-white/5 rounded-lg text-xs">
            <div className="flex justify-between text-white/50">
              <span>Age {bracket} reference ({sex})</span>
              <span>50th: {percentiles[50]} lbs</span>
            </div>
          </div>
        )}

        {/* Last test date */}
        <div className="flex items-center justify-between text-xs">
          {lastTestDate ? (
            <span className={`${testOverdue ? 'text-amber-400' : 'text-white/40'}`}>
              Last tested: {format(parseISO(lastTestDate), 'MMM d, yyyy')}
            </span>
          ) : (
            <span className="text-amber-400">
              Test grip strength to track
            </span>
          )}
          <ChevronRight size={16} className="text-white/30" />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <GripStrengthModal
          leftGrip={leftGrip}
          rightGrip={rightGrip}
          age={age}
          sex={sex}
          recentReadings={recentReadings}
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
