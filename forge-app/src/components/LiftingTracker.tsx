'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Dumbbell,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  GripVertical,
  X,
  Save,
  Trash2,
  ChevronRight,
  Flame,
  Target,
  Video,
  StopCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  Camera,
  Zap,
  TrendingUp,
  ArrowLeftRight,
} from 'lucide-react'

// Strength training imports (Greg Nuckols evidence-based methods)
import { RelativeIntensityBadge } from '@/components/strength/RelativeIntensityBadge'
import { EffectiveRepsDisplay } from '@/components/strength/EffectiveRepsDisplay'
import { ProgressionSuggestionInline } from '@/components/strength/ProgressionSuggestionCard'
import { calculate1RM, calculateEffectiveReps, calculateRelativeIntensity } from '@/lib/strength-calculations'

// Types
interface Exercise {
  id: string
  name: string
  primary_muscle: string
  equipment: string
  cues?: string[]
}

interface SetData {
  id: string
  set_number: number
  set_type: 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap'
  target_reps: number | null
  target_weight: number | null
  target_rir: string | null // RIR: 0-5 or 'some', 'few', 'many'
  actual_reps: number | null
  actual_weight: number | null
  actual_rir: string | null
  completed: boolean
}

interface PreviousSetData {
  weight: number
  reps: number
  date: string
}

interface WorkoutExercise {
  id: string
  exercise: Exercise
  superset_group: string | null // 'A', 'B', 'C' etc
  rest_seconds: number
  notes: string
  sets: SetData[]
  collapsed: boolean
}

interface LiftingTrackerProps {
  initialExercises?: WorkoutExercise[]
  initialName?: string
  plannedWorkoutId?: string | null
  onFinish?: () => void
  onCancel?: () => void
}

// Constants
const SET_TYPES = [
  { value: 'warmup', label: 'Warm-up', color: 'text-blue-400' },
  { value: 'working', label: 'Working', color: 'text-white' },
  { value: 'dropset', label: 'Drop Set', color: 'text-orange-400' },
  { value: 'failure', label: 'To Failure', color: 'text-red-400' },
  { value: 'amrap', label: 'AMRAP', color: 'text-purple-400' },
]

// RIR (Reps in Reserve) options: 0-5 plus qualitative
const RIR_OPTIONS = ['0', '1', '2', '3', '4', '5', 'few', 'some', 'many']

// Rest Timer Component
function RestTimer({ 
  seconds, 
  onComplete,
  onSkip 
}: { 
  seconds: number
  onComplete: () => void
  onSkip: () => void 
}) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0) onComplete()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(t => t - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, timeLeft, onComplete])

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((seconds - timeLeft) / seconds) * 100

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 glass-strong rounded-2xl p-4 flex items-center gap-4 z-30 animate-slide-up">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="4"
            strokeDasharray={`${progress * 1.76} 176`}
            className="transition-all duration-1000"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-mono font-bold">
          {formatTime(timeLeft)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={() => setTimeLeft(t => t + 30)}
          className="px-3 py-1.5 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
        >
          +30s
        </button>
        <button
          onClick={onSkip}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60"
        >
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  )
}

// Exercise Search Modal
function ExerciseSearchModal({
  onSelect,
  onClose,
  title,
  subtitle,
}: {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
  title?: string
  subtitle?: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchExercises()
  }, [])

  useEffect(() => {
    fetchExercises()
  }, [search, filter])

  const fetchExercises = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter) params.set('muscle_group', filter)
      params.set('limit', '50')

      const res = await fetch(`/api/exercises?${params}`)
      const data = await res.json()
      setExercises(data.exercises || [])

      // Extract unique muscle groups from exercises
      if (muscleGroups.length === 0 && data.exercises) {
        const groups = new Set<string>()
        data.exercises.forEach((ex: Exercise) => {
          if (ex.primary_muscle) groups.add(ex.primary_muscle)
        })
        setMuscleGroups(Array.from(groups).sort())
      }
    } catch (error) {
      console.error('Failed to fetch exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Search exercises"}
      >
        {/* Optional title header for swap mode */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-violet-500/10">
            <div>
              <h2 className="font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>
        )}

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter(null)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                !filter ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              All
            </button>
            {muscleGroups.map(muscle => (
              <button
                key={muscle}
                onClick={() => setFilter(muscle)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap capitalize transition-colors ${
                  filter === muscle ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {muscle}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="p-8 text-center text-white/40">Loading exercises...</div>
          ) : exercises.length > 0 ? (
            exercises.map(exercise => (
              <button
                key={exercise.id}
                onClick={() => {
                  onSelect(exercise)
                  onClose()
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Dumbbell size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{exercise.name}</p>
                  <p className="text-sm text-white/50 capitalize">{exercise.primary_muscle?.replace('_', ' ')} • {exercise.equipment}</p>
                </div>
                <ChevronRight size={18} className="text-white/30" />
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-white/40">
              No exercises found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Single Set Row
function SetRow({
  set,
  exerciseName,
  previousSet,
  onUpdate,
  onComplete,
  onDelete,
}: {
  set: SetData
  exerciseName: string
  previousSet?: PreviousSetData
  onUpdate: (updates: Partial<SetData>) => void
  onComplete: () => void
  onDelete: () => void
}) {
  const setType = SET_TYPES.find(t => t.value === set.set_type)

  // Format date for previous set display
  const formatPrevDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className={`flex items-center gap-2 py-2 ${set.completed ? 'opacity-60' : ''}`}>
      {/* Set number/type */}
      <div className="w-10 text-center">
        <span className={`text-sm font-medium ${setType?.color || 'text-white'}`}>
          {set.set_type === 'warmup' ? 'W' : set.set_number}
        </span>
      </div>

      {/* Previous (reference) - shows lbs x reps with date */}
      <div className="w-20 text-center">
        {previousSet ? (
          <div className="text-xs">
            <span className="text-white/60 font-medium">{previousSet.weight}×{previousSet.reps}</span>
            <div className="text-white/30 text-[10px]">{formatPrevDate(previousSet.date)}</div>
          </div>
        ) : (
          <span className="text-white/30 text-sm">—</span>
        )}
      </div>

      {/* Weight input - prefilled with target */}
      <div className="w-16">
        <input
          type="number"
          value={set.actual_weight ?? set.target_weight ?? ''}
          onChange={e => onUpdate({ actual_weight: e.target.value ? Number(e.target.value) : null })}
          placeholder="lbs"
          className={`w-full border rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50 ${
            set.completed
              ? 'bg-emerald-500/20 border-emerald-500/30'
              : 'bg-white/10 border-white/20'
          }`}
        />
      </div>

      <span className="text-white/30 text-sm">×</span>

      {/* Reps input - prefilled with target */}
      <div className="w-14">
        <input
          type="number"
          value={set.actual_reps ?? set.target_reps ?? ''}
          onChange={e => onUpdate({ actual_reps: e.target.value ? Number(e.target.value) : null })}
          placeholder="reps"
          className={`w-full border rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50 ${
            set.completed
              ? 'bg-emerald-500/20 border-emerald-500/30'
              : 'bg-white/10 border-white/20'
          }`}
        />
      </div>

      {/* RIR selector */}
      <select
        value={set.actual_rir ?? ''}
        onChange={e => onUpdate({ actual_rir: e.target.value || null })}
        className={`w-14 border rounded px-1 py-1.5 text-center text-xs focus:outline-none focus:border-amber-500/50 ${
          set.completed
            ? 'bg-emerald-500/20 border-emerald-500/30'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <option value="">RIR</option>
        {RIR_OPTIONS.map(rir => (
          <option key={rir} value={rir}>{rir}</option>
        ))}
      </select>

      {/* Complete button */}
      <button
        onClick={onComplete}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          set.completed
            ? 'bg-emerald-500 text-white'
            : 'bg-white/10 text-white/60 hover:bg-amber-500 hover:text-black'
        }`}
      >
        <Check size={16} />
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// Superset groups
const SUPERSET_GROUPS = ['A', 'B', 'C', 'D', 'E']

// Exercise Detail Modal - shows info, history, PRs
function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: Exercise
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'about' | 'history' | 'records'>('about')
  const [history, setHistory] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (exercise.id) {
          params.set('exercise_id', exercise.id)
        } else if (exercise.name) {
          params.set('exercise_name', exercise.name)
        }
        params.set('limit', '20')

        const res = await fetch(`/api/exercise-history?${params}`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.history || [])
          setStats(data.stats || null)
        }
      } catch (error) {
        console.error('Failed to fetch exercise history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [exercise.id, exercise.name])

  // Use stats from API for best performances
  const bestPerformances = stats?.best_by_reps || {}

  // Use 1RM trend from API
  const e1rmHistory = stats?.one_rm_trend || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Dumbbell size={24} className="text-violet-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{exercise.name}</h3>
              <p className="text-sm text-white/50 capitalize">
                {exercise.primary_muscle?.replace('_', ' ')} • {exercise.equipment}
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-2 mt-4">
            {(['about', 'history', 'records'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              {/* Exercise demonstration GIF/Image */}
              {(exercise.video_url || exercise.thumbnail_url) ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  <img
                    src={exercise.video_url || exercise.thumbnail_url}
                    alt={`${exercise.name} demonstration`}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      // Try thumbnail as fallback, or hide if both fail
                      const img = e.target as HTMLImageElement
                      if (exercise.video_url && exercise.thumbnail_url && img.src === exercise.video_url) {
                        img.src = exercise.thumbnail_url
                      } else {
                        img.style.display = 'none'
                      }
                    }}
                  />
                  {/* Show badge if it's a static image vs animated GIF */}
                  {!exercise.video_url && exercise.thumbnail_url && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/60">
                      Static image
                    </span>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                  <div className="text-center text-white/40">
                    <Dumbbell size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Exercise demonstration</p>
                    <p className="text-xs text-white/30 mt-1">No image available</p>
                  </div>
                </div>
              )}

              {/* Coaching Cues */}
              {exercise.cues && exercise.cues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Coaching Cues</h4>
                  <ul className="space-y-2">
                    {exercise.cues.map((cue, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="text-amber-500 mt-1">•</span>
                        {cue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Primary/Secondary Muscles */}
              <div className="flex gap-4">
                <div>
                  <h4 className="text-sm font-medium text-white/40 mb-1">Primary</h4>
                  <span className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-sm capitalize">
                    {exercise.primary_muscle?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              {loading ? (
                <div className="text-center py-8 text-white/40">Loading history...</div>
              ) : history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((session, i) => (
                    <div key={i} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-white/60">
                          {new Date(session.workout_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        {session.best_estimated_1rm && (
                          <span className="text-xs text-amber-400">e1RM: {session.best_estimated_1rm}lbs</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {session.sets?.filter((s: any) => s.completed).map((set: any, j: number) => (
                          <div key={j} className="flex items-center gap-2 text-sm">
                            <span className="w-6 text-white/40">{set.set_number}</span>
                            <span className="font-medium">
                              {set.actual_weight_lbs || set.actual_weight}lbs × {set.actual_reps}
                            </span>
                            {(set.actual_rpe || set.actual_rir) && (
                              <span className="text-white/40">
                                {set.actual_rir ? `RIR ${set.actual_rir}` : `RPE ${set.actual_rpe}`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock size={32} className="mx-auto text-white/20 mb-2" />
                  <p className="text-white/40">No history yet</p>
                  <p className="text-sm text-white/30 mt-1">Complete sets to build your history</p>
                </div>
              )}
            </div>
          )}

          {/* Records Tab */}
          {activeTab === 'records' && (
            <div>
              {/* Summary Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-lg font-bold text-amber-400">{stats.total_sessions}</p>
                    <p className="text-xs text-white/50">Sessions</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-lg font-bold text-amber-400">{stats.total_sets}</p>
                    <p className="text-xs text-white/50">Total Sets</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg text-center">
                    <p className="text-lg font-bold text-amber-400">
                      {stats.total_volume_lbs >= 1000
                        ? `${(stats.total_volume_lbs / 1000).toFixed(1)}k`
                        : stats.total_volume_lbs}
                    </p>
                    <p className="text-xs text-white/50">Volume (lbs)</p>
                  </div>
                </div>
              )}

              {/* Estimated 1RM */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-amber-400">Estimated 1RM Trend</h4>
                  {stats?.estimated_1rm_pr && (
                    <span className="text-sm text-white/60">PR: <span className="font-bold text-amber-400">{stats.estimated_1rm_pr}lbs</span></span>
                  )}
                </div>
                {e1rmHistory.length > 0 ? (
                  <div className="h-32 bg-white/5 rounded-lg p-3">
                    {/* Simple bar chart representation */}
                    <div className="flex items-end justify-between h-full gap-1">
                      {e1rmHistory.slice(-10).map((item: any, i: number) => {
                        const max = Math.max(...e1rmHistory.map((h: any) => h.estimated1RM))
                        const height = (item.estimated1RM / max) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full bg-amber-500/50 rounded-t hover:bg-amber-500/70 transition-colors cursor-default"
                              style={{ height: `${height}%` }}
                              title={`${item.estimated1RM}lbs on ${new Date(item.date).toLocaleDateString()}`}
                            />
                            <span className="text-[10px] text-white/30">{item.estimated1RM}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-white/5 rounded-lg flex items-center justify-center text-white/30 text-sm">
                    Not enough data
                  </div>
                )}
              </div>

              {/* Best Performances by Rep Range */}
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-3">Best Performances by Rep Range</h4>
                {Object.keys(bestPerformances).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(bestPerformances)
                      .sort(([a], [b]) => {
                        // Sort by rep number (extract number from "5RM" format)
                        const numA = parseInt(a.replace('RM', ''))
                        const numB = parseInt(b.replace('RM', ''))
                        return numA - numB
                      })
                      .map(([repKey, data]) => {
                        const reps = repKey.replace('RM', '')
                        return (
                          <div key={repKey} className="p-3 bg-white/5 rounded-lg">
                            <p className="text-lg font-bold">{(data as any).weight}lbs</p>
                            <p className="text-sm text-white/50">{reps} rep{reps !== '1' ? 's' : ''}</p>
                            <p className="text-xs text-white/30">
                              {new Date((data as any).date).toLocaleDateString()}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-white/30 text-sm">
                    No records yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// AI Form Coaching Modal - record and get AI feedback on exercise form
function FormCoachingModal({
  exercise,
  onClose,
}: {
  exercise: Exercise
  onClose: () => void
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [feedback, setFeedback] = useState<{
    overall_score: number
    form_issues: string[]
    positive_points: string[]
    recommendations: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setVideoBlob(blob)
        setVideoUrl(URL.createObjectURL(blob))

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Could not access camera. Please allow camera permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const analyzeForm = async () => {
    if (!videoBlob) return

    setAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', videoBlob, 'form-check.webm')
      formData.append('exercise_name', exercise.name)
      formData.append('exercise_id', exercise.id || '')

      const res = await fetch('/api/form-coaching', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Failed to analyze form')
      }

      const data = await res.json()
      setFeedback(data.feedback)
    } catch (err) {
      console.error('Form analysis error:', err)
      setError('Failed to analyze your form. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setVideoBlob(null)
    setVideoUrl(null)
    setFeedback(null)
    setError(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [videoUrl, isRecording])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Camera size={20} className="text-amber-400" />
              AI Form Coach
            </h3>
            <p className="text-sm text-white/50">{exercise.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Video preview / Recording */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4 relative">
            {!videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {!isRecording && !videoRef.current?.srcObject && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/40">
                    <div className="text-center">
                      <Video size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Position yourself in frame</p>
                      <p className="text-xs text-white/30 mt-1">Then click record</p>
                    </div>
                  </div>
                )}
                {isRecording && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500/90 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-sm font-medium">Recording</span>
                  </div>
                )}
              </>
            ) : (
              <video
                src={videoUrl}
                className="w-full h-full object-cover"
                controls
                playsInline
              />
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Controls */}
          {!videoUrl && !feedback && (
            <div className="flex gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Video size={18} />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex-1 py-3 bg-white text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <StopCircle size={18} />
                  Stop Recording
                </button>
              )}
            </div>
          )}

          {/* Video recorded - analyze or retry */}
          {videoUrl && !feedback && (
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
              >
                Record Again
              </button>
              <button
                onClick={analyzeForm}
                disabled={analyzing}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Analyze Form
                  </>
                )}
              </button>
            </div>
          )}

          {/* Feedback display */}
          {feedback && (
            <div className="space-y-4">
              {/* Score */}
              <div className="flex items-center justify-center gap-4 p-4 bg-white/5 rounded-xl">
                <div className="text-center">
                  <p className="text-4xl font-bold text-amber-400">{feedback.overall_score}</p>
                  <p className="text-sm text-white/50">Form Score</p>
                </div>
                <div className="text-xs text-white/40 text-left">
                  <p>100 = Perfect form</p>
                  <p>80+ = Good form</p>
                  <p>60+ = Needs work</p>
                </div>
              </div>

              {/* Positive points */}
              {feedback.positive_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                    <CheckCircle size={14} />
                    What you did well
                  </h4>
                  <ul className="space-y-1">
                    {feedback.positive_points.map((point, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Issues */}
              {feedback.form_issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-orange-400 mb-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Areas to improve
                  </h4>
                  <ul className="space-y-1">
                    {feedback.form_issues.map((issue, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {feedback.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {feedback.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Try again button */}
              <button
                onClick={reset}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors mt-4"
              >
                Record Another Rep
              </button>
            </div>
          )}

          {/* Instructions */}
          {!videoUrl && !isRecording && !feedback && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 font-medium mb-1">Tips for best results:</p>
              <ul className="text-xs text-white/60 space-y-1">
                <li>• Position your full body in frame</li>
                <li>• Use good lighting</li>
                <li>• Record from the side for most exercises</li>
                <li>• Record 1-3 reps for analysis</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Exercise Card
function ExerciseCard({
  workoutExercise,
  index,
  previousSetData,
  onUpdate,
  onRemove,
  onSetComplete,
  onShowDetails,
  onFormCoach,
  onSwapExercise,
}: {
  workoutExercise: WorkoutExercise
  index: number
  previousSetData?: Record<number, PreviousSetData> // set_number -> previous data
  onUpdate: (updates: Partial<WorkoutExercise>) => void
  onRemove: () => void
  onSetComplete: (setId: string) => void
  onShowDetails: () => void
  onFormCoach: () => void
  onSwapExercise: () => void
}) {
  const { exercise, sets, collapsed, superset_group, rest_seconds, notes } = workoutExercise
  const completedSets = sets.filter(s => s.completed).length

  const addSet = () => {
    const lastSet = sets[sets.length - 1]
    const newSet: SetData = {
      id: `set-${Date.now()}`,
      set_number: sets.filter(s => s.set_type !== 'warmup').length + 1,
      set_type: 'working',
      target_reps: lastSet?.target_reps ?? 10,
      target_weight: lastSet?.target_weight ?? null,
      target_rir: null,
      actual_reps: null,
      actual_weight: null,
      actual_rir: null,
      completed: false,
    }
    onUpdate({ sets: [...sets, newSet] })
  }

  const updateSet = (setId: string, updates: Partial<SetData>) => {
    onUpdate({
      sets: sets.map(s => s.id === setId ? { ...s, ...updates } : s)
    })
  }

  const deleteSet = (setId: string) => {
    // Re-number remaining sets
    const filtered = sets.filter(s => s.id !== setId)
    let workingSetNum = 1
    const renumbered = filtered.map(s => {
      if (s.set_type === 'warmup') return s
      return { ...s, set_number: workingSetNum++ }
    })
    onUpdate({ sets: renumbered })
  }

  // Toggle superset group
  const toggleSuperset = (group: string) => {
    onUpdate({
      superset_group: superset_group === group ? null : group
    })
  }

  return (
    <div className={`glass rounded-xl overflow-hidden ${superset_group ? 'ring-2 ring-amber-500/30' : ''}`}>
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => onUpdate({ collapsed: !collapsed })}
      >
        <button className="text-white/30 hover:text-white cursor-grab" onClick={e => e.stopPropagation()}>
          <GripVertical size={18} />
        </button>

        {superset_group && (
          <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded">
            {superset_group}
          </span>
        )}

        <div
          className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center cursor-pointer hover:bg-violet-500/30 transition-colors"
          onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
        >
          <Dumbbell size={18} className="text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3
              className="font-medium truncate cursor-pointer hover:text-amber-400 transition-colors"
              onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
            >
              {exercise.name}
            </h3>
            {/* Swap Exercise button */}
            <button
              onClick={(e) => { e.stopPropagation(); onSwapExercise(); }}
              className="p-1 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
              title="Swap Exercise"
              aria-label="Swap exercise for alternative"
            >
              <ArrowLeftRight size={12} />
            </button>
            {/* AI Form Coach button */}
            <button
              onClick={(e) => { e.stopPropagation(); onFormCoach(); }}
              className="p-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
              title="AI Form Coach"
              aria-label="AI Form Coach"
            >
              <Camera size={12} />
            </button>
          </div>
          <p className="text-sm text-white/50">
            {completedSets}/{sets.length} sets • {rest_seconds}s rest
          </p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-white/30 hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>

        {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </div>

      {/* Sets (collapsible) */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Cues */}
          {exercise.cues && exercise.cues.length > 0 && (
            <div className="mb-3 p-2 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-amber-400 font-medium mb-1">Cues</p>
              <p className="text-xs text-white/60">
                {exercise.cues.join(' • ')}
              </p>
            </div>
          )}

          {/* Rest timer + Superset controls */}
          <div className="flex items-center gap-4 mb-3 p-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-white/40" />
              <span className="text-xs text-white/40">Rest:</span>
              <select
                value={rest_seconds}
                onChange={(e) => onUpdate({ rest_seconds: Number(e.target.value) })}
                onClick={e => e.stopPropagation()}
                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500/50"
              >
                <option value={30}>30s</option>
                <option value={45}>45s</option>
                <option value={60}>60s</option>
                <option value={90}>90s</option>
                <option value={120}>2m</option>
                <option value={150}>2.5m</option>
                <option value={180}>3m</option>
                <option value={240}>4m</option>
                <option value={300}>5m</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Superset:</span>
              <div className="flex gap-1">
                {SUPERSET_GROUPS.map(group => (
                  <button
                    key={group}
                    onClick={(e) => { e.stopPropagation(); toggleSuperset(group); }}
                    className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                      superset_group === group
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/40 hover:bg-white/20'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Header row */}
          <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2 px-1 uppercase tracking-wide">
            <div className="w-10 text-center">Set</div>
            <div className="w-20 text-center">Prev</div>
            <div className="w-16 text-center">Lbs</div>
            <div className="w-4"></div>
            <div className="w-14 text-center">Reps</div>
            <div className="w-14 text-center">RIR</div>
            <div className="w-8"></div>
            <div className="w-8"></div>
          </div>

          {/* Sets */}
          {sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              exerciseName={exercise.name}
              previousSet={previousSetData?.[set.set_number]}
              onUpdate={(updates) => updateSet(set.id, updates)}
              onComplete={() => onSetComplete(set.id)}
              onDelete={() => deleteSet(set.id)}
            />
          ))}

          {/* Add set button */}
          <button
            onClick={addSet}
            className="w-full mt-2 py-2 border border-dashed border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Set
          </button>

          {/* Notes */}
          <div className="mt-3">
            <textarea
              value={notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Notes for this exercise..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Main Lifting Tracker
export function LiftingTracker({
  initialExercises = [],
  initialName = '',
  plannedWorkoutId,
  onFinish,
  onCancel,
}: LiftingTrackerProps) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>(initialExercises)
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  const [restTimer, setRestTimer] = useState<{ show: boolean; seconds: number } | null>(null)
  const [workoutStartTime] = useState(new Date())
  const [workoutName, setWorkoutName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<Exercise | null>(null)
  const [selectedExerciseForFormCoach, setSelectedExerciseForFormCoach] = useState<Exercise | null>(null)
  const [exerciseToSwap, setExerciseToSwap] = useState<{ workoutExerciseId: string; exercise: Exercise } | null>(null)

  // Swap an exercise for a new one, keeping the sets
  const swapExercise = (newExercise: Exercise) => {
    if (!exerciseToSwap) return
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseToSwap.workoutExerciseId) {
        return { ...ex, exercise: newExercise }
      }
      return ex
    }))
    setExerciseToSwap(null)
  }

  const addExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exercise,
      superset_group: null,
      rest_seconds: 90,
      notes: '',
      collapsed: false,
      sets: [
        {
          id: `set-${Date.now()}`,
          set_number: 1,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
        },
        {
          id: `set-${Date.now() + 1}`,
          set_number: 2,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
        },
        {
          id: `set-${Date.now() + 2}`,
          set_number: 3,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
        },
      ],
    }
    setExercises(prev => [...prev, newExercise])
  }

  const updateExercise = (id: string, updates: Partial<WorkoutExercise>) => {
    setExercises(prev => prev.map(ex => 
      ex.id === id ? { ...ex, ...updates } : ex
    ))
  }

  const removeExercise = (id: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== id))
  }

  const handleSetComplete = (exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex
      
      const updatedSets = ex.sets.map(s => {
        if (s.id !== setId) return s
        
        // If completing, auto-fill actuals from targets if empty
        if (!s.completed) {
          return {
            ...s,
            completed: true,
            actual_reps: s.actual_reps ?? s.target_reps,
            actual_weight: s.actual_weight ?? s.target_weight,
          }
        }
        // If uncompleting
        return { ...s, completed: false }
      })

      return { ...ex, sets: updatedSets }
    }))

    // Start rest timer
    const exercise = exercises.find(ex => ex.id === exerciseId)
    if (exercise) {
      setRestTimer({ show: true, seconds: exercise.rest_seconds })
    }
  }

  // Calculate workout stats
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0)
  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((setSum, set) => {
      if (set.completed && set.actual_weight && set.actual_reps) {
        return setSum + (set.actual_weight * set.actual_reps)
      }
      return setSum
    }, 0)
  }, 0)

  const elapsedMinutes = Math.floor((Date.now() - workoutStartTime.getTime()) / 60000)

  // Handle finishing and saving the workout
  const handleFinishWorkout = async () => {
    if (completedSets === 0) return

    setSaving(true)
    try {
      const exercisesPayload = exercises.map((ex, index) => ({
        exercise_id: ex.exercise.id,
        order_index: index,
        superset_group: ex.superset_group,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        sets: ex.sets.map((set, setIndex) => ({
          set_type: set.set_type,
          target_reps: set.target_reps,
          target_weight: set.target_weight,
          target_rir: set.target_rir,
          actual_reps: set.actual_reps,
          actual_weight: set.actual_weight,
          actual_rir: set.actual_rir,
          completed: set.completed,
        })),
      }))

      // If this workout was started from a planned workout, mark that as completed
      if (plannedWorkoutId) {
        const patchRes = await fetch(`/api/workouts/${plannedWorkoutId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            completed_at: new Date().toISOString(),
            actual_duration_minutes: elapsedMinutes,
          }),
        })

        if (!patchRes.ok) {
          console.error('Failed to update planned workout status')
        }
      }

      // Save the completed workout with all tracking data
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workoutName || 'Lifting Workout',
          workout_type: 'strength',
          category: 'strength',
          scheduled_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration_minutes: elapsedMinutes,
          exercises: exercisesPayload,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save workout')
      }

      // Call onFinish callback if provided
      if (onFinish) {
        onFinish()
      }
    } catch (error) {
      console.error('Failed to save workout:', error)
      alert('Failed to save workout. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/5">
        <input
          type="text"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          placeholder="Workout name..."
          className="text-2xl font-display font-semibold bg-transparent border-none outline-none placeholder-white/30 w-full"
        />
        <p className="text-white/50 mt-1">
          {workoutStartTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Stats bar */}
      <div className="px-4 lg:px-6 py-3 flex items-center gap-6 text-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-white/40" />
          <span>{elapsedMinutes}m</span>
        </div>
        <div className="flex items-center gap-2">
          <Target size={16} className="text-white/40" />
          <span>{completedSets}/{totalSets} sets</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-white/40" />
          <span>{totalVolume.toLocaleString()} lbs</span>
        </div>
      </div>

      {/* Exercises */}
      <div className="p-4 lg:p-6 pb-32 lg:pb-24 space-y-4">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            workoutExercise={ex}
            index={i}
            onUpdate={(updates) => updateExercise(ex.id, updates)}
            onRemove={() => removeExercise(ex.id)}
            onSetComplete={(setId) => handleSetComplete(ex.id, setId)}
            onShowDetails={() => setSelectedExerciseForDetails(ex.exercise)}
            onFormCoach={() => setSelectedExerciseForFormCoach(ex.exercise)}
            onSwapExercise={() => setExerciseToSwap({ workoutExerciseId: ex.id, exercise: ex.exercise })}
          />
        ))}

        {/* Add exercise button */}
        <button
          onClick={() => setShowExerciseSearch(true)}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Add Exercise
        </button>

        {/* Empty state */}
        {exercises.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">No exercises yet</p>
            <p className="text-sm text-white/30 mt-1">Add exercises to start your workout</p>
          </div>
        )}
      </div>

      {/* Bottom action bar - above the bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-20 lg:pb-4 bg-zinc-900/95 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleFinishWorkout}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={completedSets === 0 || saving}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Finish Workout'}
          </button>
        </div>
      </div>

      {/* Rest Timer */}
      {restTimer?.show && (
        <RestTimer
          seconds={restTimer.seconds}
          onComplete={() => setRestTimer(null)}
          onSkip={() => setRestTimer(null)}
        />
      )}

      {/* Exercise Search Modal */}
      {showExerciseSearch && (
        <ExerciseSearchModal
          onSelect={addExercise}
          onClose={() => setShowExerciseSearch(false)}
        />
      )}

      {/* Exercise Detail Modal */}
      {selectedExerciseForDetails && (
        <ExerciseDetailModal
          exercise={selectedExerciseForDetails}
          onClose={() => setSelectedExerciseForDetails(null)}
        />
      )}

      {/* Form Coaching Modal */}
      {selectedExerciseForFormCoach && (
        <FormCoachingModal
          exercise={selectedExerciseForFormCoach}
          onClose={() => setSelectedExerciseForFormCoach(null)}
        />
      )}

      {/* Swap Exercise Modal */}
      {exerciseToSwap && (
        <ExerciseSearchModal
          onSelect={swapExercise}
          onClose={() => setExerciseToSwap(null)}
          title={`Swap "${exerciseToSwap.exercise.name}"`}
          subtitle="Select an alternative exercise"
        />
      )}
    </div>
  )
}
