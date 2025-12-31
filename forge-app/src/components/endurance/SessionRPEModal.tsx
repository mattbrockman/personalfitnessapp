'use client'

import { useState } from 'react'
import { X, Activity, Info } from 'lucide-react'
import { SESSION_RPE_DESCRIPTIONS } from '@/types/endurance'
import { calculateSessionLoad } from '@/lib/training-load'

interface SessionRPEModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rpe: number, trainingLoad: number) => void
  workoutName: string
  durationMinutes: number
}

export function SessionRPEModal({
  isOpen,
  onClose,
  onSave,
  workoutName,
  durationMinutes,
}: SessionRPEModalProps) {
  const [selectedRPE, setSelectedRPE] = useState<number | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  if (!isOpen) return null

  const trainingLoad = selectedRPE ? calculateSessionLoad(durationMinutes, selectedRPE) : 0

  const handleSave = () => {
    if (selectedRPE) {
      onSave(selectedRPE, trainingLoad)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-800 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-400" size={20} />
            <h2 className="text-lg font-semibold">Session RPE</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Workout info */}
          <div className="bg-dark-700/50 rounded-lg p-3 mb-4">
            <div className="text-sm text-white/50">Workout completed</div>
            <div className="font-medium">{workoutName}</div>
            <div className="text-sm text-white/50">{durationMinutes} minutes</div>
          </div>

          {/* Question */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">
              How hard was this workout overall?
            </p>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <Info size={16} className="text-white/50" />
            </button>
          </div>

          {/* Info panel */}
          {showInfo && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4 text-xs text-blue-300">
              <p className="font-medium mb-1">Session RPE (Rating of Perceived Exertion)</p>
              <p>Rate how hard the ENTIRE session felt, not just the hardest moment. Consider the full duration and all intervals.</p>
            </div>
          )}

          {/* RPE selector */}
          <div className="space-y-1 mb-4">
            {Object.entries(SESSION_RPE_DESCRIPTIONS).map(([rpe, info]) => {
              const rpeNum = parseInt(rpe)
              const isSelected = selectedRPE === rpeNum

              return (
                <button
                  key={rpe}
                  onClick={() => setSelectedRPE(rpeNum)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-blue-500/20 border border-blue-500/50'
                      : 'bg-dark-700/30 hover:bg-dark-700/50 border border-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      rpeNum <= 3
                        ? 'bg-green-500/20 text-green-400'
                        : rpeNum <= 5
                        ? 'bg-blue-500/20 text-blue-400'
                        : rpeNum <= 7
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {rpe}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium">{info.label}</div>
                    <div className="text-xs text-white/40">{info.description}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Training load preview */}
          {selectedRPE && (
            <div className="bg-dark-700/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Training Load</span>
                <span className="text-lg font-semibold text-blue-400">
                  {trainingLoad.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-white/40 mt-1">
                {durationMinutes} min × RPE {selectedRPE} = {trainingLoad} load units
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-dark-700 hover:bg-dark-600"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedRPE}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
