'use client'

import { useState } from 'react'
import { Zap, TrendingUp, TrendingDown, Minus, Plus, Calendar, AlertCircle } from 'lucide-react'
import { CurrentThresholds, ThresholdTest } from '@/types/endurance'

interface ThresholdCardProps {
  thresholds: CurrentThresholds
  recentTests?: ThresholdTest[]
  onAddTest?: () => void
  onRefresh?: () => void
}

export function ThresholdCard({
  thresholds,
  recentTests = [],
  onAddTest,
  onRefresh,
}: ThresholdCardProps) {
  const [showHistory, setShowHistory] = useState(false)

  const FtpTrendIcon = thresholds.ftp_trend === 'improving' ? TrendingUp :
    thresholds.ftp_trend === 'declining' ? TrendingDown : Minus
  const ftpTrendColor = thresholds.ftp_trend === 'improving' ? 'text-green-400' :
    thresholds.ftp_trend === 'declining' ? 'text-red-400' : 'text-white/30'

  // Check if thresholds are stale (>8 weeks old)
  const isStale = (date: string | null) => {
    if (!date) return true
    const testDate = new Date(date)
    const weeksAgo = (Date.now() - testDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    return weeksAgo > 8
  }

  const ftpStale = isStale(thresholds.last_ftp_test)
  const lthrStale = isStale(thresholds.last_lthr_test)

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="text-amber-400" size={24} />
          <h3 className="text-lg font-semibold">Thresholds</h3>
        </div>
        <button
          onClick={onAddTest}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
        >
          <Plus size={14} />
          Log Test
        </button>
      </div>

      {/* FTP */}
      <div className="bg-dark-700/50 rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50">FTP (Cycling Power)</span>
            {ftpStale && thresholds.ftp_watts && (
              <AlertCircle size={14} className="text-amber-400" />
            )}
          </div>
          {thresholds.ftp_trend && (
            <div className={`flex items-center gap-1 ${ftpTrendColor}`}>
              <FtpTrendIcon size={14} />
              <span className="text-xs capitalize">{thresholds.ftp_trend}</span>
            </div>
          )}
        </div>

        {thresholds.ftp_watts ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{thresholds.ftp_watts}</span>
              <span className="text-white/50">watts</span>
            </div>
            {thresholds.last_ftp_test && (
              <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                <Calendar size={12} />
                <span>
                  Last tested: {new Date(thresholds.last_ftp_test).toLocaleDateString()}
                  {ftpStale && <span className="text-amber-400 ml-1">(Retest recommended)</span>}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-white/30 text-sm">Not set</div>
        )}
      </div>

      {/* LTHR */}
      <div className="bg-dark-700/50 rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-white/50">LTHR (Heart Rate)</span>
          {lthrStale && thresholds.lthr_bpm && (
            <AlertCircle size={14} className="text-amber-400" />
          )}
        </div>

        {thresholds.lthr_bpm ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{thresholds.lthr_bpm}</span>
              <span className="text-white/50">bpm</span>
            </div>
            {thresholds.last_lthr_test && (
              <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                <Calendar size={12} />
                <span>
                  Last tested: {new Date(thresholds.last_lthr_test).toLocaleDateString()}
                  {lthrStale && <span className="text-amber-400 ml-1">(Retest recommended)</span>}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-white/30 text-sm">Not set</div>
        )}
      </div>

      {/* HR Zones reference */}
      {thresholds.lthr_bpm && (
        <div className="bg-dark-700/30 rounded-lg p-3 mb-3">
          <div className="text-xs text-white/50 mb-2">HR Zones (based on LTHR)</div>
          <div className="grid grid-cols-5 gap-1 text-center text-xs">
            {[
              { zone: 'Z1', pct: '50-60%', hr: Math.round(thresholds.lthr_bpm * 0.55) },
              { zone: 'Z2', pct: '60-70%', hr: Math.round(thresholds.lthr_bpm * 0.65) },
              { zone: 'Z3', pct: '70-80%', hr: Math.round(thresholds.lthr_bpm * 0.75) },
              { zone: 'Z4', pct: '80-90%', hr: Math.round(thresholds.lthr_bpm * 0.85) },
              { zone: 'Z5', pct: '90-100%', hr: Math.round(thresholds.lthr_bpm * 0.95) },
            ].map(({ zone, pct, hr }) => (
              <div key={zone} className="bg-dark-700/50 rounded p-1">
                <div className="font-medium text-white/70">{zone}</div>
                <div className="text-white/40">{hr}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other thresholds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-700/30 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Resting HR</div>
          <div className="font-medium">
            {thresholds.resting_hr ? `${thresholds.resting_hr} bpm` : '-'}
          </div>
        </div>
        <div className="bg-dark-700/30 rounded-lg p-3">
          <div className="text-xs text-white/50 mb-1">Max HR</div>
          <div className="font-medium">
            {thresholds.max_hr ? `${thresholds.max_hr} bpm` : '-'}
          </div>
        </div>
      </div>

      {/* Recent tests toggle */}
      {recentTests.length > 0 && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full mt-4 py-2 text-xs text-white/50 hover:text-white/70 text-center"
        >
          {showHistory ? 'Hide history' : `View ${recentTests.length} recent tests`}
        </button>
      )}

      {/* Test history */}
      {showHistory && recentTests.length > 0 && (
        <div className="mt-2 space-y-2">
          {recentTests.slice(0, 5).map((test) => (
            <div
              key={test.id}
              className="flex items-center justify-between p-2 bg-dark-700/30 rounded-lg text-sm"
            >
              <div>
                <div className="text-xs text-white/40">
                  {new Date(test.test_date).toLocaleDateString()}
                </div>
                <div className="text-xs text-white/30">{test.test_type}</div>
              </div>
              <div className="text-right">
                {test.ftp_watts && <div>{test.ftp_watts}W</div>}
                {test.lthr_bpm && <div>{test.lthr_bpm} bpm</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
