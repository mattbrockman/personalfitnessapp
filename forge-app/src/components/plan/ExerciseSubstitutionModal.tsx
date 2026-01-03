'use client'

import { useState } from 'react'
import { ExerciseSubstitutions, SubstitutionReason } from '@/types/training-plan'
import { X, ArrowRight, Search, AlertCircle, Dumbbell } from 'lucide-react'

interface ExerciseSubstitutionModalProps {
  isOpen: boolean
  onClose: () => void
  substitutions: ExerciseSubstitutions | null
  exerciseName?: string
  onSubstitute?: (original: string, replacement: string, reason: SubstitutionReason) => void
}

const REASON_LABELS: Record<SubstitutionReason, string> = {
  knee_pain: 'Knee Pain',
  back_pain: 'Back Pain',
  shoulder_pain: 'Shoulder Pain',
  hip_pain: 'Hip Pain',
  equipment: 'Equipment Alternative',
  preference: 'Personal Preference'
}

const REASON_COLORS: Record<SubstitutionReason, string> = {
  knee_pain: 'bg-red-500/20 text-red-400',
  back_pain: 'bg-orange-500/20 text-orange-400',
  shoulder_pain: 'bg-yellow-500/20 text-yellow-400',
  hip_pain: 'bg-purple-500/20 text-purple-400',
  equipment: 'bg-blue-500/20 text-blue-400',
  preference: 'bg-green-500/20 text-green-400'
}

export function ExerciseSubstitutionModal({
  isOpen,
  onClose,
  substitutions,
  exerciseName,
  onSubstitute
}: ExerciseSubstitutionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(exerciseName || null)
  const [selectedReason, setSelectedReason] = useState<SubstitutionReason | null>(null)

  if (!isOpen) return null

  const exerciseList = substitutions ? Object.keys(substitutions) : []
  const filteredExercises = exerciseList.filter(ex =>
    ex.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedSubstitutions = selectedExercise && substitutions
    ? substitutions[selectedExercise]
    : null

  const handleSubstitute = (replacement: string) => {
    if (selectedExercise && selectedReason && onSubstitute) {
      onSubstitute(selectedExercise, replacement, selectedReason)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-lg">Exercise Substitutions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!substitutions || exerciseList.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-tertiary">No substitution data available</p>
              <p className="text-sm text-muted mt-1">Generate a plan to see exercise alternatives</p>
            </div>
          ) : (
            <>
              {/* Search / Exercise Selection */}
              {!selectedExercise && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                    <input
                      type="text"
                      placeholder="Search exercises..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredExercises.map(exercise => (
                      <button
                        key={exercise}
                        onClick={() => setSelectedExercise(exercise)}
                        className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                      >
                        <span className="font-medium">{exercise}</span>
                        <div className="flex gap-1 mt-1">
                          {substitutions[exercise] && Object.keys(substitutions[exercise]).map(reason => (
                            <span
                              key={reason}
                              className={`text-xs px-1.5 py-0.5 rounded ${REASON_COLORS[reason as SubstitutionReason]}`}
                            >
                              {REASON_LABELS[reason as SubstitutionReason]}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}

                    {filteredExercises.length === 0 && (
                      <p className="text-center text-secondary py-4">No exercises match your search</p>
                    )}
                  </div>
                </>
              )}

              {/* Selected Exercise View */}
              {selectedExercise && selectedSubstitutions && (
                <>
                  <button
                    onClick={() => {
                      setSelectedExercise(null)
                      setSelectedReason(null)
                    }}
                    className="text-sm text-tertiary hover:text-white flex items-center gap-1"
                  >
                    <ArrowRight className="w-3 h-3 rotate-180" />
                    Back to exercises
                  </button>

                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-xs text-secondary mb-1">Original Exercise</p>
                    <p className="font-medium text-lg">{selectedExercise}</p>
                  </div>

                  {/* Reason Selection */}
                  <div>
                    <p className="text-xs text-secondary mb-2">Why do you need a substitute?</p>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(selectedSubstitutions) as SubstitutionReason[]).map(reason => (
                        <button
                          key={reason}
                          onClick={() => setSelectedReason(reason)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedReason === reason
                              ? REASON_COLORS[reason]
                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {REASON_LABELS[reason]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alternatives */}
                  {selectedReason && selectedSubstitutions[selectedReason] && (
                    <div>
                      <p className="text-xs text-secondary mb-2">Recommended Alternatives</p>
                      <div className="space-y-2">
                        {selectedSubstitutions[selectedReason]!.map((alt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSubstitute(alt)}
                            className="w-full p-3 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-lg text-left transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{alt}</span>
                              {onSubstitute && (
                                <span className="text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Select
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
