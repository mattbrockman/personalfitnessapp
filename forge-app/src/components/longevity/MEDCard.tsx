'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Target,
  Info,
  ChevronRight,
} from 'lucide-react'
import { MEDCompliance } from '@/types/longevity'

interface MEDCardProps {
  compliance: MEDCompliance
  onRefresh?: () => void
}

export function MEDCard({ compliance, onRefresh }: MEDCardProps) {
  const [showInfo, setShowInfo] = useState(false)

  const items = [
    {
      key: 'cardio',
      label: 'Cardio 150min',
      met: compliance.cardioMinutes >= 150,
      value: `${compliance.cardioMinutes}/150 min`,
      description: 'Zone 2 or equivalent',
    },
    {
      key: 'strength',
      label: 'Strength 2x',
      met: compliance.strengthSessions >= 2,
      value: `${compliance.strengthSessions}/2 sessions`,
      description: 'Full body resistance',
    },
    {
      key: 'sleep',
      label: 'Sleep 7hr avg',
      met: compliance.avgSleepHours >= 7,
      value: `${compliance.avgSleepHours.toFixed(1)}/7.0 hr`,
      description: 'Consistent sleep schedule',
    },
    {
      key: 'protein',
      label: 'Protein 5/7',
      met: compliance.proteinDays >= 5,
      value: `${compliance.proteinDays}/7 days`,
      description: '~1g/lb target weight',
    },
    {
      key: 'stability',
      label: 'Stability 1x',
      met: compliance.stabilitySessions >= 1,
      value: `${compliance.stabilitySessions}/1 session`,
      description: 'Balance/mobility work',
    },
  ]

  const metCount = items.filter(i => i.met).length
  const allMet = metCount === items.length

  return (
    <div className="glass rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${allMet ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
            <Target size={18} className={allMet ? 'text-green-400' : 'text-amber-400'} />
          </div>
          <div>
            <h3 className="font-medium">Minimum Effective Dose</h3>
            <p className="text-xs text-tertiary">This week's fundamentals</p>
          </div>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 hover:bg-white/10 rounded-lg"
        >
          <Info size={16} className="text-secondary" />
        </button>
      </div>

      {/* Info tooltip */}
      {showInfo && (
        <div className="mb-3 p-3 bg-white/5 rounded-lg text-xs text-white/60">
          The Minimum Effective Dose represents the essential weekly requirements
          for health and longevity. Hit these every week as your baseline.
        </div>
      )}

      {/* Progress summary */}
      <div className="mb-3 p-2 bg-white/5 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">{metCount} of {items.length} complete</span>
          <span className={`font-medium ${
            allMet ? 'text-green-400' :
            metCount >= 3 ? 'text-blue-400' : 'text-amber-400'
          }`}>
            {allMet ? 'All done!' : metCount >= 3 ? 'Good progress' : 'Keep going'}
          </span>
        </div>
        <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              allMet ? 'bg-green-500' : 'bg-amber-500'
            }`}
            style={{ width: `${(metCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.key}
            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
              item.met ? 'bg-green-500/10' : 'bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              {item.met ? (
                <CheckCircle2 size={18} className="text-green-400" />
              ) : (
                <Circle size={18} className="text-muted" />
              )}
              <div>
                <span className={`text-sm font-medium ${item.met ? 'text-green-400' : ''}`}>
                  {item.label}
                </span>
                <p className="text-xs text-secondary">{item.description}</p>
              </div>
            </div>
            <span className={`text-xs ${item.met ? 'text-green-400' : 'text-tertiary'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
