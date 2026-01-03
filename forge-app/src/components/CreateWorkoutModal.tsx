'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import {
  X,
  Clock,
  Calendar,
  Loader2,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { WORKOUT_TYPES, detectWorkoutTypeFromName, type WorkoutType } from '@/lib/strava'

interface CreateWorkoutModalProps {
  selectedDate: Date
  onClose: () => void
  onCreated: () => void
}

// Group workout types by category for the dropdown
const workoutTypeGroups = {
  cardio: ['bike', 'run', 'swim', 'row', 'elliptical', 'stairclimber', 'kayak', 'canoe', 'paddle'],
  strength: ['strength', 'crossfit', 'hiit'],
  other: [
    'ski', 'nordic_ski', 'snowboard', 'snowshoe', 'ice_skate',
    'tennis', 'pickleball', 'badminton', 'squash', 'table_tennis', 'racquetball',
    'soccer', 'basketball', 'football', 'hockey', 'volleyball',
    'walk', 'hike', 'rock_climb', 'golf', 'surf',
    'yoga', 'pilates', 'class', 'other'
  ],
} as const

export function CreateWorkoutModal({ selectedDate, onClose, onCreated }: CreateWorkoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [detectedType, setDetectedType] = useState<WorkoutType | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: 'cardio' as 'cardio' | 'strength' | 'other',
    workout_type: 'bike' as WorkoutType,
    scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
    scheduled_time: '', // Empty = all day event
    planned_duration_minutes: 60,
    notes: '',
  })

  // Smart detect workout type from name
  useEffect(() => {
    if (formData.name.length > 2) {
      const detected = detectWorkoutTypeFromName(formData.name)
      if (detected.workoutType !== 'other') {
        setDetectedType(detected.workoutType)
      } else {
        setDetectedType(null)
      }
    } else {
      setDetectedType(null)
    }
  }, [formData.name])

  // Apply detected type
  const applyDetectedType = () => {
    if (detectedType) {
      const typeInfo = WORKOUT_TYPES[detectedType]
      setFormData(prev => ({
        ...prev,
        workout_type: detectedType,
        category: typeInfo.category as 'cardio' | 'strength' | 'other',
      }))
      setDetectedType(null)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_time: formData.scheduled_time || null, // null = all day event
        }),
      })

      if (response.ok) {
        onCreated()
        onClose()
      } else {
        const errorData = await response.json()
        console.error('Failed to create workout:', errorData)
        const errorMsg = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : (errorData.error || 'Failed to create workout. Please try again.')
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Error creating workout:', err)
      setError('Network error. Please check your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get workout types for current category
  const getTypesForCategory = (cat: 'cardio' | 'strength' | 'other') => {
    return workoutTypeGroups[cat].filter(type => type in WORKOUT_TYPES)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Calendar size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Create Workout</h2>
              <p className="text-sm text-tertiary">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name with smart detection */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Workout Name</label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Morning Ride, Ski at Cannon, Tennis, etc."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50"
              />
              {detectedType && detectedType !== formData.workout_type && (
                <button
                  type="button"
                  onClick={applyDetectedType}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded text-xs text-amber-400 transition-colors"
                >
                  <Sparkles size={12} />
                  Set as {WORKOUT_TYPES[detectedType].label}?
                </button>
              )}
            </div>
          </div>

          {/* Workout Type Dropdown */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm text-white/60 mb-1.5">Sport Type</label>
            <button
              type="button"
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white flex items-center justify-between hover:border-white/20 transition-colors"
            >
              <span>{WORKOUT_TYPES[formData.workout_type]?.label || 'Select type'}</span>
              <ChevronDown size={16} className={`text-white/60 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showTypeDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                {/* Cardio types */}
                <div className="px-2 py-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 sticky top-0">Cardio</div>
                {getTypesForCategory('cardio').map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, workout_type: type as WorkoutType, category: 'cardio' }))
                      setShowTypeDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                      formData.workout_type === type ? 'bg-white/10 text-white' : 'text-white/80'
                    }`}
                  >
                    {WORKOUT_TYPES[type as WorkoutType]?.label}
                  </button>
                ))}

                {/* Strength types */}
                <div className="px-2 py-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 sticky top-0">Strength</div>
                {getTypesForCategory('strength').map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, workout_type: type as WorkoutType, category: 'strength' }))
                      setShowTypeDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                      formData.workout_type === type ? 'bg-white/10 text-white' : 'text-white/80'
                    }`}
                  >
                    {WORKOUT_TYPES[type as WorkoutType]?.label}
                  </button>
                ))}

                {/* Other types */}
                <div className="px-2 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 sticky top-0">Other Sports</div>
                {getTypesForCategory('other').map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, workout_type: type as WorkoutType, category: 'other' }))
                      setShowTypeDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                      formData.workout_type === type ? 'bg-white/10 text-white' : 'text-white/80'
                    }`}
                  >
                    {WORKOUT_TYPES[type as WorkoutType]?.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">
                Time <span className="text-muted">(optional)</span>
              </label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={e => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                placeholder="All day"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
              {!formData.scheduled_time && (
                <p className="text-xs text-muted mt-1">Leave empty for all-day event</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Duration (min)</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  type="number"
                  value={formData.planned_duration_minutes}
                  onChange={e => setFormData(prev => ({ ...prev, planned_duration_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
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
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workout'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
