'use client'

import { useState, useCallback } from 'react'
import { Plus, Layers, History, Dumbbell } from 'lucide-react'
import { WorkoutBuilder } from './WorkoutBuilder'
import { LiftingTracker } from './LiftingTracker'
import { WorkoutTemplateLibrary } from './WorkoutTemplateLibrary'

// Types
interface Exercise {
  id: string
  name: string
  primary_muscle: string
  equipment: string
  cues?: string[]
}

interface BuilderExercise {
  id: string
  exercise: Exercise
  sets: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  superset_group: string | null
  notes: string
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
}

interface WorkoutExercise {
  id: string
  exercise: Exercise
  superset_group: string | null
  rest_seconds: number
  notes: string
  sets: SetData[]
  collapsed: boolean
}

type TabView = 'new' | 'templates' | 'history'
type MainView = 'tabs' | 'builder' | 'tracker'

export function LiftingTab() {
  const [mainView, setMainView] = useState<MainView>('tabs')
  const [activeTab, setActiveTab] = useState<TabView>('new')
  const [workoutName, setWorkoutName] = useState('')
  const [preloadedExercises, setPreloadedExercises] = useState<WorkoutExercise[]>([])

  // Convert BuilderExercise to WorkoutExercise format for the tracker
  const convertToTrackerFormat = useCallback((builderExercises: BuilderExercise[]): WorkoutExercise[] => {
    return builderExercises.map(be => {
      // Create sets based on the builder config
      const sets: SetData[] = []
      for (let i = 0; i < be.sets; i++) {
        sets.push({
          id: `set-${Date.now()}-${i}`,
          set_number: i + 1,
          set_type: 'working',
          target_reps: be.reps_max, // Use max as target
          target_weight: null,
          target_rir: null,
          actual_reps: null,
          actual_weight: null,
          actual_rir: null,
          completed: false,
        })
      }

      return {
        id: `ex-${Date.now()}-${be.id}`,
        exercise: be.exercise,
        superset_group: be.superset_group,
        rest_seconds: be.rest_seconds,
        notes: be.notes,
        sets,
        collapsed: false,
      }
    })
  }, [])

  // Handle starting a workout from the builder
  const handleStartWorkout = useCallback(async (exercises: BuilderExercise[], name: string) => {
    const trackerExercises = convertToTrackerFormat(exercises)
    setWorkoutName(name)
    setPreloadedExercises(trackerExercises)
    setMainView('tracker')
  }, [convertToTrackerFormat])

  // Handle scheduling a workout
  const handleSchedule = useCallback(async (exercises: BuilderExercise[], name: string, date: string) => {
    try {
      // Create a planned workout with exercises
      const exercisesPayload = exercises.map((ex, index) => ({
        exercise_id: ex.exercise.id,
        order_index: index,
        superset_group: ex.superset_group,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_type: 'working',
          target_reps: ex.reps_max,
          target_weight: null,
          target_rpe: null,
        })),
      }))

      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          workout_type: 'strength',
          category: 'strength',
          scheduled_date: date,
          exercises: exercisesPayload,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to schedule workout')
      }

      alert(`Workout "${name}" scheduled for ${date}`)
      setMainView('tabs')
    } catch (error) {
      console.error('Failed to schedule workout:', error)
      alert('Failed to schedule workout. Please try again.')
    }
  }, [])

  // Handle saving as template
  const handleSaveTemplate = useCallback(async (exercises: BuilderExercise[], name: string, category: string) => {
    try {
      // Calculate estimated duration
      const estimatedDuration = exercises.reduce((total, ex) => {
        const setTime = 45
        const restTime = ex.rest_seconds * (ex.sets - 1)
        return total + (ex.sets * setTime) + restTime
      }, 0)
      const estimatedMinutes = Math.round(estimatedDuration / 60)

      const templateExercises = exercises.map(ex => ({
        exercise_id: ex.exercise.id,
        exercise_name: ex.exercise.name,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        rest_seconds: ex.rest_seconds,
        superset_group: ex.superset_group,
        notes: ex.notes,
      }))

      const res = await fetch('/api/workout-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          estimated_duration_min: estimatedMinutes,
          exercises: templateExercises,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save template')
      }

      alert(`Template "${name}" saved!`)
      setMainView('tabs')
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template. Please try again.')
    }
  }, [])

  // Handle finishing a workout in the tracker
  const handleFinishWorkout = useCallback(() => {
    setMainView('tabs')
    setPreloadedExercises([])
    setWorkoutName('')
  }, [])

  // Handle canceling workout
  const handleCancelWorkout = useCallback(() => {
    if (confirm('Are you sure you want to cancel this workout?')) {
      setMainView('tabs')
      setPreloadedExercises([])
      setWorkoutName('')
    }
  }, [])

  // Render main view
  if (mainView === 'builder') {
    return (
      <WorkoutBuilder
        onStartWorkout={handleStartWorkout}
        onSchedule={handleSchedule}
        onSaveTemplate={handleSaveTemplate}
        onClose={() => setMainView('tabs')}
      />
    )
  }

  if (mainView === 'tracker') {
    return (
      <LiftingTracker
        initialExercises={preloadedExercises}
        initialName={workoutName}
        onFinish={handleFinishWorkout}
        onCancel={handleCancelWorkout}
      />
    )
  }

  // Tabs view
  return (
    <div>
      {/* Tab Navigation */}
      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'new'
                ? 'bg-amber-500 text-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Plus size={18} />
            New Workout
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'templates'
                ? 'bg-amber-500 text-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={18} />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <History size={18} />
            History
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'new' && (
        <div className="p-4 lg:p-6">
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Dumbbell size={40} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start a New Workout</h2>
            <p className="text-white/50 mb-6 max-w-sm mx-auto">
              Build your workout from scratch or choose from your saved templates
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setMainView('builder')}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Build Custom Workout
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Layers size={18} />
                Browse Templates
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <WorkoutTemplateLibrary
          onStartWorkout={(template) => {
            // Convert template exercises to builder format then to tracker format
            const builderExercises: BuilderExercise[] = template.exercises.map((ex: any) => ({
              id: `template-${ex.exercise_id || Date.now()}`,
              exercise: {
                id: ex.exercise_id || '',
                name: ex.exercise_name,
                primary_muscle: '',
                equipment: '',
                cues: [],
              },
              sets: ex.sets,
              reps_min: ex.reps_min,
              reps_max: ex.reps_max,
              rest_seconds: ex.rest_seconds,
              superset_group: ex.superset_group || null,
              notes: ex.notes || '',
            }))
            handleStartWorkout(builderExercises, template.name)
          }}
        />
      )}

      {activeTab === 'history' && (
        <div className="p-4 lg:p-6">
          <div className="text-center py-12">
            <History size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">Workout history coming soon</p>
            <p className="text-sm text-white/30 mt-1">
              Your past lifting sessions will appear here
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
