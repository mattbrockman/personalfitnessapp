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
  Info,
  MessageSquare,
  MoreVertical,
  Timer,
  StickyNote,
  RefreshCw,
  Link2,
  Settings2,
  Bot,
  Settings,
  Menu,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { openAIChat } from '@/components/AIChatBubble'
import { useDebounce } from '@/hooks/useDebounce'
import { EquipmentIcon, formatEquipmentName } from '@/lib/equipment-icons'
import { useWorkout } from '@/contexts/WorkoutContext'

// Strength training imports (Greg Nuckols evidence-based methods)
import { RelativeIntensityBadge } from '@/components/strength/RelativeIntensityBadge'
import { EffectiveRepsDisplay } from '@/components/strength/EffectiveRepsDisplay'
import { ProgressionSuggestionInline } from '@/components/strength/ProgressionSuggestionCard'
import { calculate1RM, calculateEffectiveReps, calculateRelativeIntensity } from '@/lib/strength-calculations'

// PR Detection and Celebration
import { detectPRs, getMostSignificantPR, formatPRMessage, buildExerciseBests, ExerciseBests, PRResult } from '@/lib/pr-detection'
import { usePRCelebration } from '@/components/PRCelebration'
import { useCelebrationToast } from '@/components/Toast'

// Charts for exercise progress
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Timer sound utility
const playTimerSound = () => {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Play 3 short beeps
    const playBeep = (startTime: number, frequency: number) => {
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.frequency.value = frequency
      osc.type = 'sine'
      gain.gain.value = 0.3
      osc.start(startTime)
      osc.stop(startTime + 0.15)
    }

    const now = audioContext.currentTime
    playBeep(now, 800)
    playBeep(now + 0.2, 800)
    playBeep(now + 0.4, 1000) // Higher pitch on last beep
  } catch (err) {
    console.debug('Audio playback failed:', err)
  }
}

// Set completion sound - satisfying confirmation tone
const playSetCompleteSound = () => {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const now = audioContext.currentTime

    // Play a satisfying "ding" sound - rising tone
    const playTone = (startTime: number, freq: number, duration: number, vol: number) => {
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(vol, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    // Quick satisfying ding
    playTone(now, 880, 0.12, 0.25)
    playTone(now + 0.05, 1320, 0.15, 0.2)
  } catch (err) {
    console.debug('Audio playback failed:', err)
  }
}

// Types
interface Exercise {
  id: string
  name: string
  primary_muscle: string
  equipment: string
  cues?: string[]
  video_url?: string | null
  thumbnail_url?: string | null
  is_timed?: boolean
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
  // Time-based sets (for exercises like wall sit, plank, etc.)
  is_timed?: boolean
  target_duration?: number | null // Target duration in seconds
  actual_duration?: number | null // Actual duration in seconds
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
  showNotesInput?: boolean // triggered by "Add Note" menu item
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

// RIR (Reps in Reserve) options: failure, 0-5 plus qualitative
const RIR_OPTIONS = ['fail', '0', '1', '2', '3', '4', '5', 'few', 'some', 'many']

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
      if (timeLeft <= 0) {
        playTimerSound() // Play sound when rest timer completes
        onComplete()
      }
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

// Quick Timer state interface
interface QuickTimerState {
  timeLeft: number
  selectedPreset: number
  isRunning: boolean
  hasStarted: boolean
}

// Quick Timer with Presets - one-off standalone timer (uses lifted state)
function QuickTimerModal({
  isOpen,
  onClose,
  timerState,
  onTimerStateChange,
}: {
  isOpen: boolean
  onClose: () => void
  timerState: QuickTimerState
  onTimerStateChange: (state: Partial<QuickTimerState>) => void
}) {
  const { timeLeft, selectedPreset, isRunning, hasStarted } = timerState

  const presets = [
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
    { label: '2m', value: 120 },
    { label: '3m', value: 180 },
    { label: '5m', value: 300 },
  ]

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const selectPreset = (value: number) => {
    onTimerStateChange({
      selectedPreset: value,
      timeLeft: value,
      isRunning: false,
      hasStarted: false,
    })
  }

  const startTimer = () => {
    onTimerStateChange({ isRunning: true, hasStarted: true })
  }

  const resetTimer = () => {
    onTimerStateChange({
      timeLeft: selectedPreset,
      isRunning: false,
      hasStarted: false,
    })
  }

  if (!isOpen) return null

  const progress = hasStarted ? ((selectedPreset - timeLeft) / selectedPreset) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Timer Display */}
        <div className="flex justify-center mb-6">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progress * 4.52} 452`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-4xl font-mono font-bold">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {presets.map(preset => (
            <button
              key={preset.value}
              onClick={() => selectPreset(preset.value)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPreset === preset.value && !hasStarted
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={resetTimer}
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RotateCcw size={24} />
          </button>
          <button
            onClick={() => isRunning ? onTimerStateChange({ isRunning: false }) : startTimer()}
            className={`p-6 rounded-full transition-colors ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>
          <button
            onClick={onClose}
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Inline Rest Timer - shows between sets
function InlineRestTimer({
  seconds,
  isActive,
  onComplete,
  onAdjust,
}: {
  seconds: number
  isActive: boolean
  onComplete: () => void
  onAdjust: (newSeconds: number) => void
}) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [isRunning, setIsRunning] = useState(isActive)

  useEffect(() => {
    setTimeLeft(seconds)
    setIsRunning(isActive)
  }, [seconds, isActive])

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0 && isRunning) {
        playTimerSound()
        onComplete()
      }
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

  if (!isActive) return null

  return (
    <div className="flex items-center justify-center gap-3 py-2 px-3 my-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      {/* Progress bar background */}
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer display */}
      <span className="font-mono text-amber-400 text-sm font-medium min-w-[48px] text-center">
        {formatTime(timeLeft)}
      </span>

      {/* Quick adjust buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setTimeLeft(t => Math.max(0, t - 15))
          }}
          className="px-1.5 py-0.5 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          -15
        </button>
        <button
          onClick={() => {
            setTimeLeft(t => t + 30)
          }}
          className="px-1.5 py-0.5 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          +30
        </button>
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="p-1 text-white/40 hover:text-white transition-colors"
        title="Skip rest"
      >
        <SkipForward size={14} />
      </button>
    </div>
  )
}

// Exercise Menu Modal - 3-dot menu options
function ExerciseMenu({
  isOpen,
  onClose,
  exercise,
  restSeconds,
  notes,
  supersetGroup,
  onShowDetails,
  onFormCoach,
  onSwapExercise,
  onUpdateRest,
  onAddNote,
  onSetSuperset,
  onRemove,
}: {
  isOpen: boolean
  onClose: () => void
  exercise: Exercise
  restSeconds: number
  notes: string
  supersetGroup: string | null
  onShowDetails: () => void
  onFormCoach: () => void
  onSwapExercise: () => void
  onUpdateRest: (seconds: number) => void
  onAddNote: () => void
  onSetSuperset: (group: string | null) => void
  onRemove: () => void
}) {
  if (!isOpen) return null

  const supersetGroups = ['A', 'B', 'C', 'D']

  const menuItems = [
    { icon: Info, label: 'Exercise Info', action: () => { onShowDetails(); onClose(); } },
    { icon: Camera, label: 'AI Form Coach', action: () => { onFormCoach(); onClose(); } },
    { icon: ArrowLeftRight, label: 'Replace Exercise', action: () => { onSwapExercise(); onClose(); } },
    { icon: MessageSquare, label: 'Add Note', action: () => { onAddNote(); onClose(); } },
    { divider: true },
    { icon: Trash2, label: 'Remove Exercise', action: () => { onRemove(); onClose(); }, danger: true },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4 pb-8 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Exercise name header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <EquipmentIcon equipment={exercise.equipment} size={18} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{exercise.name}</h3>
            <p className="text-xs text-white/50 capitalize">{exercise.primary_muscle}</p>
          </div>
        </div>

        {/* Rest timer setting */}
        <div className="flex items-center justify-between py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white/70">
            <Clock size={18} />
            <span className="text-sm">Rest Timer</span>
          </div>
          <div className="flex items-center gap-1">
            {[60, 90, 120, 180].map(sec => (
              <button
                key={sec}
                onClick={() => onUpdateRest(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  restSeconds === sec
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Superset setting */}
        <div className="flex items-center justify-between py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white/70">
            <Link2 size={18} />
            <span className="text-sm">Superset</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSetSuperset(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                supersetGroup === null
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              None
            </button>
            {supersetGroups.map(group => {
              const colors = SUPERSET_COLORS[group] || SUPERSET_COLORS['A']
              return (
                <button
                  key={group}
                  onClick={() => onSetSuperset(group)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    supersetGroup === group
                      ? `${colors.bg} ${colors.text} ring-2 ${colors.ring}`
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {group}
                </button>
              )
            })}
          </div>
        </div>

        {/* Menu items */}
        <div className="mt-2">
          {menuItems.map((item, i) => (
            'divider' in item ? (
              <div key={i} className="h-px bg-white/10 my-2" />
            ) : (
              <button
                key={i}
                onClick={item.action}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  item.danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <item.icon size={20} />
                <span className="text-sm">{item.label}</span>
              </button>
            )
          ))}
        </div>
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
  keepOpenOnAdd = false,
}: {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
  title?: string
  subtitle?: string
  keepOpenOnAdd?: boolean
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false) // Subtle indicator for search updates
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null) // For detail popup
  const [showCreateExercise, setShowCreateExercise] = useState(false) // For AI exercise creation
  const [addedExercises, setAddedExercises] = useState<Set<string>>(new Set()) // Track added exercises
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search term to prevent flickering on every keystroke
  const debouncedSearch = useDebounce(search, 300)

  // Initial load
  useEffect(() => {
    inputRef.current?.focus()
    fetchExercises()
  }, [])

  // Fetch on debounced search or filter change
  useEffect(() => {
    // Skip initial render (handled by first useEffect)
    if (debouncedSearch !== '' || filter !== null) {
      fetchExercises()
    }
  }, [debouncedSearch, filter])

  const fetchExercises = async () => {
    // Only show full loading spinner on initial load, not search updates
    if (exercises.length === 0) {
      setLoading(true)
    } else {
      setIsSearching(true) // Show subtle indicator instead of hiding list
    }

    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
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
      setIsSearching(false)
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
        {/* Header - shows title or Done button for keep-open mode */}
        {(title || keepOpenOnAdd) && (
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-violet-500/10">
            <div>
              <h2 className="font-semibold text-white">{title || 'Add Exercises'}</h2>
              {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                keepOpenOnAdd
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'hover:bg-white/10'
              }`}
              aria-label="Done"
            >
              {keepOpenOnAdd ? 'Done' : <X size={20} className="text-white/60" />}
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
          ) : (
            <>
              {/* Subtle searching indicator - doesn't hide results */}
              {isSearching && (
                <div className="px-4 py-2 text-xs text-white/40 flex items-center gap-2 border-b border-white/5">
                  <Loader2 size={12} className="animate-spin" />
                  Searching...
                </div>
              )}
              {exercises.length > 0 ? (
                <>
                  {exercises.map(exercise => (
                    <div
                      key={exercise.id}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    >
                      {/* Icon - clickable to view details */}
                      <button
                        onClick={() => setDetailExercise(exercise)}
                        className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
                        title="View details"
                      >
                        <EquipmentIcon equipment={exercise.equipment} size={18} />
                      </button>

                      {/* Name/info - clickable to view details */}
                      <button
                        onClick={() => setDetailExercise(exercise)}
                        className="flex-1 min-w-0 text-left hover:text-amber-400 transition-colors"
                      >
                        <p className="font-medium">{exercise.name}</p>
                        <p className="text-sm text-white/50 capitalize">{exercise.primary_muscle?.replace('_', ' ')} • {formatEquipmentName(exercise.equipment)}</p>
                      </button>

                      {/* Add button - adds exercise to workout */}
                      <button
                        onClick={() => {
                          onSelect(exercise)
                          if (keepOpenOnAdd) {
                            setAddedExercises(prev => new Set(prev).add(exercise.id))
                            // Clear the "Added" state after 2 seconds
                            setTimeout(() => {
                              setAddedExercises(prev => {
                                const next = new Set(prev)
                                next.delete(exercise.id)
                                return next
                              })
                            }, 2000)
                          } else {
                            onClose()
                          }
                        }}
                        disabled={addedExercises.has(exercise.id)}
                        className={`px-3 py-1.5 rounded-lg transition-all text-sm font-medium shrink-0 ${
                          addedExercises.has(exercise.id)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        }`}
                      >
                        {addedExercises.has(exercise.id) ? (
                          <span className="flex items-center gap-1">
                            <Check size={14} /> Added
                          </span>
                        ) : 'Add'}
                      </button>
                    </div>
                  ))}
                  {/* Always show create option when searching */}
                  {debouncedSearch && (
                    <div className="px-4 py-3 border-t border-white/10">
                      <button
                        onClick={() => setShowCreateExercise(true)}
                        className="w-full py-2 text-sm text-white/50 hover:text-amber-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Don't see it? Create "{debouncedSearch}"
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-white/40 mb-4">No exercises found for "{debouncedSearch}"</p>
                  <button
                    onClick={() => setShowCreateExercise(true)}
                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Create "{debouncedSearch}"
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Exercise Detail Popup */}
        {detailExercise && (
          <ExerciseSearchDetailPopup
            exercise={detailExercise}
            onClose={() => setDetailExercise(null)}
            onAdd={() => {
              onSelect(detailExercise)
              setDetailExercise(null)
              if (keepOpenOnAdd) {
                setAddedExercises(prev => new Set(prev).add(detailExercise.id))
                setTimeout(() => {
                  setAddedExercises(prev => {
                    const next = new Set(prev)
                    next.delete(detailExercise.id)
                    return next
                  })
                }, 2000)
              } else {
                onClose()
              }
            }}
          />
        )}

        {/* AI Exercise Creation Modal */}
        {showCreateExercise && (
          <CreateExerciseModal
            initialName={debouncedSearch}
            onClose={() => setShowCreateExercise(false)}
            onCreated={(exercise) => {
              onSelect(exercise)
              setShowCreateExercise(false)
              if (!keepOpenOnAdd) {
                onClose()
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

// Simple detail popup for exercise search
function ExerciseSearchDetailPopup({
  exercise,
  onClose,
  onAdd,
}: {
  exercise: Exercise
  onClose: () => void
  onAdd: () => void
}) {
  return (
    <div
      className="absolute inset-0 bg-zinc-900 z-10 overflow-y-auto animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <EquipmentIcon equipment={exercise.equipment} size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{exercise.name}</h3>
              <p className="text-sm text-white/50 capitalize">
                {exercise.primary_muscle?.replace('_', ' ')} • {formatEquipmentName(exercise.equipment)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Thumbnail/GIF */}
        {(exercise.video_url || exercise.thumbnail_url) && (
          <div className="mb-4 rounded-xl overflow-hidden bg-black/30 aspect-video">
            <img
              src={exercise.video_url || exercise.thumbnail_url || ''}
              alt={exercise.name}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Cues */}
        {exercise.cues && exercise.cues.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-white/70 mb-2">Coaching Cues</h4>
            <ul className="space-y-1">
              {exercise.cues.map((cue, i) => (
                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {cue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={onAdd}
          className="w-full py-3 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors"
        >
          Add to Workout
        </button>
      </div>
    </div>
  )
}

// AI Exercise Creation Modal
function CreateExerciseModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string
  onClose: () => void
  onCreated: (exercise: Exercise) => void
}) {
  const [name, setName] = useState(initialName)
  const [generating, setGenerating] = useState(false)
  const [generatedExercise, setGeneratedExercise] = useState<Partial<Exercise> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Equipment options
  const EQUIPMENT_OPTIONS = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'bodyweight', label: 'Bodyweight' },
    { value: 'cable', label: 'Cable' },
    { value: 'machine', label: 'Machine' },
    { value: 'kettlebell', label: 'Kettlebell' },
    { value: 'bands', label: 'Resistance Bands' },
    { value: 'medicine_ball', label: 'Medicine Ball' },
  ]

  const generateExercise = async () => {
    if (!name.trim()) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate exercise')
      }

      const data = await res.json()
      setGeneratedExercise(data.exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exercise')
    } finally {
      setGenerating(false)
    }
  }

  const saveExercise = async () => {
    if (!generatedExercise) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedExercise),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save exercise')
      }

      const data = await res.json()
      onCreated(data.exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute inset-0 bg-zinc-900 z-20 overflow-y-auto animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Exercise</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {!generatedExercise ? (
          <>
            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-1">Exercise Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Wall Sit"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateExercise}
              disabled={generating || !name.trim()}
              className="w-full py-3 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Exercise Details
                </>
              )}
            </button>

            <p className="text-xs text-white/40 text-center mt-3">
              AI will suggest muscle groups, equipment, and coaching cues
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-amber-400/80 text-center mb-4">
              ✓ AI Generated — Edit any field below
            </p>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Name</label>
                <input
                  type="text"
                  value={generatedExercise.name || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Primary Muscle */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Primary Muscle</label>
                <input
                  type="text"
                  value={generatedExercise.primary_muscle || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, primary_muscle: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Equipment */}
              <div>
                <label className="block text-sm text-white/60 mb-1">Equipment</label>
                <select
                  value={generatedExercise.equipment || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, equipment: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                >
                  {EQUIPMENT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Cues - editable */}
              {generatedExercise.cues && generatedExercise.cues.length > 0 && (
                <div>
                  <label className="block text-sm text-white/60 mb-1">Coaching Cues (click to edit)</label>
                  <div className="space-y-2">
                    {generatedExercise.cues.map((cue, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-2">•</span>
                        <input
                          type="text"
                          value={cue}
                          onChange={(e) => {
                            const newCues = [...(generatedExercise.cues || [])]
                            newCues[i] = e.target.value
                            setGeneratedExercise({ ...generatedExercise, cues: newCues })
                          }}
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={saveExercise}
              disabled={saving}
              className="w-full mt-6 py-3 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Add'
              )}
            </button>

            <button
              onClick={() => setGeneratedExercise(null)}
              className="w-full mt-2 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Start over with different name
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
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
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [targetReached, setTargetReached] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Swipe-to-delete state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startXRef = useRef(0)
  const DELETE_THRESHOLD = -80 // pixels to swipe to trigger delete

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startXRef.current
    // Only allow swiping left (negative values)
    setSwipeX(Math.min(0, diff))
  }

  const handleTouchEnd = () => {
    if (swipeX < DELETE_THRESHOLD) {
      // Trigger delete
      onDelete()
    }
    setSwipeX(0)
    setIsSwiping(false)
  }

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  // Play sound when timer reaches target duration
  useEffect(() => {
    if (timerRunning && set.target_duration && timerSeconds >= set.target_duration && !targetReached) {
      playTimerSound()
      setTargetReached(true)
    }
  }, [timerSeconds, timerRunning, set.target_duration, targetReached])

  // Wake Lock - keep screen on while timer is running
  useEffect(() => {
    const requestWakeLock = async () => {
      if (timerRunning && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        } catch (err) {
          // Wake Lock request failed - typically happens when page is not visible
          console.debug('Wake Lock request failed:', err)
        }
      }
    }

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release()
          wakeLockRef.current = null
        } catch (err) {
          console.debug('Wake Lock release failed:', err)
        }
      }
    }

    if (timerRunning) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }

    return () => {
      releaseWakeLock()
    }
  }, [timerRunning])

  // Format seconds as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format date for previous set display
  const formatPrevDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Toggle timer
  const toggleTimer = () => {
    if (timerRunning) {
      // Stop timer and save duration
      setTimerRunning(false)
      onUpdate({ actual_duration: timerSeconds })
    } else {
      // Start timer
      setTimerRunning(true)
    }
  }

  // Reset timer
  const resetTimer = () => {
    setTimerRunning(false)
    setTimerSeconds(0)
    setTargetReached(false)
    onUpdate({ actual_duration: null })
  }

  // Render timed set row - for exercises like wall sit, plank, etc.
  if (set.is_timed) {
    return (
      <div className="relative overflow-hidden">
        {/* Delete zone revealed on swipe */}
        {swipeX < 0 && (
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-4"
            style={{ width: Math.abs(swipeX) + 60 }}
          >
            <Trash2 size={18} className="text-white" />
          </div>
        )}

        {/* Swipeable content */}
        <div
          className={`flex items-center gap-2 py-1.5 bg-zinc-900 relative ${set.completed ? 'opacity-50' : ''}`}
          style={{ transform: `translateX(${swipeX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Set number */}
          <div className="w-8 text-center">
            <span className={`text-sm font-medium ${setType?.color || 'text-white/70'}`}>
              {set.set_type === 'warmup' ? 'W' : set.set_number}
            </span>
          </div>

        {/* Target duration input */}
        <div className="w-14">
          <input
            type="number"
            inputMode="numeric"
            value={set.target_duration ?? ''}
            onChange={e => onUpdate({ target_duration: e.target.value ? Number(e.target.value) : null })}
            onFocus={e => e.target.select()}
            placeholder="goal"
            className={`w-full rounded px-1.5 py-1.5 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
              set.completed
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white'
            }`}
          />
        </div>

        {/* Timer display */}
        <div className="flex items-center gap-1.5">
          <span className={`font-mono tabular-nums text-sm min-w-[40px] text-center ${
            timerRunning ? 'text-amber-400' : 'text-white/60'
          }`}>
            {formatTime(timerRunning ? timerSeconds : (set.actual_duration || 0))}
          </span>

          {/* Timer controls */}
          <button
            onClick={toggleTimer}
            className={`p-1.5 rounded-lg transition-colors ${
              timerRunning
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {timerRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            onClick={resetTimer}
            className="p-1.5 rounded-lg bg-white/10 text-white/40 hover:text-white/60 transition-colors"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

          {/* Complete button */}
          <button
            onClick={onComplete}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${
              set.completed
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/40 hover:bg-amber-500 hover:text-black active:bg-amber-600'
            }`}
          >
            <Check size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  // Render regular (reps-based) set row - Clean Strong-style layout
  return (
    <div className="relative overflow-hidden">
      {/* Delete zone revealed on swipe */}
      {swipeX < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-4"
          style={{ width: Math.abs(swipeX) + 60 }}
        >
          <Trash2 size={18} className="text-white" />
        </div>
      )}

      {/* Swipeable content */}
      <div
        className={`flex items-center gap-2 py-1.5 bg-zinc-900 relative ${set.completed ? 'opacity-50' : ''}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Set number */}
        <div className="w-8 text-center">
          <span className={`text-sm font-medium ${setType?.color || 'text-white/70'}`}>
            {set.set_type === 'warmup' ? 'W' : set.set_number}
          </span>
        </div>

        {/* Previous (reference) - clickable to autofill */}
        <div className="w-16 text-center">
          {previousSet ? (
            <button
              onClick={() => {
                onUpdate({
                  actual_weight: previousSet.weight,
                  actual_reps: previousSet.reps
                })
              }}
              className="text-xs hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition-colors group w-full"
              title="Tap to copy"
            >
              <span className="text-white/50 font-medium group-hover:text-amber-400 tabular-nums">
                {previousSet.weight}×{previousSet.reps}
              </span>
            </button>
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </div>

        {/* Weight input */}
        <div className="w-14">
          <input
            type="number"
            inputMode="decimal"
            value={set.actual_weight ?? set.target_weight ?? ''}
            onChange={e => onUpdate({ actual_weight: e.target.value ? Number(e.target.value) : null })}
            onFocus={e => e.target.select()}
            placeholder="—"
            className={`w-full rounded px-1.5 py-1.5 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
              set.completed
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white'
            }`}
          />
        </div>

        <span className="text-white/20 text-xs">×</span>

        {/* Reps input */}
        <div className="w-12">
          <input
            type="number"
            inputMode="numeric"
            value={set.actual_reps ?? set.target_reps ?? ''}
            onChange={e => onUpdate({ actual_reps: e.target.value ? Number(e.target.value) : null })}
            onFocus={e => e.target.select()}
            placeholder="—"
            className={`w-full rounded px-1.5 py-1.5 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
              set.completed
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white'
            }`}
          />
        </div>

        {/* RIR selector - compact dropdown */}
        <div className="w-12">
          <select
            value={set.actual_rir ?? ''}
            onChange={e => onUpdate({ actual_rir: e.target.value || null })}
            className={`w-full rounded px-1 py-1.5 text-center text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
              set.completed
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white'
            }`}
          >
            <option value="" className="bg-zinc-800">RIR</option>
            {RIR_OPTIONS.map(rir => (
              <option key={rir} value={rir} className="bg-zinc-800">{rir}</option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Complete button - checkmark */}
        <button
          onClick={onComplete}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 ${
            set.completed
              ? 'bg-emerald-500 text-white'
              : 'bg-white/10 text-white/40 hover:bg-amber-500 hover:text-black active:bg-amber-600'
          }`}
        >
          <Check size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// Superset groups with distinct colors
const SUPERSET_GROUPS = ['A', 'B', 'C', 'D', 'E']

const SUPERSET_COLORS: Record<string, { ring: string; bg: string; text: string }> = {
  'A': { ring: 'ring-amber-500/40', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  'B': { ring: 'ring-sky-500/40', bg: 'bg-sky-500/20', text: 'text-sky-400' },
  'C': { ring: 'ring-violet-500/40', bg: 'bg-violet-500/20', text: 'text-violet-400' },
  'D': { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'E': { ring: 'ring-rose-500/40', bg: 'bg-rose-500/20', text: 'text-rose-400' },
}

function getSupersetColor(group: string | null) {
  if (!group) return null
  return SUPERSET_COLORS[group] || SUPERSET_COLORS['A']
}

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
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <EquipmentIcon equipment={exercise.equipment} size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{exercise.name}</h3>
              <p className="text-sm text-white/50 capitalize">
                {exercise.primary_muscle?.replace('_', ' ')} • {formatEquipmentName(exercise.equipment)}
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
                    src={exercise.video_url || exercise.thumbnail_url || ''}
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

              {/* Estimated 1RM Trend Chart */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-amber-400">Estimated 1RM Trend</h4>
                  {stats?.estimated_1rm_pr && (
                    <span className="text-sm text-white/60">PR: <span className="font-bold text-amber-400">{stats.estimated_1rm_pr}lbs</span></span>
                  )}
                </div>
                {e1rmHistory.length > 0 ? (
                  <div className="h-32 bg-white/5 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={e1rmHistory.slice(-10)}>
                        <defs>
                          <linearGradient id="e1rmGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#666', fontSize: 10 }}
                          tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis tick={{ fill: '#666', fontSize: 10 }} domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                          labelFormatter={(val) => new Date(val).toLocaleDateString()}
                          formatter={(value: any) => [`${value} lbs`, 'Est. 1RM']}
                        />
                        <Area type="monotone" dataKey="estimated1RM" stroke="#F59E0B" fill="url(#e1rmGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 bg-white/5 rounded-lg flex items-center justify-center text-white/30 text-sm">
                    Not enough data
                  </div>
                )}
              </div>

              {/* Volume Trend Chart */}
              {stats?.volume_trend && stats.volume_trend.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-amber-400 mb-3">Volume Per Session</h4>
                  <div className="h-32 bg-white/5 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.volume_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#666', fontSize: 10 }}
                          tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                          labelFormatter={(val) => new Date(val).toLocaleDateString()}
                          formatter={(value: any) => [`${value.toLocaleString()} lbs`, 'Volume']}
                        />
                        <Line type="monotone" dataKey="volume" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Max Weight Trend Chart */}
              {stats?.max_weight_trend && stats.max_weight_trend.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-amber-400 mb-3">Max Weight Per Session</h4>
                  <div className="h-32 bg-white/5 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.max_weight_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#666', fontSize: 10 }}
                          tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis tick={{ fill: '#666', fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                          labelFormatter={(val) => new Date(val).toLocaleDateString()}
                          formatter={(value: any) => [`${value} lbs`, 'Max Weight']}
                        />
                        <Line type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3, fill: '#8B5CF6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

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
  previousNotes,
  onUpdate,
  onRemove,
  onSetComplete,
  onShowDetails,
  onFormCoach,
  onSwapExercise,
  onOpenMenu,
}: {
  workoutExercise: WorkoutExercise
  index: number
  previousSetData?: Record<number, PreviousSetData> // set_number -> previous data
  previousNotes?: string | null // Notes from the last session
  onUpdate: (updates: Partial<WorkoutExercise>) => void
  onRemove: () => void
  onSetComplete: (setId: string) => void
  onShowDetails: () => void
  onFormCoach: () => void
  onSwapExercise: () => void
  onOpenMenu: () => void
}) {
  const { exercise, sets, collapsed, superset_group, rest_seconds, notes, showNotesInput } = workoutExercise
  const [showPreviousNotes, setShowPreviousNotes] = useState(false)
  const [activeRestAfterSetId, setActiveRestAfterSetId] = useState<string | null>(null)
  const [localShowNotes, setLocalShowNotes] = useState(!!notes)

  // Show notes if locally toggled or parent triggered it
  const showNotes = localShowNotes || showNotesInput

  // Check if all sets are complete
  const allSetsComplete = sets.length > 0 && sets.every(s => s.completed)
  const completedCount = sets.filter(s => s.completed).length

  const addSet = () => {
    const lastSet = sets[sets.length - 1]
    const isTimed = exercise.is_timed || lastSet?.is_timed || false
    const newSet: SetData = {
      id: `set-${Date.now()}`,
      set_number: sets.filter(s => s.set_type !== 'warmup').length + 1,
      set_type: 'working',
      target_reps: isTimed ? null : (lastSet?.target_reps ?? 10),
      target_weight: lastSet?.target_weight ?? null,
      target_rir: null,
      actual_reps: null,
      actual_weight: null,
      actual_rir: null,
      completed: false,
      is_timed: isTimed,
      target_duration: isTimed ? (lastSet?.target_duration ?? 30) : null,
      actual_duration: null,
    }
    onUpdate({ sets: [...sets, newSet] })
  }

  const updateSet = (setId: string, updates: Partial<SetData>) => {
    // If weight is being updated, propagate to subsequent sets that don't have a weight yet
    if (updates.actual_weight !== undefined) {
      const setIndex = sets.findIndex(s => s.id === setId)
      const weightValue = updates.actual_weight ?? null
      onUpdate({
        sets: sets.map((s, i) => {
          if (s.id === setId) return { ...s, ...updates }
          // Propagate weight to subsequent sets without an actual weight
          if (i > setIndex && s.actual_weight === null && !s.completed) {
            return { ...s, actual_weight: weightValue }
          }
          return s
        })
      })
    } else {
      onUpdate({
        sets: sets.map(s => s.id === setId ? { ...s, ...updates } : s)
      })
    }
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

  // Handle set completion with rest timer
  const handleLocalSetComplete = (setId: string) => {
    onSetComplete(setId)
    playSetCompleteSound()
    // Start rest timer after this set
    setActiveRestAfterSetId(setId)
  }

  const supersetColor = getSupersetColor(superset_group)

  return (
    <div className={`glass rounded-xl overflow-hidden ${supersetColor ? `ring-2 ${supersetColor.ring}` : ''}`}>
      {/* Header - Clean and minimal */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => onUpdate({ collapsed: !collapsed })}
      >
        {superset_group && supersetColor && (
          <span className={`px-1.5 py-0.5 text-[10px] font-bold ${supersetColor.bg} ${supersetColor.text} rounded`}>
            {superset_group}
          </span>
        )}

        <div
          className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
        >
          <EquipmentIcon equipment={exercise.equipment} size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">
            {exercise.name}
          </h3>
        </div>

        {/* Completion indicator when collapsed */}
        {collapsed && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            allSetsComplete
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/10 text-white/50'
          }`}>
            {allSetsComplete ? (
              <span className="flex items-center gap-1">
                <Check size={12} /> Done
              </span>
            ) : (
              `${completedCount}/${sets.length}`
            )}
          </span>
        )}

        {/* 3-dot menu */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
          className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <MoreVertical size={18} />
        </button>

        {collapsed ? <ChevronDown size={18} className="text-white/40" /> : <ChevronUp size={18} className="text-white/40" />}
      </div>

      {/* Sets (collapsible) */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {/* Previous notes indicator - compact */}
          {previousNotes && (
            <button
              onClick={() => setShowPreviousNotes(!showPreviousNotes)}
              className="flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-400 transition-colors mb-2"
            >
              <MessageSquare size={12} />
              <span>Last session note</span>
              <ChevronDown size={12} className={`transform transition-transform ${showPreviousNotes ? 'rotate-180' : ''}`} />
            </button>
          )}
          {showPreviousNotes && previousNotes && (
            <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-white/70 italic">
              "{previousNotes}"
            </div>
          )}

          {/* Header row - compact */}
          <div className="flex items-center gap-2 text-[10px] text-white/30 mb-1 px-1 uppercase tracking-wider">
            <div className="w-8 text-center">Set</div>
            <div className="w-16 text-center">Prev</div>
            <div className="w-14 text-center">Lbs</div>
            <div className="w-3"></div>
            <div className="w-12 text-center">Reps</div>
            <div className="w-12 text-center">RIR</div>
            <div className="flex-1"></div>
            <div className="w-8"></div>
          </div>

          {/* Sets with inline rest timers */}
          {sets.map((set, index) => (
            <div key={set.id}>
              <SetRow
                set={set}
                exerciseName={exercise.name}
                previousSet={previousSetData?.[set.set_number]}
                onUpdate={(updates) => updateSet(set.id, updates)}
                onComplete={() => handleLocalSetComplete(set.id)}
                onDelete={() => deleteSet(set.id)}
              />
              {/* Inline rest timer after completed set */}
              {set.completed && index < sets.length - 1 && (
                <InlineRestTimer
                  seconds={rest_seconds}
                  isActive={activeRestAfterSetId === set.id}
                  onComplete={() => setActiveRestAfterSetId(null)}
                  onAdjust={() => {}}
                />
              )}
            </div>
          ))}

          {/* Add set button - minimal */}
          <button
            onClick={addSet}
            className="w-full mt-2 py-1.5 text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5 text-xs"
          >
            <Plus size={14} /> Add Set
          </button>

          {/* Notes - only show if toggled or has content */}
          {(showNotes || notes) && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <textarea
                value={notes}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="Add notes..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
                rows={2}
              />
            </div>
          )}
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
  // Get workout context for persistence across navigation
  const { activeWorkout, updateWorkout, minimizeWorkout, expandWorkout, isMinimized } = useWorkout()

  // Use context state if available (restored from minimize), otherwise use props
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    activeWorkout?.exercises ?? initialExercises
  )
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  // Quick timer modal visibility
  const [showQuickTimer, setShowQuickTimer] = useState(false)
  // Quick timer state (lifted so timer continues when modal closed)
  const [quickTimerState, setQuickTimerState] = useState<QuickTimerState>(
    activeWorkout?.timerState ?? {
      timeLeft: 90,
      selectedPreset: 90,
      isRunning: false,
      hasStarted: false,
    }
  )
  const [workoutStartTime] = useState(activeWorkout?.startTime ?? new Date())
  const [workoutName, setWorkoutName] = useState(activeWorkout?.name ?? initialName)
  const [saving, setSaving] = useState(false)
  const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<Exercise | null>(null)
  const [selectedExerciseForFormCoach, setSelectedExerciseForFormCoach] = useState<Exercise | null>(null)
  const [exerciseToSwap, setExerciseToSwap] = useState<{ workoutExerciseId: string; exercise: Exercise } | null>(null)
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState<{ exerciseId: string; exercise: Exercise; restSeconds: number; notes: string; supersetGroup: string | null } | null>(null)

  // PR Detection state
  const [exerciseBests, setExerciseBests] = useState<Map<string, ExerciseBests>>(new Map())
  const [previousExerciseNotes, setPreviousExerciseNotes] = useState<Map<string, string>>(new Map())
  // Previous set data: exercise_id -> { set_number -> { weight, reps, date } }
  const [previousSetData, setPreviousSetData] = useState<Map<string, Record<number, PreviousSetData>>>(new Map())
  const { activePR, celebrate, dismiss, CelebrationComponent } = usePRCelebration()
  const showCelebrationToast = useCelebrationToast()

  // Sync local state changes to context for persistence
  useEffect(() => {
    updateWorkout({
      exercises,
      name: workoutName,
      startTime: workoutStartTime,
      timerState: quickTimerState,
      plannedWorkoutId,
      isMinimized,
    })
  }, [exercises, workoutName, quickTimerState, isMinimized])

  // Expand workout when component mounts (user navigated to /lifting)
  useEffect(() => {
    if (activeWorkout && isMinimized) {
      expandWorkout()
    }
  }, [])

  // Hide global navigation when workout tracker is active and NOT minimized
  useEffect(() => {
    if (isMinimized) {
      document.body.classList.remove('workout-active')
    } else {
      document.body.classList.add('workout-active')
    }
    return () => {
      document.body.classList.remove('workout-active')
    }
  }, [isMinimized])

  // Quick timer countdown effect - runs even when modal is closed
  useEffect(() => {
    if (!quickTimerState.isRunning || quickTimerState.timeLeft <= 0) {
      if (quickTimerState.timeLeft <= 0 && quickTimerState.hasStarted) {
        playTimerSound()
        setQuickTimerState(prev => ({ ...prev, isRunning: false }))
      }
      return
    }

    const timer = setInterval(() => {
      setQuickTimerState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }))
    }, 1000)

    return () => clearInterval(timer)
  }, [quickTimerState.isRunning, quickTimerState.timeLeft, quickTimerState.hasStarted])

  // Helper to update quick timer state
  const updateQuickTimerState = (updates: Partial<QuickTimerState>) => {
    setQuickTimerState(prev => ({ ...prev, ...updates }))
  }

  // Format time for display
  const formatQuickTimerTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Set initial collapsed state: expand first exercise (and its superset group), collapse rest
  useEffect(() => {
    if (initialExercises.length === 0) return

    // Find what superset group the first exercise is in (if any)
    const firstSupersetGroup = initialExercises[0]?.superset_group

    setExercises(prev => prev.map((ex, index) => {
      // First exercise is always expanded
      if (index === 0) return { ...ex, collapsed: false }

      // If first exercise is in a superset, expand all in that group
      if (firstSupersetGroup && ex.superset_group === firstSupersetGroup) {
        return { ...ex, collapsed: false }
      }

      // All others collapsed
      return { ...ex, collapsed: true }
    }))
  }, []) // Only run once on mount

  // Fetch exercise history for PR detection, previous notes, and previous set data on mount
  useEffect(() => {
    const fetchExerciseHistory = async () => {
      const exerciseIds = exercises.map(ex => ex.exercise.id).filter(Boolean)
      if (exerciseIds.length === 0) return

      const bestsMap = new Map<string, ExerciseBests>()
      const notesMap = new Map<string, string>()
      const setDataMap = new Map<string, Record<number, PreviousSetData>>()

      // Fetch history for each unique exercise
      const uniqueIds = Array.from(new Set(exerciseIds))
      await Promise.all(
        uniqueIds.map(async (exerciseId) => {
          try {
            const res = await fetch(`/api/exercise-history?exercise_id=${exerciseId}&limit=50`)
            if (res.ok) {
              const data = await res.json()
              if (data.history) {
                const bests = buildExerciseBests(data.history)
                bestsMap.set(exerciseId, bests)

                // Get data from the most recent session
                const mostRecent = data.history[0]
                if (mostRecent?.notes && mostRecent.notes.trim()) {
                  notesMap.set(exerciseId, mostRecent.notes)
                }

                // Extract previous set data from most recent session
                if (mostRecent?.sets) {
                  const prevSets: Record<number, PreviousSetData> = {}
                  mostRecent.sets
                    .filter((s: any) => s.completed && s.actual_weight_lbs != null && s.actual_reps != null)
                    .forEach((s: any) => {
                      prevSets[s.set_number] = {
                        weight: s.actual_weight_lbs,
                        reps: s.actual_reps,
                        date: mostRecent.workout_date,
                      }
                    })
                  if (Object.keys(prevSets).length > 0) {
                    setDataMap.set(exerciseId, prevSets)
                  }
                }
              }
            }
          } catch (err) {
            console.debug('Failed to fetch exercise history:', err)
          }
        })
      )

      setExerciseBests(bestsMap)
      setPreviousExerciseNotes(notesMap)
      setPreviousSetData(setDataMap)
    }

    if (exercises.length > 0) {
      fetchExerciseHistory()
    }
  }, []) // Run once on mount

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
    const isTimed = exercise.is_timed || false
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
          target_reps: isTimed ? null : 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
          is_timed: isTimed,
          target_duration: isTimed ? 30 : null,
          actual_duration: null,
        },
        {
          id: `set-${Date.now() + 1}`,
          set_number: 2,
          set_type: 'working',
          target_reps: isTimed ? null : 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
          is_timed: isTimed,
          target_duration: isTimed ? 30 : null,
          actual_duration: null,
        },
        {
          id: `set-${Date.now() + 2}`,
          set_number: 3,
          set_type: 'working',
          target_reps: isTimed ? null : 10,
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
          is_timed: isTimed,
          target_duration: isTimed ? 30 : null,
          actual_duration: null,
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
    const exercise = exercises.find(ex => ex.id === exerciseId)
    const set = exercise?.sets.find(s => s.id === setId)
    const isCompleting = set && !set.completed

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

    // Check for PR when completing a set (not uncompleting)
    if (isCompleting && exercise && set) {
      const actualWeight = set.actual_weight ?? set.target_weight ?? 0
      const actualReps = set.actual_reps ?? set.target_reps ?? 0

      if (actualWeight > 0 && actualReps > 0) {
        const bests = exerciseBests.get(exercise.exercise.id)
        if (bests) {
          const prs = detectPRs(
            exercise.exercise.id,
            exercise.exercise.name,
            actualWeight,
            actualReps,
            bests
          )

          if (prs.length > 0) {
            const mainPR = getMostSignificantPR(prs)
            if (mainPR) {
              // Show celebration modal for significant PRs (1RM or weight)
              if (mainPR.type === 'e1rm' || mainPR.type === 'weight') {
                celebrate(mainPR)
              } else {
                // Show toast for other PR types
                showCelebrationToast(formatPRMessage(mainPR))
              }

              // Update local bests to prevent duplicate celebrations
              setExerciseBests(prev => {
                const updated = new Map(prev)
                const currentBests = updated.get(exercise.exercise.id) || {
                  maxWeight: null,
                  maxReps: null,
                  maxVolume: null,
                  best1RM: null,
                  maxRepsAtWeight: {},
                }

                const newWeight = actualWeight
                const newReps = actualReps
                const newVolume = newWeight * newReps
                const { estimated1RM } = calculate1RM(newWeight, newReps)

                updated.set(exercise.exercise.id, {
                  maxWeight: Math.max(currentBests.maxWeight ?? 0, newWeight),
                  maxReps: Math.max(currentBests.maxReps ?? 0, newReps),
                  maxVolume: Math.max(currentBests.maxVolume ?? 0, newVolume),
                  best1RM: Math.max(currentBests.best1RM ?? 0, estimated1RM),
                  maxRepsAtWeight: {
                    ...currentBests.maxRepsAtWeight,
                    [Math.round(newWeight / 2.5) * 2.5]: Math.max(
                      currentBests.maxRepsAtWeight[Math.round(newWeight / 2.5) * 2.5] ?? 0,
                      newReps
                    ),
                  },
                })

                return updated
              })
            }
          }
        }
      }
    }

    // Rest timer is now handled inline in ExerciseCard

    // Auto-collapse current exercise and expand next when all sets complete
    if (isCompleting) {
      setTimeout(() => {
        setExercises(prev => {
          const exerciseIndex = prev.findIndex(ex => ex.id === exerciseId)
          if (exerciseIndex === -1) return prev

          const currentExercise = prev[exerciseIndex]
          const allSetsComplete = currentExercise.sets.every(s => s.completed)

          if (!allSetsComplete) return prev

          // Check if this exercise is part of a superset
          const supersetGroup = currentExercise.superset_group

          if (supersetGroup) {
            // Find all exercises in this superset group
            const supersetExercises = prev.filter(ex => ex.superset_group === supersetGroup)
            const allSupersetComplete = supersetExercises.every(ex =>
              ex.sets.every(s => s.completed)
            )

            if (!allSupersetComplete) {
              // Don't collapse yet - more exercises in superset to complete
              return prev
            }

            // All superset exercises complete - find next exercise outside this superset
            const lastSupersetIndex = prev.reduce((maxIdx, ex, i) =>
              ex.superset_group === supersetGroup ? i : maxIdx, -1)
            const nextIndex = lastSupersetIndex + 1

            if (nextIndex >= prev.length) {
              // No more exercises, collapse superset group
              return prev.map(ex =>
                ex.superset_group === supersetGroup ? { ...ex, collapsed: true } : ex
              )
            }

            // Collapse superset, expand next exercise (and its superset group if any)
            const nextExercise = prev[nextIndex]
            const nextSupersetGroup = nextExercise.superset_group

            return prev.map((ex, i) => {
              if (ex.superset_group === supersetGroup) return { ...ex, collapsed: true }
              if (i === nextIndex) return { ...ex, collapsed: false }
              if (nextSupersetGroup && ex.superset_group === nextSupersetGroup) {
                return { ...ex, collapsed: false }
              }
              return ex
            })
          }

          // Not a superset - simple case
          const nextIndex = exerciseIndex + 1
          if (nextIndex >= prev.length) {
            // No next exercise, just collapse current
            return prev.map((ex, i) =>
              i === exerciseIndex ? { ...ex, collapsed: true } : ex
            )
          }

          // Collapse current, expand next (and its superset group if any)
          const nextExercise = prev[nextIndex]
          const nextSupersetGroup = nextExercise.superset_group

          return prev.map((ex, i) => {
            if (i === exerciseIndex) return { ...ex, collapsed: true }
            if (i === nextIndex) return { ...ex, collapsed: false }
            if (nextSupersetGroup && ex.superset_group === nextSupersetGroup) {
              return { ...ex, collapsed: false }
            }
            return ex
          })
        })
      }, 300) // Small delay to let the UI update first
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
          // Time-based fields
          is_timed: set.is_timed || false,
          target_duration_seconds: set.target_duration || null,
          actual_duration_seconds: set.actual_duration || null,
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
          scheduled_date: new Date().toLocaleDateString('sv-SE'), // Local date in YYYY-MM-DD format
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

  // When minimized, return null - MinimizedWorkoutBar (in layout) handles the display
  if (isMinimized) {
    return null
  }

  return (
    <div className="pb-24">
      {/* Top Navbar - App name left, actions right */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - App name */}
          <Link href="/lifting" className="text-xl font-display font-semibold tracking-tight">
            Forge
          </Link>

          {/* Right side - Menu, Settings, AI Coach, Timer (outside to inside) */}
          <div className="flex items-center gap-1">
            {/* Timer button (innermost) */}
            <button
              onClick={() => {
                if (quickTimerState.timeLeft <= 0 && quickTimerState.hasStarted) {
                  setQuickTimerState(prev => ({
                    ...prev,
                    hasStarted: false,
                    timeLeft: prev.selectedPreset,
                  }))
                } else {
                  setShowQuickTimer(true)
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-sm transition-colors ${
                quickTimerState.hasStarted
                  ? quickTimerState.isRunning
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : quickTimerState.timeLeft <= 0
                      ? 'bg-amber-500/30 text-amber-400 animate-pulse'
                      : 'bg-zinc-700/50 text-white/70'
                  : 'hover:bg-white/5 text-white/50'
              }`}
              title="Rest Timer"
            >
              <Timer size={18} />
              {quickTimerState.hasStarted && (
                <span className="font-bold">
                  {quickTimerState.timeLeft <= 0 ? 'Done!' : formatQuickTimerTime(quickTimerState.timeLeft)}
                </span>
              )}
            </button>

            {/* AI Coach button */}
            <button
              onClick={() => openAIChat()}
              className="relative p-2 hover:bg-violet-500/20 rounded-lg transition-colors group"
              title="AI Coach"
            >
              <Bot size={20} className="text-violet-400 group-hover:text-violet-300" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
                <Sparkles size={8} className="text-black" />
              </span>
            </button>

            {/* Settings */}
            <Link
              href="/settings"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} className="text-white/50 hover:text-white/70" />
            </Link>

            {/* Minimize button (outermost) - collapses workout to floating bar */}
            <button
              onClick={() => minimizeWorkout()}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Minimize workout"
            >
              <ChevronDown size={20} className="text-white/50 hover:text-white/70" />
            </button>
          </div>
        </div>
      </div>

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
            previousNotes={previousExerciseNotes.get(ex.exercise.id)}
            previousSetData={previousSetData.get(ex.exercise.id)}
            onUpdate={(updates) => updateExercise(ex.id, updates)}
            onRemove={() => removeExercise(ex.id)}
            onSetComplete={(setId) => handleSetComplete(ex.id, setId)}
            onShowDetails={() => setSelectedExerciseForDetails(ex.exercise)}
            onFormCoach={() => setSelectedExerciseForFormCoach(ex.exercise)}
            onSwapExercise={() => setExerciseToSwap({ workoutExerciseId: ex.id, exercise: ex.exercise })}
            onOpenMenu={() => setExerciseMenuOpen({
              exerciseId: ex.id,
              exercise: ex.exercise,
              restSeconds: ex.rest_seconds,
              notes: ex.notes,
              supersetGroup: ex.superset_group,
            })}
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

      {/* Exercise Search Modal */}
      {showExerciseSearch && (
        <ExerciseSearchModal
          onSelect={addExercise}
          onClose={() => setShowExerciseSearch(false)}
          keepOpenOnAdd={true}
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

      {/* PR Celebration */}
      {CelebrationComponent}

      {/* Quick Timer Modal */}
      <QuickTimerModal
        isOpen={showQuickTimer}
        onClose={() => setShowQuickTimer(false)}
        timerState={quickTimerState}
        onTimerStateChange={updateQuickTimerState}
      />

      {/* Exercise Menu - rendered at top level to avoid backdrop-filter containing block issue */}
      {exerciseMenuOpen && (
        <ExerciseMenu
          isOpen={true}
          onClose={() => setExerciseMenuOpen(null)}
          exercise={exerciseMenuOpen.exercise}
          restSeconds={exerciseMenuOpen.restSeconds}
          notes={exerciseMenuOpen.notes}
          supersetGroup={exerciseMenuOpen.supersetGroup}
          onShowDetails={() => {
            setSelectedExerciseForDetails(exerciseMenuOpen.exercise)
            setExerciseMenuOpen(null)
          }}
          onFormCoach={() => {
            setSelectedExerciseForFormCoach(exerciseMenuOpen.exercise)
            setExerciseMenuOpen(null)
          }}
          onSwapExercise={() => {
            setExerciseToSwap({ workoutExerciseId: exerciseMenuOpen.exerciseId, exercise: exerciseMenuOpen.exercise })
            setExerciseMenuOpen(null)
          }}
          onUpdateRest={(seconds) => {
            updateExercise(exerciseMenuOpen.exerciseId, { rest_seconds: seconds })
            setExerciseMenuOpen(prev => prev ? { ...prev, restSeconds: seconds } : null)
          }}
          onAddNote={() => {
            // Expand the exercise and show notes input
            updateExercise(exerciseMenuOpen.exerciseId, { collapsed: false, showNotesInput: true })
            setExerciseMenuOpen(null)
          }}
          onSetSuperset={(group) => {
            // Check if any exercise in this superset group is expanded
            const shouldExpand = group && exercises.some(
              ex => ex.superset_group === group && !ex.collapsed
            )
            updateExercise(exerciseMenuOpen.exerciseId, {
              superset_group: group,
              // Auto-expand if other exercises in this superset are expanded
              ...(shouldExpand ? { collapsed: false } : {})
            })
            setExerciseMenuOpen(prev => prev ? { ...prev, supersetGroup: group } : null)
          }}
          onRemove={() => {
            removeExercise(exerciseMenuOpen.exerciseId)
            setExerciseMenuOpen(null)
          }}
        />
      )}

    </div>
  )
}
