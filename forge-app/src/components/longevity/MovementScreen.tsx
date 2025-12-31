'use client'

import { useState } from 'react'
import {
  Move,
  ChevronRight,
  Info,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { MovementScreen as MovementScreenType } from '@/types/longevity'
import { format, parseISO } from 'date-fns'

interface MovementScreenProps {
  latestScreen: MovementScreenType | null
  onRefresh?: () => void
}

const FMS_TESTS = [
  { key: 'deep_squat', name: 'Deep Squat', bilateral: false },
  { key: 'hurdle_step', name: 'Hurdle Step', bilateral: true },
  { key: 'inline_lunge', name: 'Inline Lunge', bilateral: true },
  { key: 'shoulder_mobility', name: 'Shoulder Mobility', bilateral: true },
  { key: 'active_slr', name: 'Active Straight Leg Raise', bilateral: true },
  { key: 'trunk_stability_pushup', name: 'Trunk Stability Push-up', bilateral: false },
  { key: 'rotary_stability', name: 'Rotary Stability', bilateral: true },
]

export function MovementScreen({
  latestScreen,
  onRefresh,
}: MovementScreenProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Assessment form state
  const [scores, setScores] = useState<Record<string, number>>({})

  // Calculate total score (using lower of bilateral scores)
  const calculateTotal = (screen: MovementScreenType): number => {
    let total = 0
    total += screen.deep_squat || 0
    total += Math.min(screen.hurdle_step_left || 0, screen.hurdle_step_right || 0)
    total += Math.min(screen.inline_lunge_left || 0, screen.inline_lunge_right || 0)
    total += Math.min(screen.shoulder_mobility_left || 0, screen.shoulder_mobility_right || 0)
    total += Math.min(screen.active_slr_left || 0, screen.active_slr_right || 0)
    total += screen.trunk_stability_pushup || 0
    total += Math.min(screen.rotary_stability_left || 0, screen.rotary_stability_right || 0)
    return total
  }

  const totalScore = latestScreen ? calculateTotal(latestScreen) : null

  // Get classification
  const getClassification = (total: number): { label: string; color: string } => {
    if (total >= 18) return { label: 'Excellent', color: 'text-green-400' }
    if (total >= 15) return { label: 'Good', color: 'text-blue-400' }
    if (total >= 12) return { label: 'Fair', color: 'text-amber-400' }
    return { label: 'Needs Work', color: 'text-red-400' }
  }

  const classification = totalScore ? getClassification(totalScore) : null

  // Check for asymmetries
  const hasAsymmetry = latestScreen && (
    Math.abs((latestScreen.hurdle_step_left || 0) - (latestScreen.hurdle_step_right || 0)) >= 2 ||
    Math.abs((latestScreen.inline_lunge_left || 0) - (latestScreen.inline_lunge_right || 0)) >= 2 ||
    Math.abs((latestScreen.shoulder_mobility_left || 0) - (latestScreen.shoulder_mobility_right || 0)) >= 2 ||
    Math.abs((latestScreen.active_slr_left || 0) - (latestScreen.active_slr_right || 0)) >= 2 ||
    Math.abs((latestScreen.rotary_stability_left || 0) - (latestScreen.rotary_stability_right || 0)) >= 2
  )

  // Check for pain (score of 0)
  const hasPain = latestScreen && Object.values(latestScreen).some(v => v === 0)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // This would submit to a movement_screens API
      // For now, we'll skip since the API isn't critical for the demo
      setShowModal(false)
      onRefresh?.()
    } catch (error) {
      console.error('Error saving movement screen:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="glass rounded-xl p-5 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => setShowModal(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Move size={18} className="text-indigo-400" />
            </div>
            <h3 className="font-medium">Movement Screen</h3>
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
            FMS-style assessment evaluates 7 fundamental movement patterns.
            Score 0-3 per movement (0 = pain). Total max is 21.
            Identifies asymmetries and injury risk.
          </div>
        )}

        {/* Main score */}
        {totalScore !== null ? (
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{totalScore}</span>
              <span className="text-white/50 text-sm">/ 21</span>
              {classification && (
                <span className={`text-sm ${classification.color}`}>
                  {classification.label}
                </span>
              )}
            </div>

            {/* Warnings */}
            {hasPain && (
              <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                <AlertTriangle size={12} />
                <span>Pain detected - consult a professional</span>
              </div>
            )}
            {hasAsymmetry && !hasPain && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                <AlertTriangle size={12} />
                <span>Asymmetries detected - focus on corrective work</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-2xl font-bold text-white/30">--</div>
            <p className="text-sm text-white/50 mt-1">No assessment recorded</p>
          </div>
        )}

        {/* Score breakdown mini-view */}
        {latestScreen && (
          <div className="mb-3 grid grid-cols-7 gap-1">
            {['DS', 'HS', 'IL', 'SM', 'SLR', 'TSP', 'RS'].map((abbr, i) => {
              const tests = [
                latestScreen.deep_squat,
                Math.min(latestScreen.hurdle_step_left || 0, latestScreen.hurdle_step_right || 0),
                Math.min(latestScreen.inline_lunge_left || 0, latestScreen.inline_lunge_right || 0),
                Math.min(latestScreen.shoulder_mobility_left || 0, latestScreen.shoulder_mobility_right || 0),
                Math.min(latestScreen.active_slr_left || 0, latestScreen.active_slr_right || 0),
                latestScreen.trunk_stability_pushup,
                Math.min(latestScreen.rotary_stability_left || 0, latestScreen.rotary_stability_right || 0),
              ]
              const score = tests[i] || 0
              return (
                <div key={abbr} className="text-center">
                  <div className={`text-xs ${
                    score === 3 ? 'text-green-400' :
                    score === 2 ? 'text-blue-400' :
                    score === 1 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {score}
                  </div>
                  <div className="text-[10px] text-white/30">{abbr}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          {latestScreen ? (
            <span className="text-white/40">
              Last assessed: {format(parseISO(latestScreen.screen_date), 'MMM d, yyyy')}
            </span>
          ) : (
            <span className="text-amber-400">Take movement assessment</span>
          )}
          <ChevronRight size={16} className="text-white/30" />
        </div>
      </div>

      {/* Assessment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Movement Screen Assessment</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-lg text-sm text-white/70">
                <Info size={14} className="inline mr-1 text-indigo-400" />
                Score each movement 0-3: 0=pain, 1=unable, 2=with compensation, 3=perfect
              </div>

              {FMS_TESTS.map(test => (
                <div key={test.key} className="p-3 bg-white/5 rounded-lg">
                  <p className="font-medium mb-2">{test.name}</p>
                  {test.bilateral ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-white/50">Left</span>
                        <div className="flex gap-1 mt-1">
                          {[0, 1, 2, 3].map(score => (
                            <button
                              key={score}
                              onClick={() => setScores(prev => ({
                                ...prev,
                                [`${test.key}_left`]: score,
                              }))}
                              className={`w-8 h-8 rounded ${
                                scores[`${test.key}_left`] === score
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-white/10 hover:bg-white/20'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-white/50">Right</span>
                        <div className="flex gap-1 mt-1">
                          {[0, 1, 2, 3].map(score => (
                            <button
                              key={score}
                              onClick={() => setScores(prev => ({
                                ...prev,
                                [`${test.key}_right`]: score,
                              }))}
                              className={`w-8 h-8 rounded ${
                                scores[`${test.key}_right`] === score
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-white/10 hover:bg-white/20'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(score => (
                        <button
                          key={score}
                          onClick={() => setScores(prev => ({
                            ...prev,
                            [test.key]: score,
                          }))}
                          className={`w-8 h-8 rounded ${
                            scores[test.key] === score
                              ? 'bg-amber-500 text-black'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Balance tests */}
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="font-medium mb-2">Single Leg Balance (seconds)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/50">Left (eyes open)</label>
                    <input
                      type="number"
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                      placeholder="seconds"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Right (eyes open)</label>
                    <input
                      type="number"
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                      placeholder="seconds"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Assessment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
