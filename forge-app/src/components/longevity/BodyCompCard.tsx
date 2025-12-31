'use client'

import { useState } from 'react'
import {
  Scale,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Info,
} from 'lucide-react'
import { BodyCompositionLog } from '@/types/longevity'
import { format, parseISO } from 'date-fns'
import { BodyCompModal } from './BodyCompModal'

interface BodyCompCardProps {
  latestLog: BodyCompositionLog | null
  recentLogs?: BodyCompositionLog[]
  onRefresh?: () => void
}

export function BodyCompCard({
  latestLog,
  recentLogs = [],
  onRefresh,
}: BodyCompCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Calculate trends
  const previousLog = recentLogs.length > 1 ? recentLogs[1] : null
  const leanMassTrend = latestLog?.lean_mass_lbs && previousLog?.lean_mass_lbs
    ? latestLog.lean_mass_lbs - previousLog.lean_mass_lbs
    : null
  const bodyFatTrend = latestLog?.body_fat_pct && previousLog?.body_fat_pct
    ? latestLog.body_fat_pct - previousLog.body_fat_pct
    : null

  return (
    <>
      <div
        className="glass rounded-xl p-5 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => setShowModal(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Scale size={18} className="text-blue-400" />
            </div>
            <h3 className="font-medium">Body Composition</h3>
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
            Focus on lean mass, not just weight. Maintaining muscle mass
            is critical for longevity and metabolic health.
          </div>
        )}

        {/* Main values */}
        {latestLog ? (
          <div className="mb-3">
            {/* Primary: Lean Mass */}
            <div className="mb-2">
              <span className="text-xs text-white/50">Lean Mass</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {latestLog.lean_mass_lbs?.toFixed(1) || '--'}
                </span>
                <span className="text-white/50 text-sm">lbs</span>
                {leanMassTrend !== null && (
                  <span className={`text-sm flex items-center gap-0.5 ${
                    leanMassTrend > 0 ? 'text-green-400' :
                    leanMassTrend < 0 ? 'text-red-400' : 'text-white/40'
                  }`}>
                    {leanMassTrend > 0 ? <TrendingUp size={14} /> : leanMassTrend < 0 ? <TrendingDown size={14} /> : null}
                    {leanMassTrend > 0 ? '+' : ''}{leanMassTrend.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Secondary metrics grid */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-white/40 text-xs">Weight</span>
                <p className="font-medium">{latestLog.weight_lbs?.toFixed(1) || '--'}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Body Fat</span>
                <p className="font-medium flex items-center gap-1">
                  {latestLog.body_fat_pct?.toFixed(1) || '--'}%
                  {bodyFatTrend !== null && (
                    <span className={`text-xs ${
                      bodyFatTrend < 0 ? 'text-green-400' :
                      bodyFatTrend > 0 ? 'text-amber-400' : ''
                    }`}>
                      {bodyFatTrend > 0 ? '+' : ''}{bodyFatTrend.toFixed(1)}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-white/40 text-xs">Muscle</span>
                <p className="font-medium">{latestLog.muscle_mass_lbs?.toFixed(1) || '--'}</p>
              </div>
            </div>

            {/* FFMI if available */}
            {latestLog.ffmi && (
              <div className="mt-2 p-2 bg-white/5 rounded-lg text-xs">
                <span className="text-white/50">FFMI: </span>
                <span className="font-medium">{latestLog.ffmi.toFixed(1)}</span>
                <span className="text-white/40 ml-2">
                  {latestLog.ffmi >= 25 ? 'Elite' :
                   latestLog.ffmi >= 22 ? 'Excellent' :
                   latestLog.ffmi >= 20 ? 'Good' :
                   latestLog.ffmi >= 18 ? 'Average' : 'Below Average'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-2xl font-bold text-white/30">--</div>
            <p className="text-sm text-white/50 mt-1">No body composition recorded</p>
          </div>
        )}

        {/* Last log date */}
        <div className="flex items-center justify-between text-xs">
          {latestLog ? (
            <span className="text-white/40">
              Last updated: {format(parseISO(latestLog.log_date), 'MMM d, yyyy')}
              {latestLog.source && ` (${latestLog.source})`}
            </span>
          ) : (
            <span className="text-amber-400">Log body composition</span>
          )}
          <ChevronRight size={16} className="text-white/30" />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <BodyCompModal
          latestLog={latestLog}
          recentLogs={recentLogs}
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
