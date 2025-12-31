'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  X,
  Bike,
  Footprints,
  Waves,
  Dumbbell,
  Activity,
  Clock,
  Route,
  Gauge,
  Calendar,
  Loader2,
} from 'lucide-react'

interface CreateWorkoutModalProps {
  selectedDate: Date
  onClose: () => void
  onCreated: () => void
}

const categories = [
  { value: 'cardio', label: 'Cardio', color: 'bg-sky-500' },
  { value: 'strength', label: 'Strength', color: 'bg-violet-500' },
  { value: 'other', label: 'Other', color: 'bg-emerald-500' },
] as const

const workoutTypes = [
  { value: 'bike', label: 'Bike', icon: Bike, category: 'cardio' },
  { value: 'run', label: 'Run', icon: Footprints, category: 'cardio' },
  { value: 'swim', label: 'Swim', icon: Waves, category: 'cardio' },
  { value: 'strength', label: 'Strength', icon: Dumbbell, category: 'strength' },
  { value: 'yoga', label: 'Yoga', icon: Activity, category: 'other' },
  { value: 'other', label: 'Other', icon: Activity, category: 'other' },
] as const

const intensityZones = [
  { value: 'z1', label: 'Z1 - Recovery', color: 'bg-blue-400' },
  { value: 'z2', label: 'Z2 - Endurance', color: 'bg-green-400' },
  { value: 'z3', label: 'Z3 - Tempo', color: 'bg-yellow-400' },
  { value: 'z4', label: 'Z4 - Threshold', color: 'bg-orange-400' },
  { value: 'z5', label: 'Z5 - VO2max', color: 'bg-red-400' },
  { value: 'hit', label: 'HIT - High Intensity', color: 'bg-red-600' },
  { value: 'mixed', label: 'Mixed', color: 'bg-purple-400' },
] as const

export function CreateWorkoutModal({ selectedDate, onClose, onCreated }: CreateWorkoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: 'cardio' as 'cardio' | 'strength' | 'other',
    workout_type: 'bike',
    scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    planned_duration_minutes: 60,
    planned_distance_miles: '',
    planned_tss: '',
    primary_intensity: 'z2',
    notes: '',
  })

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
          planned_distance_miles: formData.planned_distance_miles ? parseFloat(formData.planned_distance_miles) : null,
          planned_tss: formData.planned_tss ? parseInt(formData.planned_tss) : null,
          status: 'planned',
        }),
      })

      if (response.ok) {
        onCreated()
        onClose()
      } else {
        const errorData = await response.json()
        console.error('Failed to create workout:', errorData)
        setError(errorData.error || 'Failed to create workout. Please try again.')
      }
    } catch (err) {
      console.error('Error creating workout:', err)
      setError('Network error. Please check your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredWorkoutTypes = workoutTypes.filter(
    t => t.category === formData.category || t.value === 'other'
  )

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
              <p className="text-sm text-white/50">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
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
          {/* Name */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Workout Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Morning Ride, Leg Day, etc."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Category</label>
            <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    category: cat.value,
                    workout_type: workoutTypes.find(t => t.category === cat.value)?.value || 'other'
                  }))}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-all ${
                    formData.category === cat.value
                      ? `${cat.color} border-transparent text-white`
                      : 'border-white/10 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workout Type */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {filteredWorkoutTypes.map(type => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, workout_type: type.value }))}
                    className={`py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                      formData.workout_type === type.value
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'border-white/10 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} />
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Time</label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={e => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Duration (min)</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="number"
                  value={formData.planned_duration_minutes}
                  onChange={e => setFormData(prev => ({ ...prev, planned_duration_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Distance & TSS (for cardio) */}
          {formData.category === 'cardio' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Distance (mi)</label>
                <div className="relative">
                  <Route size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="number"
                    step="0.1"
                    value={formData.planned_distance_miles}
                    onChange={e => setFormData(prev => ({ ...prev, planned_distance_miles: e.target.value }))}
                    placeholder="Optional"
                    className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Target TSS</label>
                <div className="relative">
                  <Gauge size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="number"
                    value={formData.planned_tss}
                    onChange={e => setFormData(prev => ({ ...prev, planned_tss: e.target.value }))}
                    placeholder="Optional"
                    className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Intensity Zone */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Target Intensity</label>
            <select
              value={formData.primary_intensity}
              onChange={e => setFormData(prev => ({ ...prev, primary_intensity: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50"
            >
              {intensityZones.map(zone => (
                <option key={zone.value} value={zone.value} className="bg-zinc-900">
                  {zone.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Workout details, goals, etc."
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
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
