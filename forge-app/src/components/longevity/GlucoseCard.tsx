'use client'

import { useState } from 'react'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Info,
  AlertCircle,
} from 'lucide-react'
import { CGMReading } from '@/types/longevity'
import { format, parseISO, subDays } from 'date-fns'
import { GlucoseModal } from './GlucoseModal'

interface GlucoseCardProps {
  recentReadings?: CGMReading[]
  averageFasting?: number
  timeInRange?: number // percentage of readings 70-140 mg/dL
  onRefresh?: () => void
}

export function GlucoseCard({
  recentReadings = [],
  averageFasting,
  timeInRange,
  onRefresh,
}: GlucoseCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Calculate stats from readings if not provided
  const last7Days = recentReadings.filter(
    r => parseISO(r.reading_time) >= subDays(new Date(), 7)
  )

  const avgGlucose = last7Days.length > 0
    ? Math.round(last7Days.reduce((sum, r) => sum + r.glucose_mg_dl, 0) / last7Days.length)
    : null

  const fastingReadings = last7Days.filter(r => r.meal_context === 'fasting')
  const avgFasting = averageFasting || (fastingReadings.length > 0
    ? Math.round(fastingReadings.reduce((sum, r) => sum + r.glucose_mg_dl, 0) / fastingReadings.length)
    : null)

  const inRangeCount = last7Days.filter(r => r.glucose_mg_dl >= 70 && r.glucose_mg_dl <= 140).length
  const calculatedTIR = timeInRange || (last7Days.length > 0
    ? Math.round((inRangeCount / last7Days.length) * 100)
    : null)

  // Glucose variability (standard deviation)
  const variability = last7Days.length > 2
    ? Math.round(Math.sqrt(
        last7Days.reduce((sum, r) => sum + Math.pow(r.glucose_mg_dl - (avgGlucose || 0), 2), 0) / last7Days.length
      ))
    : null

  // Color coding for fasting glucose
  const getFastingColor = (value: number) => {
    if (value < 70) return 'text-amber-400' // hypoglycemia
    if (value <= 85) return 'text-green-400' // optimal
    if (value <= 99) return 'text-blue-400' // normal
    if (value <= 125) return 'text-amber-400' // pre-diabetic
    return 'text-red-400' // diabetic range
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
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Activity size={18} className="text-orange-400" />
            </div>
            <h3 className="font-medium">Glucose</h3>
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
            Blood glucose control is key for metabolic health. Target: fasting &lt;100 mg/dL,
            post-meal spikes &lt;140 mg/dL. CGM provides detailed insights.
          </div>
        )}

        {/* Main values */}
        {avgFasting || avgGlucose ? (
          <div className="mb-3">
            {/* Primary: Fasting glucose */}
            {avgFasting && (
              <div className="mb-2">
                <span className="text-xs text-white/50">Avg Fasting</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${getFastingColor(avgFasting)}`}>
                    {avgFasting}
                  </span>
                  <span className="text-white/50 text-sm">mg/dL</span>
                </div>
              </div>
            )}

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-white/40 text-xs">7d Avg</span>
                <p className="font-medium">{avgGlucose || '--'}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs">TIR</span>
                <p className={`font-medium ${
                  calculatedTIR && calculatedTIR >= 90 ? 'text-green-400' :
                  calculatedTIR && calculatedTIR >= 70 ? 'text-blue-400' : ''
                }`}>
                  {calculatedTIR ? `${calculatedTIR}%` : '--'}
                </p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Variability</span>
                <p className={`font-medium ${
                  variability && variability <= 20 ? 'text-green-400' :
                  variability && variability <= 30 ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  {variability ? `±${variability}` : '--'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-2xl font-bold text-white/30">--</div>
            <p className="text-sm text-white/50 mt-1">No glucose data</p>
          </div>
        )}

        {/* Mini sparkline */}
        {last7Days.length > 5 && (
          <div className="mb-3 flex items-end gap-0.5 h-8">
            {last7Days.slice(0, 24).reverse().map((reading, i) => {
              const height = Math.max(10, Math.min(100, (reading.glucose_mg_dl - 60) / 1.2))
              const isInRange = reading.glucose_mg_dl >= 70 && reading.glucose_mg_dl <= 140
              return (
                <div
                  key={reading.id || i}
                  className={`flex-1 rounded-t ${isInRange ? 'bg-green-500/40' : 'bg-amber-500/40'}`}
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          {last7Days.length > 0 ? (
            <span className="text-white/40">
              {last7Days.length} readings this week
            </span>
          ) : (
            <span className="text-amber-400">
              <AlertCircle size={12} className="inline mr-1" />
              Import CGM data or log manually
            </span>
          )}
          <ChevronRight size={16} className="text-white/30" />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <GlucoseModal
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
