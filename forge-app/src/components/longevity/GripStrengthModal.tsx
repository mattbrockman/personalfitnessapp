'use client'

import { useState } from 'react'
import {
  X,
  Grip,
  Loader2,
  Info,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { GripStrengthReading, GRIP_PERCENTILES } from '@/types/longevity'
import { format, parseISO } from 'date-fns'

interface GripStrengthModalProps {
  leftGrip: number | null
  rightGrip: number | null
  age: number
  sex: 'male' | 'female'
  recentReadings?: GripStrengthReading[]
  onClose: () => void
  onSave: () => void
}

export function GripStrengthModal({
  leftGrip,
  rightGrip,
  age,
  sex,
  recentReadings = [],
  onClose,
  onSave,
}: GripStrengthModalProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'new_test'>('history')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newLeft, setNewLeft] = useState('')
  const [newRight, setNewRight] = useState('')
  const [notes, setNotes] = useState('')

  // Get percentile info
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

  // Calculate percentile
  const getPercentile = (value: number): number => {
    if (value >= percentiles[90]) return 90 + Math.min(9, (value - percentiles[90]) / 5)
    if (value >= percentiles[75]) return 75 + (value - percentiles[75]) / (percentiles[90] - percentiles[75]) * 15
    if (value >= percentiles[50]) return 50 + (value - percentiles[50]) / (percentiles[75] - percentiles[50]) * 25
    if (value >= percentiles[25]) return 25 + (value - percentiles[25]) / (percentiles[50] - percentiles[25]) * 25
    if (value >= percentiles[10]) return 10 + (value - percentiles[10]) / (percentiles[25] - percentiles[10]) * 15
    return Math.max(1, (value / percentiles[10]) * 10)
  }

  // Preview values
  const previewLeft = newLeft ? parseFloat(newLeft) : null
  const previewRight = newRight ? parseFloat(newRight) : null
  const previewBest = previewLeft || previewRight
    ? Math.max(previewLeft || 0, previewRight || 0)
    : null
  const previewPercentile = previewBest ? Math.round(getPercentile(previewBest)) : null
  const previewAsymmetry = previewLeft && previewRight
    ? Math.abs(previewLeft - previewRight) / Math.max(previewLeft, previewRight) * 100
    : null

  const handleSubmit = async () => {
    if (!previewLeft && !previewRight) return

    setIsSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      // Save left grip
      if (previewLeft) {
        await fetch('/api/health-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric_date: today,
            metric_type: 'grip_strength_left',
            value: previewLeft,
            unit: 'lbs',
            source: 'manual',
            notes: notes || null,
          }),
        })
      }

      // Save right grip
      if (previewRight) {
        await fetch('/api/health-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric_date: today,
            metric_type: 'grip_strength_right',
            value: previewRight,
            unit: 'lbs',
            source: 'manual',
            notes: notes || null,
          }),
        })
      }

      onSave()
    } catch (error) {
      console.error('Error saving grip strength:', error)
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
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Grip size={20} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold">Grip Strength</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'history', label: 'History' },
            { id: 'new_test', label: 'Log Test' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'history' | 'new_test')}
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
              {/* Current summary */}
              {(leftGrip || rightGrip) && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-white/40 text-xs">Left Hand</span>
                      <p className="text-2xl font-bold">{leftGrip || '--'} <span className="text-sm text-white/50">lbs</span></p>
                    </div>
                    <div>
                      <span className="text-white/40 text-xs">Right Hand</span>
                      <p className="text-2xl font-bold">{rightGrip || '--'} <span className="text-sm text-white/50">lbs</span></p>
                    </div>
                  </div>
                  <div className="text-sm text-white/60">
                    Reference for {sex}, age {bracket}: 50th percentile = {percentiles[50]} lbs
                  </div>
                </div>
              )}

              {/* Reference table */}
              <div className="p-3 bg-white/5 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Reference Values ({sex}, {bracket})</h4>
                <div className="grid grid-cols-5 gap-2 text-xs text-center">
                  <div className="text-white/40">10th</div>
                  <div className="text-white/40">25th</div>
                  <div className="text-white/40">50th</div>
                  <div className="text-white/40">75th</div>
                  <div className="text-white/40">90th</div>
                  <div className="text-red-400">{percentiles[10]}</div>
                  <div className="text-amber-400">{percentiles[25]}</div>
                  <div className="text-white">{percentiles[50]}</div>
                  <div className="text-blue-400">{percentiles[75]}</div>
                  <div className="text-green-400">{percentiles[90]}</div>
                </div>
              </div>

              {/* History */}
              {recentReadings.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Test History</h4>
                  <div className="space-y-2">
                    {recentReadings.map((reading, i) => (
                      <div
                        key={reading.id || i}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            L: {reading.left_lbs} / R: {reading.right_lbs} lbs
                          </p>
                          <p className="text-xs text-white/40">
                            {format(parseISO(reading.date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  <Grip size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No tests recorded yet</p>
                </div>
              )}

              {/* Tips */}
              <div className="p-3 bg-purple-500/10 rounded-lg text-sm">
                <p className="text-purple-400 font-medium mb-1">Testing Tips</p>
                <ul className="text-white/60 text-xs space-y-1">
                  <li>• Use a hand dynamometer for accuracy</li>
                  <li>• Take 3 attempts per hand, record best</li>
                  <li>• Test at the same time of day for consistency</li>
                  <li>• Warm up hands before testing</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'new_test' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                <Info size={14} className="inline mr-1 text-blue-400" />
                Use a hand dynamometer. Take 3 attempts per hand and record the best value.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Left Hand (lbs)</label>
                  <input
                    type="number"
                    value={newLeft}
                    onChange={(e) => setNewLeft(e.target.value)}
                    placeholder="e.g., 95"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Right Hand (lbs)</label>
                  <input
                    type="number"
                    value={newRight}
                    onChange={(e) => setNewRight(e.target.value)}
                    placeholder="e.g., 100"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Device used, conditions, etc."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Preview */}
              {previewBest && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 text-sm">Preview</span>
                    {previewPercentile && (
                      <span className="text-sm">
                        {previewPercentile}th percentile
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <span className="text-white/40 text-xs">Left</span>
                      <p className="text-xl font-bold">{previewLeft || '--'}</p>
                    </div>
                    <div>
                      <span className="text-white/40 text-xs">Right</span>
                      <p className="text-xl font-bold">{previewRight || '--'}</p>
                    </div>
                  </div>

                  {previewAsymmetry !== null && previewAsymmetry > 10 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-400 justify-center">
                      <AlertTriangle size={12} />
                      <span>{previewAsymmetry.toFixed(0)}% asymmetry - consider addressing</span>
                    </div>
                  )}
                </div>
              )}

              {/* How to improve */}
              <div className="p-3 bg-white/5 rounded-lg text-sm">
                <p className="font-medium mb-2">How to improve grip strength:</p>
                <ul className="text-white/60 space-y-1 text-xs">
                  <li>• Dead hangs (3x max hold, 2-3x/week)</li>
                  <li>• Farmer's carries (heavy, 30-60 sec holds)</li>
                  <li>• Wrist curls and reverse curls</li>
                  <li>• Grip trainers/squeezers</li>
                  <li>• Avoid using straps during lifting when possible</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'new_test' && (
          <div className="p-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={(!previewLeft && !previewRight) || isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Reading'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
