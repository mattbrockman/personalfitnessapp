'use client'

import { useState } from 'react'
import {
  X,
  Heart,
  Play,
  Timer,
  Route,
  Footprints,
  ArrowUpDown,
  Loader2,
  Info,
  TrendingUp,
  Target,
} from 'lucide-react'
import { VO2maxTest, VO2maxTestType } from '@/types/longevity'
import {
  cooperTest,
  onePointFiveMileTest,
  rockportWalkTest,
  stepTest,
  getVO2maxPercentile,
  calculateTargetVO2max,
  getMortalityRiskInfo,
  conversions,
} from '@/lib/vo2max'
import { format, parseISO } from 'date-fns'

interface VO2maxModalProps {
  currentVO2max: number | null
  age: number
  sex: 'male' | 'female'
  recentTests?: VO2maxTest[]
  onClose: () => void
  onSave: () => void
}

type TestTab = 'results' | 'new_test' | 'targets'

const TEST_OPTIONS: { type: VO2maxTestType; name: string; description: string; icon: React.ReactNode }[] = [
  {
    type: 'cooper_12min',
    name: 'Cooper 12-Minute Run',
    description: 'Run as far as you can in 12 minutes',
    icon: <Timer size={18} />,
  },
  {
    type: '1.5_mile_run',
    name: '1.5 Mile Run',
    description: 'Run 1.5 miles (2.4km) as fast as possible',
    icon: <Route size={18} />,
  },
  {
    type: 'rockport_walk',
    name: 'Rockport Walk Test',
    description: 'Walk 1 mile as fast as possible (less fit individuals)',
    icon: <Footprints size={18} />,
  },
  {
    type: 'step_test',
    name: '3-Minute Step Test',
    description: 'Step up and down for 3 minutes, measure recovery HR',
    icon: <ArrowUpDown size={18} />,
  },
  {
    type: 'lab',
    name: 'Lab Test Result',
    description: 'Enter a result from a formal VO2max test',
    icon: <Heart size={18} />,
  },
]

export function VO2maxModal({
  currentVO2max,
  age,
  sex,
  recentTests = [],
  onClose,
  onSave,
}: VO2maxModalProps) {
  const [activeTab, setActiveTab] = useState<TestTab>('results')
  const [selectedTest, setSelectedTest] = useState<VO2maxTestType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state for different tests
  const [cooperDistance, setCooperDistance] = useState('')
  const [mileTime, setMileTime] = useState({ minutes: '', seconds: '' })
  const [walkData, setWalkData] = useState({ time: '', hr: '' })
  const [stepHR, setStepHR] = useState('')
  const [labResult, setLabResult] = useState('')
  const [testNotes, setTestNotes] = useState('')
  const [weightKg, setWeightKg] = useState('')

  // Calculate estimate based on selected test
  const calculateEstimate = (): number | null => {
    try {
      switch (selectedTest) {
        case 'cooper_12min':
          if (!cooperDistance) return null
          return cooperTest(parseFloat(cooperDistance))

        case '1.5_mile_run':
          if (!mileTime.minutes) return null
          const totalSeconds = parseInt(mileTime.minutes) * 60 + (parseInt(mileTime.seconds) || 0)
          return onePointFiveMileTest(totalSeconds)

        case 'rockport_walk':
          if (!walkData.time || !walkData.hr || !weightKg) return null
          return rockportWalkTest(
            parseFloat(walkData.time),
            parseInt(walkData.hr),
            parseFloat(weightKg),
            age,
            sex
          )

        case 'step_test':
          if (!stepHR) return null
          return stepTest(parseInt(stepHR), sex)

        case 'lab':
          if (!labResult) return null
          return parseFloat(labResult)

        default:
          return null
      }
    } catch {
      return null
    }
  }

  const estimate = calculateEstimate()
  const estimatePercentile = estimate ? getVO2maxPercentile(estimate, age, sex) : null

  // Target calculations
  const targetAt80 = calculateTargetVO2max(age, 80, sex, 90)
  const targetAt90 = calculateTargetVO2max(age, 90, sex, 90)

  const handleSubmit = async () => {
    if (!estimate || !selectedTest) return

    setIsSubmitting(true)
    try {
      // Build test data
      const testData: Partial<VO2maxTest> = {
        test_date: new Date().toISOString().split('T')[0],
        test_type: selectedTest,
        estimated_vo2max: estimate,
        notes: testNotes || undefined,
      }

      // Add test-specific data
      if (selectedTest === 'cooper_12min') {
        testData.distance_meters = parseFloat(cooperDistance)
        testData.duration_seconds = 720 // 12 minutes
      } else if (selectedTest === '1.5_mile_run') {
        testData.distance_meters = 2414 // 1.5 miles
        testData.duration_seconds = parseInt(mileTime.minutes) * 60 + (parseInt(mileTime.seconds) || 0)
      } else if (selectedTest === 'rockport_walk') {
        testData.distance_meters = 1609 // 1 mile
        testData.duration_seconds = parseFloat(walkData.time) * 60
        testData.final_heart_rate = parseInt(walkData.hr)
        testData.weight_kg = parseFloat(weightKg)
      } else if (selectedTest === 'step_test') {
        testData.recovery_heart_rate = parseInt(stepHR)
        testData.duration_seconds = 180 // 3 minutes
      }

      // Save to API
      const response = await fetch('/api/health-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_date: testData.test_date,
          metric_type: 'vo2max',
          value: estimate,
          unit: 'ml/kg/min',
          source: selectedTest === 'lab' ? 'lab' : 'field_test',
          notes: JSON.stringify(testData),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save VO2max test')
      }

      onSave()
    } catch (error) {
      console.error('Error saving VO2max test:', error)
      alert('Failed to save test result. Please try again.')
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
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Heart size={20} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold">VO2max Tracking</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'results', label: 'History' },
            { id: 'new_test', label: 'New Test' },
            { id: 'targets', label: 'Targets' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TestTab)}
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
          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {/* Current value summary */}
              {currentVO2max && estimatePercentile && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60">Current VO2max</span>
                    <span className="text-2xl font-bold">{currentVO2max}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-white/40">Percentile</span>
                      <p className="font-medium">{estimatePercentile.percentile}th</p>
                    </div>
                    <div>
                      <span className="text-white/40">Fitness Age</span>
                      <p className="font-medium">{estimatePercentile.fitnessAge} years</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent tests */}
              {recentTests.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-2">Test History</h3>
                  <div className="space-y-2">
                    {recentTests.map((test, i) => (
                      <div
                        key={test.id || i}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{test.estimated_vo2max} ml/kg/min</p>
                          <p className="text-xs text-white/40">
                            {format(parseISO(test.test_date), 'MMM d, yyyy')} •{' '}
                            {test.test_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          {i > 0 && (
                            <span className={
                              test.estimated_vo2max > recentTests[i - 1].estimated_vo2max
                                ? 'text-green-400'
                                : test.estimated_vo2max < recentTests[i - 1].estimated_vo2max
                                ? 'text-red-400'
                                : 'text-white/40'
                            }>
                              {test.estimated_vo2max > recentTests[i - 1].estimated_vo2max ? '+' : ''}
                              {(test.estimated_vo2max - recentTests[i - 1].estimated_vo2max).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  <Heart size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No tests recorded yet</p>
                  <p className="text-sm">Take a field test to get started</p>
                </div>
              )}

              {/* Risk info */}
              {currentVO2max && estimatePercentile && (
                <div className="p-3 bg-blue-500/10 rounded-lg text-sm">
                  <p className="text-blue-400 font-medium mb-1">
                    {getMortalityRiskInfo(estimatePercentile.percentile).category} Fitness
                  </p>
                  <p className="text-white/60">
                    {getMortalityRiskInfo(estimatePercentile.percentile).description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* New Test Tab */}
          {activeTab === 'new_test' && (
            <div className="space-y-4">
              {!selectedTest ? (
                <>
                  <p className="text-sm text-white/60">
                    Choose a field test to estimate your VO2max. Each test takes 3-15 minutes.
                  </p>
                  <div className="space-y-2">
                    {TEST_OPTIONS.map(test => (
                      <button
                        key={test.type}
                        onClick={() => setSelectedTest(test.type)}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                      >
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                          {test.icon}
                        </div>
                        <div>
                          <p className="font-medium">{test.name}</p>
                          <p className="text-xs text-white/50">{test.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedTest(null)}
                    className="text-sm text-amber-400 hover:text-amber-300"
                  >
                    ← Choose different test
                  </button>

                  <h3 className="font-medium">
                    {TEST_OPTIONS.find(t => t.type === selectedTest)?.name}
                  </h3>

                  {/* Cooper Test */}
                  {selectedTest === 'cooper_12min' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                        <Info size={14} className="inline mr-1 text-blue-400" />
                        Run as far as you can in exactly 12 minutes. Use a track or GPS watch.
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Distance (meters)</label>
                        <input
                          type="number"
                          value={cooperDistance}
                          onChange={(e) => setCooperDistance(e.target.value)}
                          placeholder="e.g., 2400"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                        <p className="text-xs text-white/40 mt-1">
                          1 lap = 400m. Good: 2000m+, Excellent: 2800m+
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1.5 Mile Run */}
                  {selectedTest === '1.5_mile_run' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                        <Info size={14} className="inline mr-1 text-blue-400" />
                        Run 1.5 miles (2.4km or 6 laps) as fast as possible.
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Minutes</label>
                          <input
                            type="number"
                            value={mileTime.minutes}
                            onChange={(e) => setMileTime(prev => ({ ...prev, minutes: e.target.value }))}
                            placeholder="12"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Seconds</label>
                          <input
                            type="number"
                            value={mileTime.seconds}
                            onChange={(e) => setMileTime(prev => ({ ...prev, seconds: e.target.value }))}
                            placeholder="30"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rockport Walk Test */}
                  {selectedTest === 'rockport_walk' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                        <Info size={14} className="inline mr-1 text-blue-400" />
                        Walk 1 mile as fast as possible. Record your time and ending heart rate.
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Walk time (minutes)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={walkData.time}
                          onChange={(e) => setWalkData(prev => ({ ...prev, time: e.target.value }))}
                          placeholder="e.g., 14.5"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Final heart rate (bpm)</label>
                        <input
                          type="number"
                          value={walkData.hr}
                          onChange={(e) => setWalkData(prev => ({ ...prev, hr: e.target.value }))}
                          placeholder="e.g., 140"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Body weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          placeholder="e.g., 75"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step Test */}
                  {selectedTest === 'step_test' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                        <Info size={14} className="inline mr-1 text-blue-400" />
                        Step up and down on a 12" step for 3 minutes at 24 steps/min.
                        Wait 1 minute, then measure your heart rate.
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">
                          Recovery heart rate (1 min after)
                        </label>
                        <input
                          type="number"
                          value={stepHR}
                          onChange={(e) => setStepHR(e.target.value)}
                          placeholder="e.g., 100"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Lab Result */}
                  {selectedTest === 'lab' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-500/10 rounded-lg text-sm text-white/70">
                        <Info size={14} className="inline mr-1 text-green-400" />
                        Enter the VO2max value from your lab test report.
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">VO2max (ml/kg/min)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={labResult}
                          onChange={(e) => setLabResult(e.target.value)}
                          placeholder="e.g., 45.2"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={testNotes}
                      onChange={(e) => setTestNotes(e.target.value)}
                      placeholder="Conditions, how you felt, etc."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Estimate preview */}
                  {estimate && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <p className="text-sm text-green-400 mb-1">Estimated VO2max</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{estimate}</span>
                        <span className="text-white/50">ml/kg/min</span>
                      </div>
                      {estimatePercentile && (
                        <p className="text-sm text-white/60 mt-1">
                          {estimatePercentile.percentile}th percentile ({estimatePercentile.classification})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Targets Tab */}
          {activeTab === 'targets' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 rounded-lg text-sm text-white/70">
                <Target size={14} className="inline mr-1 text-amber-400" />
                Peter Attia recommends training to be in the top 10% for your age at 80.
                This dramatically reduces mortality risk.
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60">To be 90th percentile at 80</span>
                    <span className="text-xl font-bold text-green-400">{targetAt80}</span>
                  </div>
                  <p className="text-xs text-white/40">
                    Target VO2max needed now, assuming 0.5%/year decline with training
                  </p>
                  {currentVO2max && (
                    <div className="mt-2 text-sm">
                      {currentVO2max >= targetAt80 ? (
                        <span className="text-green-400">
                          You're on track! (+{(currentVO2max - targetAt80).toFixed(1)} above target)
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          Need +{(targetAt80 - currentVO2max).toFixed(1)} to reach target
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/60">To be 90th percentile at 90</span>
                    <span className="text-xl font-bold text-blue-400">{targetAt90}</span>
                  </div>
                  <p className="text-xs text-white/40">
                    More ambitious target for longevity at 90
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-lg text-sm">
                <p className="font-medium mb-2">How to improve VO2max:</p>
                <ul className="text-white/60 space-y-1 text-xs">
                  <li>• Zone 2 training (70-80% max HR) - 3-4x/week, 45-90 min</li>
                  <li>• High-intensity intervals - 1-2x/week</li>
                  <li>• Consistency over intensity for long-term gains</li>
                  <li>• Expect 5-15% improvement in 3-6 months</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'new_test' && selectedTest && (
          <div className="p-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!estimate || isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Save Result
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
