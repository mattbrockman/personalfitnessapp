'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Layers, History, Dumbbell, Loader2, Sparkles } from 'lucide-react'
import { WorkoutBuilder } from './WorkoutBuilder'
import { LiftingTracker } from './LiftingTracker'
import { WorkoutTemplateLibrary } from './WorkoutTemplateLibrary'
import { AIWorkoutGenerator } from './AIWorkoutGenerator'

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

interface LiftingTabProps {
  workoutId?: string | null
}

export function LiftingTab({ workoutId }: LiftingTabProps) {
  const [mainView, setMainView] = useState<MainView>('tabs')
  const [activeTab, setActiveTab] = useState<TabView>('new')
  const [workoutName, setWorkoutName] = useState('')
  const [preloadedExercises, setPreloadedExercises] = useState<WorkoutExercise[]>([])
  const [plannedWorkoutId, setPlannedWorkoutId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)

  // Load workout from URL param if provided
  useEffect(() => {
    if (workoutId) {
      loadPlannedWorkout(workoutId)
    }
  }, [workoutId])

  const loadPlannedWorkout = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workouts/${id}`)
      if (!res.ok) {
        throw new Error('Failed to load workout')
      }

      const data = await res.json()
      const workout = data.workout

      if (!workout) {
        throw new Error('Workout not found')
      }

      // Convert workout exercises to tracker format
      const trackerExercises: WorkoutExercise[] = (workout.exercises || []).map((we: any) => {
        // Convert sets from API format to tracker format
        const sets: SetData[] = (we.sets || []).map((set: any, index: number) => ({
          id: set.id || `set-${Date.now()}-${index}`,
          set_number: set.set_number || index + 1,
          set_type: set.set_type || 'working',
          target_reps: set.target_reps,
          target_weight: set.target_weight_lbs,
          target_rir: set.target_rpe ? String(10 - set.target_rpe) : null, // Convert RPE to RIR
          actual_reps: set.actual_reps,
          actual_weight: set.actual_weight_lbs,
          actual_rir: set.actual_rpe ? String(10 - set.actual_rpe) : null,
          completed: set.completed || false,
        }))

        // If no sets exist, create sets based on JSONB metadata or defaults
        if (sets.length === 0) {
          const numSets = we._jsonb_sets || 3
          const targetReps = we._jsonb_reps_max || we._jsonb_reps_min || 10
          for (let i = 0; i < numSets; i++) {
            sets.push({
              id: `set-${Date.now()}-${i}`,
              set_number: i + 1,
              set_type: 'working',
              target_reps: targetReps,
              target_weight: null,
              target_rir: null,
              actual_reps: null,
              actual_weight: null,
              actual_rir: null,
              completed: false,
            })
          }
        }

        return {
          id: we.id || `ex-${Date.now()}`,
          exercise: {
            id: we.exercise_id || we.exercise?.id || '',
            name: we.exercise_name || we.exercise?.name || 'Unknown Exercise',
            primary_muscle: we.exercise?.primary_muscles?.[0] || '',
            equipment: we.exercise?.equipment || '',
            cues: we.exercise?.coaching_cues || [],
          },
          superset_group: we.superset_group || null,
          rest_seconds: we.rest_seconds || 90,
          notes: we.notes || '',
          sets,
          collapsed: false,
        }
      })

      setWorkoutName(workout.name || 'Planned Workout')
      setPreloadedExercises(trackerExercises)
      setPlannedWorkoutId(id)
      setMainView('tracker')
    } catch (error) {
      console.error('Failed to load planned workout:', error)
      alert('Failed to load workout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
    setShowAIGenerator(false)
    setMainView('tracker')
  }, [convertToTrackerFormat])

  // Handle AI generated workout - start immediately
  const handleAIStartWorkout = useCallback((exercises: BuilderExercise[], name: string) => {
    const trackerExercises = convertToTrackerFormat(exercises)
    setWorkoutName(name)
    setPreloadedExercises(trackerExercises)
    setShowAIGenerator(false)
    setMainView('tracker')
  }, [convertToTrackerFormat])

  // Handle AI generated workout - edit first in builder
  // Note: WorkoutBuilder would need to accept initial exercises to support this fully
  // For now, we'll just start the workout directly
  const handleAIEditInBuilder = useCallback((exercises: BuilderExercise[], name: string) => {
    // TODO: Pass exercises to WorkoutBuilder when it supports initial data
    // For now, start workout directly (user can modify in tracker)
    const trackerExercises = convertToTrackerFormat(exercises)
    setWorkoutName(name)
    setPreloadedExercises(trackerExercises)
    setShowAIGenerator(false)
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
    setPlannedWorkoutId(null)
    // Clear the URL param
    window.history.replaceState({}, '', '/lifting')
  }, [])

  // Handle canceling workout
  const handleCancelWorkout = useCallback(() => {
    if (confirm('Are you sure you want to cancel this workout?')) {
      setMainView('tabs')
      setPreloadedExercises([])
      setWorkoutName('')
      setPlannedWorkoutId(null)
      // Clear the URL param
      window.history.replaceState({}, '', '/lifting')
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-amber-400 animate-spin mb-4" />
          <p className="text-white/60">Loading workout...</p>
        </div>
      </div>
    )
  }

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
        plannedWorkoutId={plannedWorkoutId}
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
              Build your workout from scratch, use AI to generate one, or choose from templates
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowAIGenerator(true)}
                className="px-6 py-3 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                AI Generate
              </button>
              <button
                onClick={() => setMainView('builder')}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Build Custom
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Layers size={18} />
                Templates
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

      {/* AI Workout Generator Modal */}
      {showAIGenerator && (
        <AIWorkoutGenerator
          onStartWorkout={handleAIStartWorkout}
          onEditInBuilder={handleAIEditInBuilder}
          onClose={() => setShowAIGenerator(false)}
        />
      )}
    </div>
  )
}
