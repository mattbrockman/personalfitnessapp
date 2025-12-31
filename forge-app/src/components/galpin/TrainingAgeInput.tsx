'use client'

import { useState, useEffect } from 'react'
import { TrainingAgeInfo } from '@/types/galpin'
import { calculateTrainingAge, formatTrainingAge, formatExperienceLevel } from '@/lib/galpin-calculations'

interface TrainingAgeInputProps {
  initialStartDate?: string | null
  onSave: (startDate: string) => Promise<void>
  className?: string
}

export function TrainingAgeInput({
  initialStartDate,
  onSave,
  className = '',
}: TrainingAgeInputProps) {
  const [startDate, setStartDate] = useState(initialStartDate || '')
  const [saving, setSaving] = useState(false)
  const [trainingAge, setTrainingAge] = useState<TrainingAgeInfo | null>(null)

  useEffect(() => {
    if (startDate) {
      setTrainingAge(calculateTrainingAge(startDate))
    } else {
      setTrainingAge(null)
    }
  }, [startDate])

  const handleSave = async () => {
    if (!startDate) return

    setSaving(true)
    try {
      await onSave(startDate)
    } finally {
      setSaving(false)
    }
  }

  // Calculate max date (today) for the date input
  const today = new Date().toISOString().split('T')[0]

  // Suggest some quick options
  const quickOptions = [
    { label: 'Just started', months: 0 },
    { label: '6 months ago', months: 6 },
    { label: '1 year ago', months: 12 },
    { label: '2 years ago', months: 24 },
    { label: '5 years ago', months: 60 },
  ]

  const selectQuickOption = (monthsAgo: number) => {
    const date = new Date()
    date.setMonth(date.getMonth() - monthsAgo)
    setStartDate(date.toISOString().split('T')[0])
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-2">Training Age</h3>
      <p className="text-sm text-gray-400 mb-4">
        When did you start structured resistance training?
      </p>

      {/* Quick options */}
      <div className="flex flex-wrap gap-2 mb-4">
        {quickOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => selectQuickOption(opt.months)}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">
          Or select exact date:
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          max={today}
          className="w-full bg-gray-700 rounded px-3 py-2 text-white"
        />
      </div>

      {/* Training age display */}
      {trainingAge && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Training Age</span>
            <span className="text-white font-medium">
              {formatTrainingAge(trainingAge.trainingAgeYears, trainingAge.trainingAgeMonths)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Experience Level</span>
            <span className={`font-medium ${
              trainingAge.experienceLevel === 'advanced' ? 'text-green-400' :
              trainingAge.experienceLevel === 'intermediate' ? 'text-blue-400' :
              'text-gray-300'
            }`}>
              {formatExperienceLevel(trainingAge.experienceLevel)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Volume Tolerance</span>
            <span className="text-white">
              {Math.round(trainingAge.volumeToleranceMultiplier * 100)}% of advanced
            </span>
          </div>
        </div>
      )}

      {/* What this affects */}
      <div className="mb-4 text-xs text-gray-500">
        Your training age affects recommended volume (MEV/MAV/MRV) and progression rates.
        Novices need less volume but can progress faster.
      </div>

      <button
        onClick={handleSave}
        disabled={!startDate || saving}
        className={`
          w-full py-2 px-4 rounded-lg font-medium transition-colors
          ${startDate && !saving
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
