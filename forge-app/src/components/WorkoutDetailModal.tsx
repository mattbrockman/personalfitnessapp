'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  X,
  Clock,
  Calendar,
  CalendarDays,
  Trash2,
  CheckCircle2,
  Edit3,
  Save,
  Bike,
  Footprints,
  Dumbbell,
  Activity,
  Loader2,
  ExternalLink,
  Play,
  Plus,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { Workout } from '@/types/database'
import { calculateWorkoutTSS } from '@/lib/calculate-workout-tss'

interface WorkoutDetailModalProps {
  workout: Workout
  onClose: () => void
  onUpdate: () => void
}

const categoryColors: Record<string, { bg: string; light: string; text: string; border: string }> = {
  cardio: { bg: 'bg-sky-500', light: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  strength: { bg: 'bg-violet-500', light: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  other: { bg: 'bg-amber-500', light: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
}

const workoutIcons: Record<string, any> = {
  bike: Bike,
  run: Footprints,
  upper: Dumbbell,
  lower: Dumbbell,
  full_body: Dumbbell,
  strength: Dumbbell,
  default: Activity,
}

const feelingOptions = [
  { value: 1, emoji: '😫', label: 'Very Weak' },
  { value: 2, emoji: '😕', label: 'Weak' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Strong' },
  { value: 5, emoji: '😄', label: 'Very Strong' },
]

export function WorkoutDetailModal({ workout: initialWorkout, onClose, onUpdate }: WorkoutDetailModalProps) {
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout>(initialWorkout)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showFullCompletion, setShowFullCompletion] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(initialWorkout.scheduled_date || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Strava sync state
  const [stravaSyncStatus, setStravaSyncStatus] = useState<{
    checked: boolean
    synced: boolean
    strava_activity_id?: number
    strava_url?: string
  }>({ checked: false, synced: false })
  const [isSyncingToStrava, setIsSyncingToStrava] = useState(false)
  const [stravaError, setStravaError] = useState<string | null>(null)
  const [showStravaReconnect, setShowStravaReconnect] = useState(false)

  const isStrengthWorkout = workout.category === 'strength'

  // Fetch full workout details including exercises when modal opens
  useEffect(() => {
    const fetchWorkoutDetails = async () => {
      try {
        const res = await fetch(`/api/workouts/${initialWorkout.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.workout) {
            setWorkout(data.workout)
          }
        }
      } catch (err) {
        console.error('Failed to fetch workout details:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWorkoutDetails()
  }, [initialWorkout.id])

  // Check if workout is already synced to Strava (for completed workouts)
  useEffect(() => {
    const checkStravaSync = async () => {
      if (workout.status !== 'completed' || workout.source === 'strava') return

      try {
        const res = await fetch(`/api/strava/push?workout_id=${workout.id}`)
        if (res.ok) {
          const data = await res.json()
          setStravaSyncStatus({
            checked: true,
            synced: data.synced,
            strava_activity_id: data.strava_activity_id,
            strava_url: data.strava_url,
          })
        }
      } catch (err) {
        console.error('Failed to check Strava sync status:', err)
        setStravaSyncStatus({ checked: true, synced: false })
      }
    }
    checkStravaSync()
  }, [workout.id, workout.status, workout.source])

  // Handle push to Strava
  const handlePushToStrava = async () => {
    setIsSyncingToStrava(true)
    setStravaError(null)
    setShowStravaReconnect(false)

    try {
      const res = await fetch('/api/strava/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_id: workout.id }),
      })

      const data = await res.json()

      if (res.ok) {
        setStravaSyncStatus({
          checked: true,
          synced: true,
          strava_activity_id: data.strava_activity_id,
          strava_url: data.strava_url,
        })
      } else if (data.error === 'write_scope_required') {
        setShowStravaReconnect(true)
        setStravaError('Write permission needed to push workouts to Strava.')
      } else {
        setStravaError(data.error || 'Failed to sync to Strava')
      }
    } catch (err) {
      setStravaError('Network error. Please try again.')
    } finally {
      setIsSyncingToStrava(false)
    }
  }

  // Quick complete duration (editable on main view)
  const [quickDuration, setQuickDuration] = useState(
    workout.actual_duration_minutes || workout.planned_duration_minutes || 60
  )

  // Form state for editing
  const [formData, setFormData] = useState({
    name: workout.name || '',
    scheduled_date: workout.scheduled_date || '',
    scheduled_time: workout.scheduled_time || '',
    planned_duration_minutes: workout.planned_duration_minutes || 0,
    actual_duration_minutes: workout.actual_duration_minutes || 0,
    actual_distance_miles: workout.actual_distance_miles || 0,
    actual_avg_hr: workout.actual_avg_hr || 0,
    actual_max_hr: workout.actual_max_hr || 0,
    actual_avg_power: workout.actual_avg_power || 0,
    actual_np: workout.actual_np || 0,
    notes: workout.notes || '',
    exercises: workout.exercises ? [...workout.exercises] : [],
  })

  // Form state for full completion (with feeling/RPE)
  const [completionData, setCompletionData] = useState({
    actual_duration_minutes: workout.actual_duration_minutes || workout.planned_duration_minutes || 60,
    perceived_exertion: workout.perceived_exertion || 5,
    feeling: 3,
    notes: workout.notes || '',
  })

  const colors = categoryColors[workout.category] || categoryColors.other
  const Icon = workoutIcons[workout.workout_type] || workoutIcons.default

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/workouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workout.id,
          ...formData,
        }),
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const data = await response.json()
        setError(data.details || data.error || 'Failed to save workout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Quick complete - one click with current duration
  const handleQuickComplete = async (duration?: number) => {
    setIsSaving(true)
    setError(null)

    try {
      const actualDuration = duration ?? quickDuration
      // Calculate TSS with default RPE based on category
      const tss = calculateWorkoutTSS({
        category: (workout.category as 'cardio' | 'strength' | 'flexibility' | 'other') || 'other',
        durationMinutes: actualDuration,
      })

      const response = await fetch('/api/workouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workout.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration_minutes: actualDuration,
          actual_tss: tss,
        }),
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const data = await response.json()
        setError(data.details || data.error || 'Failed to complete workout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Full complete with feeling/RPE
  const handleFullComplete = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Calculate TSS using user-provided RPE or default based on category
      const tss = calculateWorkoutTSS({
        category: (workout.category as 'cardio' | 'strength' | 'flexibility' | 'other') || 'other',
        durationMinutes: completionData.actual_duration_minutes,
        perceivedExertion: completionData.perceived_exertion,
      })

      const response = await fetch('/api/workouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workout.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration_minutes: completionData.actual_duration_minutes,
          perceived_exertion: completionData.perceived_exertion,
          actual_tss: tss,
          notes: completionData.notes,
        }),
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const data = await response.json()
        setError(data.details || data.error || 'Failed to complete workout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workout?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/workouts?id=${workout.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete workout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Reschedule - quick date change without full edit
  const handleReschedule = async () => {
    if (!rescheduleDate || rescheduleDate === workout.scheduled_date) {
      setShowReschedule(false)
      return
    }

    setIsRescheduling(true)
    setError(null)

    try {
      const response = await fetch('/api/workouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workout.id,
          scheduled_date: rescheduleDate,
        }),
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const data = await response.json()
        setError(data.details || data.error || 'Failed to reschedule workout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsRescheduling(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Render full completion form (with feeling/RPE)
  if (showFullCompletion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
        <div
          className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-4 ${colors.light}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                  <CheckCircle2 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Complete Workout</h3>
                  <p className="text-white/60 text-sm">{workout.name || workout.workout_type}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            {/* Actual Duration */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Actual Duration (minutes)</label>
              <input
                type="number"
                value={completionData.actual_duration_minutes}
                onChange={e => setCompletionData(prev => ({ ...prev, actual_duration_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* How did you feel? */}
            <div>
              <label className="block text-sm text-white/60 mb-2">How did you feel?</label>
              <div className="flex justify-between gap-2">
                {feelingOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCompletionData(prev => ({ ...prev, feeling: option.value }))}
                    className={`flex-1 py-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                      completionData.feeling === option.value
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="text-xs text-tertiary">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* RPE Slider */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Rating of Perceived Exertion (RPE): <span className="text-white font-medium">{completionData.perceived_exertion}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={completionData.perceived_exertion}
                onChange={e => setCompletionData(prev => ({ ...prev, perceived_exertion: parseInt(e.target.value) }))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>No exertion</span>
                <span>Maximum effort</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Post-Workout Notes</label>
              <textarea
                value={completionData.notes}
                onChange={e => setCompletionData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="How did the workout go? Any observations..."
                rows={3}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFullCompletion(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFullComplete}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Mark Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render edit form
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
        <div
          className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-4 ${colors.light}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                  <Edit3 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Edit Workout</h3>
                  <p className="text-white/60 text-sm capitalize">{workout.workout_type}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Workout Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Morning Ride, Leg Day, etc."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Date</label>
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Time (optional)</label>
                <input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Planned Duration */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Planned Duration (minutes)</label>
              <input
                type="number"
                value={formData.planned_duration_minutes || ''}
                onChange={e => setFormData(prev => ({ ...prev, planned_duration_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Actual Metrics Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <p className="text-sm text-white/60 mb-3">Actual Metrics</p>

              {/* Actual Duration & Distance */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={formData.actual_duration_minutes || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_duration_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">Distance (mi)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.actual_distance_miles || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_distance_miles: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* HR */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">Avg HR (bpm)</label>
                  <input
                    type="number"
                    value={formData.actual_avg_hr || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_avg_hr: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">Max HR (bpm)</label>
                  <input
                    type="number"
                    value={formData.actual_max_hr || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_max_hr: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Power */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">Avg Power (w)</label>
                  <input
                    type="number"
                    value={formData.actual_avg_power || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_avg_power: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">NP (w)</label>
                  <input
                    type="number"
                    value={formData.actual_np || ''}
                    onChange={e => setFormData(prev => ({ ...prev, actual_np: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Workout details, goals, etc."
                rows={3}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            {/* Exercises Editor (for strength workouts) */}
            {isStrengthWorkout && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-white/60">Exercises</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      exercises: [
                        ...prev.exercises,
                        { exercise_name: '', sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90, notes: '' }
                      ]
                    }))}
                    className="flex items-center gap-1 px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded text-xs transition-colors"
                  >
                    <Plus size={12} />
                    Add Exercise
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {formData.exercises.map((ex, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ex.exercise_name}
                          onChange={e => {
                            const newExercises = [...formData.exercises]
                            newExercises[idx] = { ...newExercises[idx], exercise_name: e.target.value }
                            setFormData(prev => ({ ...prev, exercises: newExercises }))
                          }}
                          placeholder="Exercise name"
                          className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white placeholder:text-muted focus:outline-none focus:border-violet-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newExercises = formData.exercises.filter((_, i) => i !== idx)
                            setFormData(prev => ({ ...prev, exercises: newExercises }))
                          }}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-secondary">Sets</label>
                          <input
                            type="number"
                            value={ex.sets}
                            onChange={e => {
                              const newExercises = [...formData.exercises]
                              newExercises[idx] = { ...newExercises[idx], sets: parseInt(e.target.value) || 0 }
                              setFormData(prev => ({ ...prev, exercises: newExercises }))
                            }}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Min Reps</label>
                          <input
                            type="number"
                            value={ex.reps_min}
                            onChange={e => {
                              const newExercises = [...formData.exercises]
                              newExercises[idx] = { ...newExercises[idx], reps_min: parseInt(e.target.value) || 0 }
                              setFormData(prev => ({ ...prev, exercises: newExercises }))
                            }}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Max Reps</label>
                          <input
                            type="number"
                            value={ex.reps_max}
                            onChange={e => {
                              const newExercises = [...formData.exercises]
                              newExercises[idx] = { ...newExercises[idx], reps_max: parseInt(e.target.value) || 0 }
                              setFormData(prev => ({ ...prev, exercises: newExercises }))
                            }}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Rest (s)</label>
                          <input
                            type="number"
                            value={ex.rest_seconds || 90}
                            onChange={e => {
                              const newExercises = [...formData.exercises]
                              newExercises[idx] = { ...newExercises[idx], rest_seconds: parseInt(e.target.value) || 90 }
                              setFormData(prev => ({ ...prev, exercises: newExercises }))
                            }}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.exercises.length === 0 && (
                    <p className="text-xs text-muted text-center py-4">No exercises added yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 ${colors.light}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                <Icon size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{workout.name || workout.workout_type}</h3>
                <p className="text-white/60 text-sm capitalize">
                  {workout.workout_type} • {workout.category}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X size={20} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Date & Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Calendar size={16} />
              {workout.scheduled_date && format(new Date(workout.scheduled_date), 'EEEE, MMMM d, yyyy')}
              {workout.scheduled_time && ` at ${workout.scheduled_time}`}
            </div>
            {workout.status === 'completed' ? (
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> Completed
              </span>
            ) : (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                Planned
              </span>
            )}
          </div>

          {/* Reschedule section (for planned workouts) */}
          {workout.status !== 'completed' && (
            <div className="glass rounded-lg p-3">
              {!showReschedule ? (
                <button
                  onClick={() => setShowReschedule(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                  <CalendarDays size={16} />
                  Reschedule
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-secondary">Move to a different date</p>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowReschedule(false)
                        setRescheduleDate(workout.scheduled_date || '')
                      }}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={isRescheduling || rescheduleDate === workout.scheduled_date}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRescheduling ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CalendarDays size={14} />
                      )}
                      Move
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Planned vs Actual Stats */}
          <div className="glass rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-secondary text-xs mb-2">Planned</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-secondary" />
                    <span>{formatDuration(workout.planned_duration_minutes || 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-secondary text-xs mb-2">Completed</p>
                {workout.status === 'completed' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">{formatDuration(workout.actual_duration_minutes || 0)}</span>
                    </div>
                    {workout.actual_distance_miles && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <span>{workout.actual_distance_miles} mi</span>
                      </div>
                    )}
                    {workout.actual_avg_hr && (
                      <div className="flex items-center gap-2 text-red-400">
                        <span>Avg HR: {workout.actual_avg_hr} bpm</span>
                        {workout.actual_max_hr && <span className="text-secondary">/ Max: {workout.actual_max_hr}</span>}
                      </div>
                    )}
                    {workout.actual_avg_power && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <span>Avg Power: {workout.actual_avg_power}w{workout.actual_np ? ` / NP: ${workout.actual_np}w` : ''}</span>
                      </div>
                    )}
                    {workout.actual_elevation_ft && (
                      <div className="flex items-center gap-2 text-white/60">
                        <span>Elevation: {workout.actual_elevation_ft} ft</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">-</p>
                )}
              </div>
            </div>
          </div>

          {/* Exercises (for strength workouts) */}
          {workout.exercises && workout.exercises.length > 0 && (
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-secondary mb-3">Exercises ({workout.exercises.length})</p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {workout.exercises.map((ex: any, idx: number) => {
                  // Handle both formats: array of sets or simple sets count
                  const setsArray = Array.isArray(ex.sets) ? ex.sets : []
                  const completedSets = setsArray.filter((s: any) => s.completed)

                  return (
                    <div
                      key={idx}
                      className="py-2 px-3 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {ex.exercise_name || ex.exercise?.name || 'Exercise'}
                        </span>
                        {setsArray.length > 0 && (
                          <span className="text-xs text-emerald-400">
                            {completedSets.length}/{setsArray.length} sets
                          </span>
                        )}
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-secondary mb-2">{ex.notes}</p>
                      )}
                      {/* Show actual set results */}
                      {setsArray.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {setsArray.map((set: any, setIdx: number) => (
                            <div
                              key={setIdx}
                              className={`px-2 py-1 rounded text-xs ${
                                set.completed
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-white/5 text-secondary'
                              }`}
                            >
                              {set.is_timed ? (
                                // Timed set display
                                set.actual_duration_seconds
                                  ? `${set.actual_duration_seconds}s`
                                  : set.target_duration_seconds
                                    ? `${set.target_duration_seconds}s target`
                                    : '-'
                              ) : (
                                // Reps/weight set display
                                <>
                                  {set.actual_reps ?? set.target_reps ?? '-'}
                                  {(set.actual_weight_lbs || set.target_weight_lbs) && (
                                    <span className="text-tertiary">
                                      ×{set.actual_weight_lbs ?? set.target_weight_lbs}lb
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Fallback for simple format */}
                      {!setsArray.length && ex.sets && (
                        <div className="text-xs text-tertiary">
                          {ex.sets} × {ex.reps_min === ex.reps_max ? ex.reps_min : `${ex.reps_min}-${ex.reps_max}`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {workout.notes && (
            <div>
              <p className="text-xs text-secondary mb-1">Notes</p>
              <p className="text-sm text-white/80">{workout.notes}</p>
            </div>
          )}

          {/* RPE if completed */}
          {workout.status === 'completed' && workout.perceived_exertion && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">RPE:</span>
              <span className="text-sm font-medium">{workout.perceived_exertion}/10</span>
            </div>
          )}

          {/* External link */}
          {workout.external_url && (
            <a
              href={workout.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 glass rounded-lg text-sm text-white/60 hover:text-white transition-colors"
            >
              <ExternalLink size={16} />
              View on {workout.source === 'strava' ? 'Strava' : 'Source'}
            </a>
          )}

          {/* Strava Sync Section - only for completed workouts not from Strava */}
          {workout.status === 'completed' && workout.source !== 'strava' && stravaSyncStatus.checked && (
            <div className="glass rounded-xl p-4">
              {stravaSyncStatus.synced ? (
                // Already synced
                <a
                  href={stravaSyncStatus.strava_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <CheckCircle2 size={16} />
                  Synced to Strava
                  <ExternalLink size={14} />
                </a>
              ) : showStravaReconnect ? (
                // Need to reconnect with write scope
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-amber-400">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Permission needed</p>
                      <p className="text-white/60 text-xs mt-1">
                        To push workouts to Strava, you need to reconnect with write permissions.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/auth/strava?upgrade=true"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    <Upload size={16} />
                    Reconnect Strava
                  </a>
                </div>
              ) : (
                // Can sync
                <div className="space-y-2">
                  <button
                    onClick={handlePushToStrava}
                    disabled={isSyncingToStrava}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {isSyncingToStrava ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Sync to Strava
                      </>
                    )}
                  </button>
                  {stravaError && (
                    <p className="text-xs text-red-400 text-center">{stravaError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Start Workout Button (for planned strength workouts) */}
          {isStrengthWorkout && workout.status !== 'completed' && (
            <button
              onClick={() => {
                onClose()
                router.push(`/lifting?workout_id=${workout.id}`)
              }}
              className="w-full py-3 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Start Workout
            </button>
          )}

          {/* Quick Complete Section (for planned workouts) */}
          {workout.status !== 'completed' && (
            <div className="glass rounded-xl p-4 space-y-3">
              <p className="text-xs text-secondary">Quick Complete</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-secondary mb-1 block">Duration (min)</label>
                  <input
                    type="number"
                    value={quickDuration}
                    onChange={e => setQuickDuration(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <button
                  onClick={() => handleQuickComplete()}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2 h-[42px] mt-5"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Complete
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleQuickComplete(workout.planned_duration_minutes || 60)}
                  disabled={isSaving}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Complete as planned ({formatDuration(workout.planned_duration_minutes || 0)})
                </button>
                <button
                  onClick={() => setShowFullCompletion(true)}
                  className="text-xs text-secondary hover:text-white/60 transition-colors"
                >
                  More options...
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={16} />
              Edit
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
