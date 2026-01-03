'use client'

import { GoalPathway } from '@/types/training-plan'
import { Target, TrendingUp, ArrowRight } from 'lucide-react'

interface GoalPathwayCardProps {
  goalPathway: GoalPathway | null
  className?: string
}

interface GoalMetricProps {
  current: number
  target: number
  realisticEnd?: number
  label?: string
  unit?: string
}

function ProgressBar({ current, target, realisticEnd }: { current: number; target: number; realisticEnd?: number }) {
  const currentPercent = Math.min((current / target) * 100, 100)
  const realisticPercent = realisticEnd ? Math.min((realisticEnd / target) * 100, 100) : null

  return (
    <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
      {/* Current progress */}
      <div
        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
        style={{ width: `${currentPercent}%` }}
      />
      {/* Realistic projection marker */}
      {realisticPercent && realisticPercent > currentPercent && (
        <div
          className="absolute top-0 h-full w-1 bg-green-400 rounded-full opacity-80"
          style={{ left: `${realisticPercent}%` }}
        />
      )}
    </div>
  )
}

function GoalMetric({ current, target, realisticEnd, label, unit = '' }: GoalMetricProps) {
  const percentComplete = Math.round((current / target) * 100)
  const gain = realisticEnd ? realisticEnd - current : target - current

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-tertiary">{label}</p>}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">Current</span>
        <span className="font-medium">{current}{unit}</span>
      </div>
      <ProgressBar current={current} target={target} realisticEnd={realisticEnd} />
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {realisticEnd && (
            <span className="text-green-400 text-xs">
              Realistic: {realisticEnd}{unit}
            </span>
          )}
        </div>
        <span className="text-tertiary">Target: {target}{unit}</span>
      </div>
      {gain > 0 && (
        <div className="text-xs text-center text-amber-400/80">
          +{gain}{unit} to go ({percentComplete}% complete)
        </div>
      )}
    </div>
  )
}

export function GoalPathwayCard({ goalPathway, className = '' }: GoalPathwayCardProps) {
  if (!goalPathway) return null

  // Extract goal entries
  const goals = Object.entries(goalPathway)

  if (goals.length === 0) return null

  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold">Goal Pathway</h3>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {goals.map(([goalKey, goalValue]) => {
          // Handle primary goal structure
          if ('name' in goalValue && goalValue.name) {
            const goal = goalValue as {
              name: string
              current_value: number
              target_value: number
              realistic_end_value?: number
              unit?: string
              breakdown?: Record<string, { current: number; target: number; realistic_end?: number }>
            }

            return (
              <div key={goalKey} className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <h4 className="font-medium">{goal.name}</h4>
                </div>

                <GoalMetric
                  current={goal.current_value}
                  target={goal.target_value}
                  realisticEnd={goal.realistic_end_value}
                  unit={goal.unit ? ` ${goal.unit}` : ''}
                />

                {/* Breakdown */}
                {goal.breakdown && Object.keys(goal.breakdown).length > 0 && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs text-secondary mb-3">Breakdown</p>
                    <div className="grid gap-3">
                      {Object.entries(goal.breakdown).map(([liftKey, liftValue]) => (
                        <div key={liftKey} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium capitalize">{liftKey}</span>
                            <span className="text-xs text-tertiary">
                              {liftValue.current} <ArrowRight className="inline w-3 h-3" /> {liftValue.target}
                            </span>
                          </div>
                          <ProgressBar
                            current={liftValue.current}
                            target={liftValue.target}
                            realisticEnd={liftValue.realistic_end}
                          />
                          {liftValue.realistic_end && (
                            <p className="text-xs text-green-400 mt-1 text-right">
                              Realistic: {liftValue.realistic_end} (+{liftValue.realistic_end - liftValue.current})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          // Handle simple goal breakdown
          if ('current' in goalValue && 'target' in goalValue) {
            const simpleGoal = goalValue as { current: number; target: number; realistic_end?: number }
            return (
              <div key={goalKey}>
                <h4 className="font-medium mb-3 capitalize">{goalKey.replace(/_/g, ' ')}</h4>
                <GoalMetric
                  current={simpleGoal.current}
                  target={simpleGoal.target}
                  realisticEnd={simpleGoal.realistic_end}
                />
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
