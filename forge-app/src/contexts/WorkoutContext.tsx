'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'

// Types matching LiftingTracker
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
  target_rir: string | null
  actual_reps: number | null
  actual_weight: number | null
  actual_rir: string | null
  completed: boolean
  is_timed?: boolean
  target_duration?: number | null
  actual_duration?: number | null
}

interface WorkoutExercise {
  id: string
  exercise: Exercise
  superset_group: string | null
  rest_seconds: number
  notes: string
  sets: SetData[]
  collapsed: boolean
  showNotesInput?: boolean
}

interface QuickTimerState {
  timeLeft: number
  selectedPreset: number
  isRunning: boolean
  hasStarted: boolean
}

interface ActiveWorkout {
  exercises: WorkoutExercise[]
  name: string
  startTime: Date
  plannedWorkoutId?: string | null
  timerState: QuickTimerState
  isMinimized: boolean
}

interface WorkoutContextType {
  activeWorkout: ActiveWorkout | null
  startWorkout: (exercises: WorkoutExercise[], name: string, plannedWorkoutId?: string | null) => void
  updateWorkout: (updates: Partial<ActiveWorkout>) => void
  endWorkout: () => void
  minimizeWorkout: () => void
  expandWorkout: () => void
  isMinimized: boolean
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)

  // Timer interval ref for persistence
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Manage timer countdown even when minimized
  useEffect(() => {
    if (!activeWorkout?.timerState.isRunning || activeWorkout?.timerState.timeLeft <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    timerIntervalRef.current = setInterval(() => {
      setActiveWorkout(prev => {
        if (!prev) return null
        const newTimeLeft = prev.timerState.timeLeft - 1
        if (newTimeLeft <= 0) {
          // Play sound when done
          playTimerSound()
          return {
            ...prev,
            timerState: { ...prev.timerState, timeLeft: 0, isRunning: false }
          }
        }
        return {
          ...prev,
          timerState: { ...prev.timerState, timeLeft: newTimeLeft }
        }
      })
    }, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [activeWorkout?.timerState.isRunning, activeWorkout?.timerState.timeLeft])

  const startWorkout = useCallback((exercises: WorkoutExercise[], name: string, plannedWorkoutId?: string | null) => {
    setActiveWorkout({
      exercises,
      name,
      startTime: new Date(),
      plannedWorkoutId,
      timerState: {
        timeLeft: 90,
        selectedPreset: 90,
        isRunning: false,
        hasStarted: false,
      },
      isMinimized: false,
    })
  }, [])

  const updateWorkout = useCallback((updates: Partial<ActiveWorkout>) => {
    setActiveWorkout(prev => {
      if (prev) {
        return { ...prev, ...updates }
      }
      // If no existing workout, create one from the updates (requires all fields)
      if (updates.exercises && updates.name !== undefined && updates.startTime && updates.timerState) {
        return {
          exercises: updates.exercises,
          name: updates.name,
          startTime: updates.startTime,
          timerState: updates.timerState,
          plannedWorkoutId: updates.plannedWorkoutId ?? null,
          isMinimized: updates.isMinimized ?? false,
        }
      }
      return null
    })
  }, [])

  const endWorkout = useCallback(() => {
    setActiveWorkout(null)
  }, [])

  const minimizeWorkout = useCallback(() => {
    setActiveWorkout(prev => prev ? { ...prev, isMinimized: true } : null)
  }, [])

  const expandWorkout = useCallback(() => {
    setActiveWorkout(prev => prev ? { ...prev, isMinimized: false } : null)
  }, [])

  const isMinimized = activeWorkout?.isMinimized ?? false

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        startWorkout,
        updateWorkout,
        endWorkout,
        minimizeWorkout,
        expandWorkout,
        isMinimized,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  )
}

export function useWorkout() {
  const context = useContext(WorkoutContext)
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider')
  }
  return context
}

// Timer sound utility
function playTimerSound() {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()

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
    playBeep(now + 0.4, 1000)
  } catch (err) {
    console.debug('Audio playback failed:', err)
  }
}
