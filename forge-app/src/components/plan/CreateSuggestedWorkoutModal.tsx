'use client'

import { useState } from 'react'
import { X, Loader2, Dumbbell, Bike, Zap } from 'lucide-react'
import { SuggestedWorkout } from '@/types/training-plan'
import { format } from 'date-fns'

interface CreateSuggestedWorkoutModalProps {
  planId: string
  date: Date
  onCreated: (workout: SuggestedWorkout) => void
  onClose: () => void
}

type Category = 'cardio' | 'strength' | 'other'

const WORKOUT_TYPES: Record<Category, string[]> = {
  cardio: ['bike', 'run', 'swim', 'row', 'other'],
  strength: ['upper', 'lower', 'full_body', 'push', 'pull', 'other'],
  other: ['yoga', 'mobility', 'sports', 'other'],
}

export function CreateSuggestedWorkoutModal({
  planId,
  date,
  onCreated,
  onClose,
}: CreateSuggestedWorkoutModalProps) {
  const [category, setCategory] = useState<Category>('strength')
  const [workoutType, setWorkoutType] = useState('upper')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(60)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory)
    setWorkoutType(WORKOUT_TYPES[newCategory][0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = format(date, 'EEEE').toLowerCase()

    try {
      const res = await fetch(`/api/training-plans/${planId}/suggested-workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggested_date: dateStr,
          day_of_week: dayOfWeek,
          category,
          workout_type: workoutType,
          name: name || `${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout`,
          description: description || null,
          planned_duration_minutes: duration,
          status: 'suggested',
        }),
      })

      if (res.ok) {
        const { suggested_workout } = await res.json()
        onCreated(suggested_workout)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create workout')
      }
    } catch (err) {
      console.error('Error creating workout:', err)
      setError('Failed to create workout')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Add Workout</h2>
            <p className="text-sm text-white/50">
              {format(date, 'EEEE, MMM d')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Category selector */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCategoryChange('strength')}
                className={`p-3 rounded-lg flex flex-col items-center gap-1 ${
                  category === 'strength'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Dumbbell size={20} />
                <span className="text-xs">Strength</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('cardio')}
                className={`p-3 rounded-lg flex flex-col items-center gap-1 ${
                  category === 'cardio'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Bike size={20} />
                <span className="text-xs">Cardio</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('other')}
                className={`p-3 rounded-lg flex flex-col items-center gap-1 ${
                  category === 'other'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Zap size={20} />
                <span className="text-xs">Other</span>
              </button>
            </div>
          </div>

          {/* Workout type */}
          <div>
            <label className="block text-sm text-white/60 mb-1">Type</label>
            <select
              value={workoutType}
              onChange={e => setWorkoutType(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
            >
              {WORKOUT_TYPES[category].map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-white/60 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout`}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-white/60 mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              min={5}
              max={300}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-white/60 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Add Workout
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
