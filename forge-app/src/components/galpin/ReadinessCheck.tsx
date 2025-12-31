'use client'

import { useState } from 'react'
import { LogReadinessRequest, ReadinessResult, ReadinessAssessment } from '@/types/galpin'
import { getReadinessColor } from '@/lib/galpin-calculations'

interface ReadinessCheckProps {
  onSubmit: (data: LogReadinessRequest) => Promise<{
    assessment: ReadinessAssessment
    result: ReadinessResult
  }>
  className?: string
}

export function ReadinessCheck({ onSubmit, className = '' }: ReadinessCheckProps) {
  const [subjective, setSubjective] = useState<number>(5)
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [sleepHours, setSleepHours] = useState<number | null>(null)
  const [hrvReading, setHrvReading] = useState<number | null>(null)
  const [gripStrength, setGripStrength] = useState<number | null>(null)
  const [verticalJump, setVerticalJump] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReadinessResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const data: LogReadinessRequest = {
        subjective_readiness: subjective,
        sleep_quality: sleepQuality || undefined,
        sleep_hours: sleepHours || undefined,
        hrv_reading: hrvReading || undefined,
        grip_strength_lbs: gripStrength || undefined,
        vertical_jump_inches: verticalJump || undefined,
        notes: notes || undefined,
      }

      const response = await onSubmit(data)
      setResult(response.result)
    } catch (error) {
      console.error('Failed to submit readiness:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const color = getReadinessColor(result.score)

    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="text-center mb-4">
          <div
            className={`text-4xl font-bold ${
              color === 'green' ? 'text-green-400' :
              color === 'amber' ? 'text-amber-400' :
              'text-red-400'
            }`}
          >
            {result.score}
          </div>
          <div className="text-gray-400 text-sm">Readiness Score</div>
        </div>

        <div className={`
          p-3 rounded-lg mb-4
          ${result.recommendation === 'push' ? 'bg-green-900/30 border border-green-700' :
            result.recommendation === 'maintain' ? 'bg-amber-900/30 border border-amber-700' :
            'bg-red-900/30 border border-red-700'
          }
        `}>
          <div className="font-medium text-white capitalize">
            {result.recommendation === 'push' ? 'Good to Push' :
             result.recommendation === 'maintain' ? 'Train as Planned' :
             'Consider Reducing'}
          </div>
          <div className="text-sm text-gray-300 mt-1">
            Adjustment factor: {Math.round((result.adjustmentFactor - 1) * 100)}%
          </div>
        </div>

        {result.suggestions.length > 0 && (
          <div className="space-y-2">
            {result.suggestions.map((suggestion, i) => (
              <div key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {suggestion}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setResult(null)}
          className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white"
        >
          Log Another Assessment
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Pre-Workout Readiness</h3>

      {/* Subjective Readiness (Required) */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          How ready do you feel? (1-10)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="10"
            value={subjective}
            onChange={(e) => setSubjective(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-2xl font-bold text-white w-8 text-center">
            {subjective}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Exhausted</span>
          <span>Amazing</span>
        </div>
      </div>

      {/* Sleep (Optional) */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sleep Quality</label>
          <select
            value={sleepQuality || ''}
            onChange={(e) => setSleepQuality(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full bg-gray-700 rounded px-3 py-2 text-white"
          >
            <option value="">Skip</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}/10</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Hours Slept</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="14"
            value={sleepHours || ''}
            onChange={(e) => setSleepHours(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g., 7.5"
            className="w-full bg-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
      </div>

      {/* Advanced Options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-blue-400 hover:text-blue-300 mb-3"
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced metrics
      </button>

      {showAdvanced && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">HRV (RMSSD)</label>
            <input
              type="number"
              value={hrvReading || ''}
              onChange={(e) => setHrvReading(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g., 65"
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Grip Strength (lbs)</label>
              <input
                type="number"
                value={gripStrength || ''}
                onChange={(e) => setGripStrength(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 120"
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vertical Jump (in)</label>
              <input
                type="number"
                step="0.5"
                value={verticalJump || ''}
                onChange={(e) => setVerticalJump(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 24"
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything affecting readiness..."
          rows={2}
          className="w-full bg-gray-700 rounded px-3 py-2 text-white resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={`
          w-full py-2 px-4 rounded-lg font-medium transition-colors
          ${submitting
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {submitting ? 'Calculating...' : 'Calculate Readiness'}
      </button>
    </div>
  )
}
