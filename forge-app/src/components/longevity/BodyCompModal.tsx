'use client'

import { useState } from 'react'
import {
  X,
  Scale,
  Loader2,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { BodyCompositionLog, BodyCompSource } from '@/types/longevity'
import { format, parseISO } from 'date-fns'

interface BodyCompModalProps {
  latestLog: BodyCompositionLog | null
  recentLogs?: BodyCompositionLog[]
  onClose: () => void
  onSave: () => void
}

const SOURCE_OPTIONS: { value: BodyCompSource; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual Entry', description: 'Basic weight and estimates' },
  { value: 'smart_scale', label: 'Smart Scale', description: 'Bioimpedance scale (Withings, etc.)' },
  { value: 'bioimpedance', label: 'Bioimpedance', description: 'InBody or similar device' },
  { value: 'dexa', label: 'DEXA Scan', description: 'Gold standard body composition' },
  { value: 'bod_pod', label: 'Bod Pod', description: 'Air displacement plethysmography' },
]

export function BodyCompModal({
  latestLog,
  recentLogs = [],
  onClose,
  onSave,
}: BodyCompModalProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'log'>('history')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [source, setSource] = useState<BodyCompSource>('manual')

  // Form state
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [leanMass, setLeanMass] = useState('')
  const [muscleMass, setMuscleMass] = useState('')
  const [visceralFat, setVisceralFat] = useState('')
  const [waterPct, setWaterPct] = useState('')
  const [boneMass, setBoneMass] = useState('')
  const [notes, setNotes] = useState('')

  // Calculate lean mass if not provided
  const calculatedLeanMass = !leanMass && weight && bodyFat
    ? (parseFloat(weight) * (1 - parseFloat(bodyFat) / 100)).toFixed(1)
    : leanMass

  // Calculate FFMI (requires height, assume 5'10" / 177cm as placeholder)
  const heightM = 1.77 // Should come from profile
  const ffmi = calculatedLeanMass
    ? (parseFloat(calculatedLeanMass) * 0.453592) / (heightM * heightM)
    : null

  const handleSubmit = async () => {
    if (!weight) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: new Date().toISOString().split('T')[0],
          weight_lbs: parseFloat(weight),
          body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
          lean_mass_lbs: calculatedLeanMass ? parseFloat(calculatedLeanMass) : null,
          muscle_mass_lbs: muscleMass ? parseFloat(muscleMass) : null,
          visceral_fat_rating: visceralFat ? parseInt(visceralFat) : null,
          water_pct: waterPct ? parseFloat(waterPct) : null,
          bone_mass_lbs: boneMass ? parseFloat(boneMass) : null,
          ffmi: ffmi ? parseFloat(ffmi.toFixed(2)) : null,
          source,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      onSave()
    } catch (error) {
      console.error('Error saving body composition:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Scale size={20} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold">Body Composition</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'history', label: 'History' },
            { id: 'log', label: 'Log Entry' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'history' | 'log')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Summary */}
              {latestLog && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <h4 className="text-sm font-medium text-white/60 mb-3">Current Composition</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-white/40 text-xs">Weight</span>
                      <p className="text-xl font-bold">{latestLog.weight_lbs?.toFixed(1)} lbs</p>
                    </div>
                    <div>
                      <span className="text-white/40 text-xs">Lean Mass</span>
                      <p className="text-xl font-bold text-green-400">{latestLog.lean_mass_lbs?.toFixed(1)} lbs</p>
                    </div>
                    <div>
                      <span className="text-white/40 text-xs">Body Fat</span>
                      <p className="text-xl font-bold">{latestLog.body_fat_pct?.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-white/40 text-xs">Muscle Mass</span>
                      <p className="text-xl font-bold">{latestLog.muscle_mass_lbs?.toFixed(1) || '--'} lbs</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trend chart placeholder */}
              {recentLogs.length > 1 && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <h4 className="text-sm font-medium text-white/60 mb-3">Lean Mass Trend</h4>
                  <div className="flex items-end gap-2 h-20">
                    {recentLogs.slice(0, 8).reverse().map((log, i) => {
                      const maxLean = Math.max(...recentLogs.map(l => l.lean_mass_lbs || 0))
                      const minLean = Math.min(...recentLogs.map(l => l.lean_mass_lbs || 0))
                      const range = maxLean - minLean || 1
                      const height = ((log.lean_mass_lbs || 0) - minLean) / range * 60 + 20
                      return (
                        <div
                          key={log.id || i}
                          className="flex-1 bg-green-500/40 rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${log.lean_mass_lbs} lbs - ${format(parseISO(log.log_date), 'MMM d')}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* History list */}
              {recentLogs.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Recent Logs</h4>
                  <div className="space-y-2">
                    {recentLogs.map((log, i) => (
                      <div
                        key={log.id || i}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {log.weight_lbs?.toFixed(1)} lbs • {log.body_fat_pct?.toFixed(1)}% BF
                          </p>
                          <p className="text-xs text-white/40">
                            {format(parseISO(log.log_date), 'MMM d, yyyy')} • {log.source}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-green-400">LM: {log.lean_mass_lbs?.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  <Scale size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No logs recorded yet</p>
                </div>
              )}

              {/* Info */}
              <div className="p-3 bg-blue-500/10 rounded-lg text-sm">
                <p className="text-blue-400 font-medium mb-1">Why Lean Mass Matters</p>
                <p className="text-white/60 text-xs">
                  Muscle mass is protective against metabolic disease, falls, and all-cause mortality.
                  Focus on gaining or maintaining lean mass, not just losing weight.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-4">
              {/* Source selector */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Data Source</label>
                <div className="grid grid-cols-2 gap-2">
                  {SOURCE_OPTIONS.slice(0, 4).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSource(opt.value)}
                      className={`p-2 rounded-lg text-left text-sm transition-colors ${
                        source === opt.value
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-xs text-white/40">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Weight (lbs)*</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 175"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    placeholder="e.g., 18"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Calculated lean mass */}
              {weight && bodyFat && !leanMass && (
                <div className="p-2 bg-green-500/10 rounded-lg text-sm">
                  <span className="text-white/60">Calculated Lean Mass: </span>
                  <span className="text-green-400 font-medium">{calculatedLeanMass} lbs</span>
                </div>
              )}

              {/* Extended fields for DEXA/InBody */}
              {(source === 'dexa' || source === 'bioimpedance') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Lean Mass (lbs)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={leanMass}
                        onChange={(e) => setLeanMass(e.target.value)}
                        placeholder="From scan"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Muscle Mass (lbs)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={muscleMass}
                        onChange={(e) => setMuscleMass(e.target.value)}
                        placeholder="From scan"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Visceral Fat</label>
                      <input
                        type="number"
                        value={visceralFat}
                        onChange={(e) => setVisceralFat(e.target.value)}
                        placeholder="1-20"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Water %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={waterPct}
                        onChange={(e) => setWaterPct(e.target.value)}
                        placeholder="e.g., 55"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Bone Mass</label>
                      <input
                        type="number"
                        step="0.1"
                        value={boneMass}
                        onChange={(e) => setBoneMass(e.target.value)}
                        placeholder="lbs"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any context or notes"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* FFMI Preview */}
              {ffmi && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">FFMI (Fat-Free Mass Index)</span>
                    <span className="font-bold">{ffmi.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    {ffmi >= 25 ? 'Elite (possible with PEDs)' :
                     ffmi >= 22 ? 'Excellent (natural limit area)' :
                     ffmi >= 20 ? 'Good (trained)' :
                     ffmi >= 18 ? 'Average' : 'Below average'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'log' && (
          <div className="p-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!weight || isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Entry'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
