'use client'

import { useState } from 'react'
import { TestType } from '@/types/strength'
import { calculate1RM } from '@/lib/strength-calculations'
import { X, Target, AlertCircle, CheckCircle, Dumbbell } from 'lucide-react'

interface StrengthTestModalProps {
  exerciseId: string
  exerciseName: string
  currentEstimate?: number
  onClose: () => void
  onSave?: (result: { estimated1RM: number; testType: TestType }) => void
}

export function StrengthTestModal({
  exerciseId,
  exerciseName,
  currentEstimate,
  onClose,
  onSave,
}: StrengthTestModalProps) {
  const [testType, setTestType] = useState<TestType>('5rm')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{
    estimated1RM: number
    confidence: string
    improvement?: number
  } | null>(null)

  const testTypes: { value: TestType; label: string; description: string; targetReps: string }[] = [
    { value: '1rm', label: '1RM Test', description: 'True max single', targetReps: '1' },
    { value: '3rm', label: '3RM Test', description: 'Heavy triple', targetReps: '3' },
    { value: '5rm', label: '5RM Test', description: 'Best for accuracy', targetReps: '5' },
    { value: 'amrap', label: 'AMRAP Test', description: 'Max reps at given weight', targetReps: 'Max' },
  ]

  const handleCalculate = () => {
    const w = parseFloat(weight)
    const r = parseInt(reps)

    if (!w || !r || w <= 0 || r <= 0) return

    const calcResult = calculate1RM(w, r)
    const improvement = currentEstimate
      ? Math.round(((calcResult.estimated1RM - currentEstimate) / currentEstimate) * 100)
      : undefined

    setResult({
      estimated1RM: calcResult.estimated1RM,
      confidence: calcResult.confidence,
      improvement,
    })
  }

  const handleSave = async () => {
    if (!result) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/strength/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exerciseId,
          test_type: testType,
          weight_lbs: parseFloat(weight),
          reps_achieved: parseInt(reps),
          rpe: rpe ? parseFloat(rpe) : undefined,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        onSave?.({ estimated1RM: result.estimated1RM, testType })
        onClose()
      }
    } catch (err) {
      console.error('Error saving test:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Target className="text-amber-400" size={20} />
            <h3 className="font-semibold">Strength Test</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X size={18} className="text-tertiary" />
          </button>
        </div>

        <div className="p-4">
          {/* Exercise name */}
          <div className="flex items-center gap-2 mb-4 p-2 bg-dark-700/50 rounded-lg">
            <Dumbbell size={16} className="text-tertiary" />
            <span className="font-medium">{exerciseName}</span>
            {currentEstimate && (
              <span className="ml-auto text-sm text-secondary">
                Current: {currentEstimate} lbs
              </span>
            )}
          </div>

          {/* Test type selection */}
          <div className="mb-4">
            <label className="text-sm text-tertiary mb-2 block">Test Type</label>
            <div className="grid grid-cols-2 gap-2">
              {testTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setTestType(t.value)
                    if (t.value !== 'amrap' && t.targetReps !== 'Max') {
                      setReps(t.targetReps)
                    }
                  }}
                  className={`p-2 rounded-lg text-left ${
                    testType === t.value
                      ? 'bg-amber-500/20 border border-amber-500/50'
                      : 'bg-dark-700/50 hover:bg-dark-700'
                  }`}
                >
                  <div className={`font-medium text-sm ${testType === t.value ? 'text-amber-400' : ''}`}>
                    {t.label}
                  </div>
                  <div className="text-xs text-secondary">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Weight and reps */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm text-tertiary mb-1 block">Weight (lbs)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value)
                  setResult(null)
                }}
                placeholder="225"
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-lg font-medium"
              />
            </div>
            <div>
              <label className="text-sm text-tertiary mb-1 block">Reps Achieved</label>
              <input
                type="number"
                value={reps}
                onChange={(e) => {
                  setReps(e.target.value)
                  setResult(null)
                }}
                placeholder="5"
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-lg font-medium"
                disabled={testType === '1rm'}
              />
            </div>
          </div>

          {/* RPE (optional) */}
          <div className="mb-4">
            <label className="text-sm text-tertiary mb-1 block">RPE (optional)</label>
            <input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder="9.5"
              className="w-full bg-dark-700 rounded-lg px-3 py-2"
              step="0.5"
              min="5"
              max="10"
            />
          </div>

          {/* Notes (optional) */}
          <div className="mb-4">
            <label className="text-sm text-tertiary mb-1 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Belt, felt strong, etc."
              className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Calculate button */}
          {!result && (
            <button
              onClick={handleCalculate}
              disabled={!weight || !reps}
              className="w-full py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Calculate 1RM
            </button>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-tertiary">Estimated 1RM</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    result.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                    result.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {result.confidence} confidence
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-400">
                    {result.estimated1RM}
                  </span>
                  <span className="text-tertiary">lbs</span>
                </div>
                {result.improvement !== undefined && (
                  <div className="mt-2 text-sm">
                    {result.improvement > 0 ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle size={14} />
                        +{result.improvement}% improvement!
                      </span>
                    ) : result.improvement < 0 ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {result.improvement}% from previous
                      </span>
                    ) : (
                      <span className="text-secondary">Same as previous</span>
                    )}
                  </div>
                )}
              </div>

              {result.confidence !== 'high' && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg text-xs text-amber-400">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {result.confidence === 'medium'
                      ? 'For better accuracy, test with 3-5 reps.'
                      : 'Estimates from 10+ reps are less reliable.'}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="flex-1 py-2 bg-dark-700 text-white/70 rounded-lg hover:bg-dark-600"
                >
                  Recalculate
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Result'}
                </button>
              </div>
            </div>
          )}

          {/* Test protocol tips */}
          <div className="mt-4 p-3 bg-dark-700/30 rounded-lg">
            <div className="text-xs text-tertiary mb-2 font-medium">Test Protocol Tips</div>
            <ul className="text-xs text-secondary space-y-1">
              {testType === '1rm' && (
                <>
                  <li>• Warm up thoroughly (10-15 min)</li>
                  <li>• Work up: 50% × 5, 70% × 3, 85% × 1, 95% × 1</li>
                  <li>• Attempt max, rest 3-5 min between</li>
                </>
              )}
              {testType === '3rm' && (
                <>
                  <li>• Warm up, then work to a challenging triple</li>
                  <li>• Should be RPE 9-10 (0-1 reps left)</li>
                  <li>• Most accurate when all 3 reps are clean</li>
                </>
              )}
              {testType === '5rm' && (
                <>
                  <li>• Best balance of accuracy and safety</li>
                  <li>• Work up to max weight for 5 clean reps</li>
                  <li>• Formula accuracy is highest in 3-7 rep range</li>
                </>
              )}
              {testType === 'amrap' && (
                <>
                  <li>• Choose a moderate weight (60-75% of estimated max)</li>
                  <li>• Perform as many reps as possible with good form</li>
                  <li>• Stop 1-2 reps before form breaks down</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
