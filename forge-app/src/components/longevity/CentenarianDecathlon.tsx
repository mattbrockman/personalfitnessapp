'use client'

import { useState } from 'react'
import {
  Trophy,
  Plus,
  ChevronRight,
  CheckCircle2,
  Circle,
  Target,
  Info,
  Loader2,
  X,
  Edit2,
} from 'lucide-react'
import { CentenarianGoal, GoalCategory, DEFAULT_CENTENARIAN_GOALS } from '@/types/longevity'

interface CentenarianDecathlonProps {
  goals: CentenarianGoal[]
  onRefresh?: () => void
}

const CATEGORY_ICONS: Record<GoalCategory, string> = {
  strength: '💪',
  cardio: '🫀',
  mobility: '🧘',
  balance: '⚖️',
  functional: '🏃',
  cognitive: '🧠',
}

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  strength: 'bg-red-500/20 text-red-400',
  cardio: 'bg-pink-500/20 text-pink-400',
  mobility: 'bg-purple-500/20 text-purple-400',
  balance: 'bg-blue-500/20 text-blue-400',
  functional: 'bg-green-500/20 text-green-400',
  cognitive: 'bg-amber-500/20 text-amber-400',
}

export function CentenarianDecathlon({
  goals,
  onRefresh,
}: CentenarianDecathlonProps) {
  const [showInfo, setShowInfo] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [editingScore, setEditingScore] = useState<string | null>(null)
  const [tempScore, setTempScore] = useState<number>(5)

  const achievedCount = goals.filter(g => g.is_achieved).length
  const onTrackCount = goals.filter(g => !g.is_achieved && (g.current_score || 0) >= 6).length

  const handleInitializeDefaults = async () => {
    if (goals.length > 0) {
      if (!confirm('This will add the default Centenarian Decathlon goals. Continue?')) {
        return
      }
    }

    setIsInitializing(true)
    try {
      const response = await fetch('/api/centenarian-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize_defaults' }),
      })

      if (!response.ok) throw new Error('Failed to initialize')

      onRefresh?.()
    } catch (error) {
      console.error('Error initializing goals:', error)
      alert('Failed to initialize goals. You may already have goals set up.')
    } finally {
      setIsInitializing(false)
    }
  }

  const handleUpdateScore = async (goalId: string, score: number) => {
    try {
      await fetch('/api/centenarian-goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goalId,
          current_score: score,
          last_tested_date: new Date().toISOString().split('T')[0],
        }),
      })
      setEditingScore(null)
      onRefresh?.()
    } catch (error) {
      console.error('Error updating score:', error)
    }
  }

  const handleToggleAchieved = async (goalId: string, currentlyAchieved: boolean) => {
    try {
      await fetch('/api/centenarian-goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goalId,
          is_achieved: !currentlyAchieved,
        }),
      })
      onRefresh?.()
    } catch (error) {
      console.error('Error updating goal:', error)
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Trophy size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-medium">Centenarian Decathlon</h3>
            <p className="text-xs text-tertiary">
              {achievedCount} achieved • {onTrackCount} on track
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1 hover:bg-white/10 rounded-lg"
        >
          <Info size={16} className="text-secondary" />
        </button>
      </div>

      {/* Info tooltip */}
      {showInfo && (
        <div className="mb-4 p-3 bg-amber-500/10 rounded-lg text-xs text-white/70">
          <p className="font-medium text-amber-400 mb-1">Peter Attia's Centenarian Decathlon</p>
          <p>
            Define 10 physical tasks you want to be able to do at age 100.
            Work backwards to determine the fitness you need now to achieve those goals,
            accounting for normal age-related decline.
          </p>
        </div>
      )}

      {/* Progress bar */}
      {goals.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-tertiary mb-1">
            <span>{achievedCount} / {goals.length} goals achieved</span>
            <span>{Math.round((achievedCount / goals.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full transition-all"
              style={{ width: `${(achievedCount / goals.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white/5 rounded-lg overflow-hidden">
              {/* Goal header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleAchieved(goal.id, goal.is_achieved)
                  }}
                  className="shrink-0"
                >
                  {goal.is_achieved ? (
                    <CheckCircle2 size={20} className="text-green-400" />
                  ) : (
                    <Circle size={20} className="text-muted" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{CATEGORY_ICONS[goal.category]}</span>
                    <span className={`text-sm font-medium ${goal.is_achieved ? 'line-through text-tertiary' : ''}`}>
                      {goal.goal_name}
                    </span>
                  </div>
                </div>

                {/* Score indicator */}
                {!goal.is_achieved && goal.current_score && (
                  <div className="flex items-center gap-1">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-3 rounded-full ${
                          i < goal.current_score! ? 'bg-amber-400' : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                )}

                <ChevronRight
                  size={16}
                  className={`text-muted transition-transform ${
                    expandedGoal === goal.id ? 'rotate-90' : ''
                  }`}
                />
              </div>

              {/* Expanded details */}
              {expandedGoal === goal.id && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5">
                  <p className="text-sm text-white/60 mb-3">{goal.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-white/5 rounded">
                      <span className="text-secondary">Target Age</span>
                      <p className="font-medium">{goal.target_age}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded">
                      <span className="text-secondary">Category</span>
                      <p className={`font-medium px-1.5 py-0.5 rounded inline-block ${CATEGORY_COLORS[goal.category]}`}>
                        {goal.category}
                      </p>
                    </div>
                  </div>

                  {goal.required_strength && (
                    <p className="text-xs text-tertiary mb-1">
                      <strong className="text-red-400">Strength:</strong> {goal.required_strength}
                    </p>
                  )}
                  {goal.required_cardio && (
                    <p className="text-xs text-tertiary mb-1">
                      <strong className="text-pink-400">Cardio:</strong> {goal.required_cardio}
                    </p>
                  )}
                  {goal.required_mobility && (
                    <p className="text-xs text-tertiary mb-1">
                      <strong className="text-purple-400">Mobility:</strong> {goal.required_mobility}
                    </p>
                  )}

                  {/* Score editor */}
                  {!goal.is_achieved && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {editingScore === goal.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={tempScore}
                            onChange={(e) => setTempScore(parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-6">{tempScore}</span>
                          <button
                            onClick={() => handleUpdateScore(goal.id, tempScore)}
                            className="p-1 bg-green-500/20 text-green-400 rounded"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => setEditingScore(null)}
                            className="p-1 bg-white/10 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setTempScore(goal.current_score || 5)
                            setEditingScore(goal.id)
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          Update self-assessment (current: {goal.current_score || 'not set'}/10)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Trophy size={32} className="mx-auto mb-2 text-white/20" />
          <p className="text-tertiary text-sm mb-3">No goals defined yet</p>
          <button
            onClick={handleInitializeDefaults}
            disabled={isInitializing}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {isInitializing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Target size={14} />
                Initialize Default Goals
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
