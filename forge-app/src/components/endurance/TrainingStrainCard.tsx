'use client'

import { AlertTriangle, CheckCircle, Activity, TrendingUp } from 'lucide-react'
import { TrainingStrain, STRAIN_THRESHOLDS } from '@/types/endurance'

interface TrainingStrainCardProps {
  strain: TrainingStrain
}

export function TrainingStrainCard({ strain }: TrainingStrainCardProps) {
  const getRiskColor = (level: TrainingStrain['riskLevel']) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-500/10'
      case 'moderate': return 'text-amber-400 bg-amber-500/10'
      case 'high': return 'text-orange-400 bg-orange-500/10'
      case 'very_high': return 'text-red-400 bg-red-500/10'
    }
  }

  const getACWRColor = (acwr: number) => {
    if (acwr >= 0.8 && acwr <= 1.3) return 'text-green-400'
    if (acwr >= 0.5 && acwr <= 1.5) return 'text-amber-400'
    return 'text-red-400'
  }

  const getMonotonyColor = (monotony: number) => {
    if (monotony <= STRAIN_THRESHOLDS.monotony.low) return 'text-green-400'
    if (monotony <= STRAIN_THRESHOLDS.monotony.moderate) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="text-purple-400" size={24} />
          <h3 className="text-lg font-semibold">Training Strain</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${getRiskColor(strain.riskLevel)}`}>
          {strain.riskLevel === 'low' ? (
            <CheckCircle size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          <span className="text-xs capitalize">{strain.riskLevel.replace('_', ' ')} Risk</span>
        </div>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Weekly Load */}
        <div className="bg-dark-700/50 rounded-lg p-4">
          <div className="text-xs text-tertiary mb-1">Weekly Load</div>
          <div className="text-2xl font-semibold">{strain.weeklyLoad.toLocaleString()}</div>
          <div className="text-xs text-secondary mt-1">RPE × Duration</div>
        </div>

        {/* ACWR */}
        <div className="bg-dark-700/50 rounded-lg p-4">
          <div className="text-xs text-tertiary mb-1">ACWR</div>
          <div className={`text-2xl font-semibold ${getACWRColor(strain.acwr)}`}>
            {strain.acwr.toFixed(2)}
          </div>
          <div className="text-xs text-secondary mt-1">
            {strain.acwr >= 0.8 && strain.acwr <= 1.3 ? 'Sweet spot' :
             strain.acwr < 0.8 ? 'Below optimal' : 'Above optimal'}
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Monotony */}
        <div className="bg-dark-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-tertiary">Monotony</span>
            <span className={`text-sm font-medium ${getMonotonyColor(strain.monotony)}`}>
              {strain.monotony.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                strain.monotony <= STRAIN_THRESHOLDS.monotony.low ? 'bg-green-500' :
                strain.monotony <= STRAIN_THRESHOLDS.monotony.moderate ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (strain.monotony / 3) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1">
            {strain.monotony <= 1.5 ? 'Good variety' :
             strain.monotony <= 2.0 ? 'Moderate variety' : 'Too monotonous'}
          </div>
        </div>

        {/* Strain */}
        <div className="bg-dark-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-tertiary">Strain</span>
            <span className="text-sm font-medium">{strain.strain.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                strain.strain <= STRAIN_THRESHOLDS.strain.low ? 'bg-green-500' :
                strain.strain <= STRAIN_THRESHOLDS.strain.moderate ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (strain.strain / 10000) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1">
            Load × Monotony
          </div>
        </div>
      </div>

      {/* ACWR explanation */}
      <div className="bg-dark-700/30 rounded-lg p-3 mb-4">
        <div className="text-xs text-tertiary mb-2">Acute:Chronic Workload Ratio Guide</div>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-2 rounded-l-full bg-amber-500/50" />
          <div className="flex-1 h-2 bg-green-500" />
          <div className="flex-1 h-2 rounded-r-full bg-red-500/50" />
        </div>
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>0.8</span>
          <span className="text-green-400">0.8-1.3 Optimal</span>
          <span>1.5+</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-3 rounded-lg ${getRiskColor(strain.riskLevel)}`}>
        <div className="flex items-start gap-2">
          {strain.riskLevel === 'low' ? (
            <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm">{strain.recommendation}</p>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 text-xs text-muted space-y-1">
        <p><strong>Monotony</strong> = Mean daily load / SD - measures training variety</p>
        <p><strong>Strain</strong> = Weekly load × Monotony - injury risk indicator</p>
        <p><strong>ACWR</strong> = Acute (7-day) / Chronic (28-day) load ratio</p>
      </div>
    </div>
  )
}
