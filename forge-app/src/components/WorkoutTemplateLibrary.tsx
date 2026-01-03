'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Dumbbell,
  Calendar,
  Copy,
  Edit2,
  Trash2,
  ChevronRight,
  Clock,
  Zap,
  Target,
  X,
  Check,
  Star,
  StarOff,
  Loader2,
} from 'lucide-react'

// Types
interface TemplateExercise {
  exercise_id: string
  exercise_name: string
  sets: number
  reps_min: number
  reps_max: number
  rpe_target?: number
  rest_seconds: number
  superset_group?: string
  notes?: string
}

interface WorkoutTemplate {
  id: string
  name: string
  description?: string
  category: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'cardio' | 'custom'
  estimated_duration_min: number
  exercises: TemplateExercise[]
  is_favorite: boolean
  is_system: boolean  // Built-in templates
  times_used: number
  last_used?: string
  created_at: string
}

interface WorkoutTemplateLibraryProps {
  onStartWorkout?: (template: WorkoutTemplate) => void
}

// Constants
const CATEGORY_COLORS: Record<string, string> = {
  push: 'bg-red-500/20 text-red-400',
  pull: 'bg-blue-500/20 text-blue-400',
  legs: 'bg-green-500/20 text-green-400',
  upper: 'bg-purple-500/20 text-purple-400',
  lower: 'bg-orange-500/20 text-orange-400',
  full_body: 'bg-amber-500/20 text-amber-400',
  cardio: 'bg-sky-500/20 text-sky-400',
  custom: 'bg-white/10 text-white/60',
}


// Template Card Component
function TemplateCard({
  template,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onSchedule,
}: {
  template: WorkoutTemplate
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onSchedule: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div 
      className="glass rounded-xl p-4 hover:bg-white/[0.03] transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl ${CATEGORY_COLORS[template.category]} flex items-center justify-center flex-shrink-0`}>
          <Dumbbell size={24} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{template.name}</h3>
            {template.is_favorite && (
              <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
          </div>
          
          {template.description && (
            <p className="text-sm text-white/50 mt-0.5 line-clamp-1">{template.description}</p>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Target size={12} />
              {template.exercises.length} exercises
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {template.estimated_duration_min}m
            </span>
            {template.times_used > 0 && (
              <span className="flex items-center gap-1">
                <Zap size={12} />
                Used {template.times_used}x
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={template.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {template.is_favorite ? (
              <Star size={16} className="text-amber-400 fill-amber-400" />
            ) : (
              <StarOff size={16} className="text-white/40" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSchedule(); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
            title="Schedule workout"
          >
            <Calendar size={16} />
          </button>
          {!template.is_system && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                title="Edit template"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-red-400"
                title="Delete template"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Schedule Modal
function ScheduleModal({
  template,
  onClose,
  onSchedule,
}: {
  template: WorkoutTemplate
  onClose: () => void
  onSchedule: (date: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [scheduling, setScheduling] = useState(false)

  const handleSchedule = async () => {
    setScheduling(true)
    await onSchedule(selectedDate)
    setScheduling(false)
  }

  // Generate quick date options
  const today = new Date()
  const quickDates = [
    { label: 'Tomorrow', date: new Date(today.getTime() + 86400000) },
    { label: 'In 2 days', date: new Date(today.getTime() + 2 * 86400000) },
    { label: 'In 3 days', date: new Date(today.getTime() + 3 * 86400000) },
    { label: 'Next Week', date: new Date(today.getTime() + 7 * 86400000) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Schedule Workout</h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-white/50 mt-1">{template.name}</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Quick date buttons */}
          <div className="grid grid-cols-2 gap-2">
            {quickDates.map(({ label, date }) => {
              const dateStr = date.toISOString().split('T')[0]
              return (
                <button
                  key={label}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                    selectedDate === dateStr
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Date picker */}
          <div>
            <label className="text-sm text-white/40 mb-2 block">Or pick a date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              min={today.toISOString().split('T')[0]}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-sm text-white/60">
              Scheduling for{' '}
              <span className="text-white font-medium">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={scheduling}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scheduling ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar size={16} />
                Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Template Detail Modal
function TemplateDetailModal({
  template,
  onClose,
  onStartWorkout,
  onSchedule,
  onDuplicate,
}: {
  template: WorkoutTemplate
  onClose: () => void
  onStartWorkout: () => void
  onSchedule: () => void
  onDuplicate: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl ${CATEGORY_COLORS[template.category]} flex items-center justify-center`}>
              <Dumbbell size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-white/50 mt-0.5">{template.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm text-white/40">
                <span className={`px-2 py-0.5 rounded capitalize ${CATEGORY_COLORS[template.category]}`}>
                  {template.category.replace('_', ' ')}
                </span>
                <span>~{template.estimated_duration_min} min</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Exercises */}
        <div className="p-4 max-h-[50vh] overflow-y-auto">
          <h4 className="text-sm text-white/40 mb-3">Exercises</h4>
          <div className="space-y-2">
            {template.exercises.map((exercise, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
              >
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                  {exercise.superset_group || index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{exercise.exercise_name}</p>
                  <p className="text-sm text-white/50">
                    {exercise.sets} × {exercise.reps_min}
                    {exercise.reps_max !== exercise.reps_min ? `-${exercise.reps_max}` : ''}
                    {exercise.rpe_target ? ` @RPE ${exercise.rpe_target}` : ''}
                    {exercise.notes ? ` (${exercise.notes})` : ''}
                  </p>
                </div>
                <span className="text-xs text-white/40">{exercise.rest_seconds}s rest</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            onClick={onStartWorkout}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Dumbbell size={18} />
            Start Workout
          </button>
          <div className="flex gap-2">
            <button
              onClick={onSchedule}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Calendar size={16} />
              Schedule
            </button>
            <button
              onClick={onDuplicate}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              Duplicate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Template Library Component
export function WorkoutTemplateLibrary({ onStartWorkout }: WorkoutTemplateLibraryProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null)
  const [scheduleTemplate, setScheduleTemplate] = useState<WorkoutTemplate | null>(null)

  // Fetch templates from API
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workout-templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique categories
  const categories = Array.from(new Set(templates.map(t => t.category)))

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !search || 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description?.toLowerCase().includes(search.toLowerCase())
    
    const matchesCategory = !categoryFilter || template.category === categoryFilter
    const matchesFavorites = !showFavoritesOnly || template.is_favorite

    return matchesSearch && matchesCategory && matchesFavorites
  })

  // Sort: favorites first, then by times used
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
    return b.times_used - a.times_used
  })

  const toggleFavorite = async (id: string) => {
    const template = templates.find(t => t.id === id)
    if (!template) return

    // Optimistic update
    setTemplates(prev => prev.map(t =>
      t.id === id ? { ...t, is_favorite: !t.is_favorite } : t
    ))

    try {
      await fetch('/api/workout-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_favorite: !template.is_favorite }),
      })
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      // Revert on error
      setTemplates(prev => prev.map(t =>
        t.id === id ? { ...t, is_favorite: template.is_favorite } : t
      ))
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return

    try {
      const res = await fetch(`/api/workout-templates?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete template')
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Failed to delete template')
    }
  }

  const handleStartWorkout = (template: WorkoutTemplate) => {
    // Increment usage count
    fetch('/api/workout-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id, increment_usage: true }),
    }).catch(console.error)

    if (onStartWorkout) {
      onStartWorkout(template)
    }
    setSelectedTemplate(null)
  }

  const handleSchedule = (template: WorkoutTemplate) => {
    setScheduleTemplate(template)
    setSelectedTemplate(null) // Close detail modal if open
  }

  const scheduleWorkout = async (template: WorkoutTemplate, date: string) => {
    try {
      // Create exercises payload from template
      const exercisesPayload = template.exercises.map((ex, index) => ({
        exercise_id: ex.exercise_id,
        order_index: index,
        superset_group: ex.superset_group || null,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes || '',
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_type: 'working',
          target_reps: ex.reps_max,
          target_weight: null,
          target_rpe: ex.rpe_target || null,
        })),
      }))

      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          workout_type: 'strength',
          category: 'strength',
          scheduled_date: date,
          status: 'planned',
          planned_duration_minutes: template.estimated_duration_min,
          exercises: exercisesPayload,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to schedule workout')
      }

      // Increment template usage
      await fetch('/api/workout-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template.id, increment_usage: true }),
      })

      alert(`"${template.name}" scheduled for ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`)
      setScheduleTemplate(null)
    } catch (error) {
      console.error('Failed to schedule workout:', error)
      alert('Failed to schedule workout. Please try again.')
    }
  }

  const handleDuplicate = async (template: WorkoutTemplate) => {
    try {
      const res = await fetch('/api/workout-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description,
          category: template.category,
          estimated_duration_min: template.estimated_duration_min,
          exercises: template.exercises,
        }),
      })

      if (res.ok) {
        fetchTemplates() // Refresh list
      } else {
        throw new Error('Failed to duplicate')
      }
    } catch (error) {
      console.error('Failed to duplicate template:', error)
      alert('Failed to duplicate template')
    }
    setSelectedTemplate(null)
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Workout Templates</h1>
          <p className="text-white/50">{templates.length} {templates.length === 1 ? 'template' : 'templates'}</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors flex items-center gap-2">
          <Plus size={18} />
          Create Template
        </button>
      </div>

      {/* Search and filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              showFavoritesOnly ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            <Star size={14} />
            Favorites
          </button>
          
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !categoryFilter ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            All
          </button>
          
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize whitespace-nowrap transition-colors ${
                categoryFilter === cat ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Templates grid */}
      <div className="grid gap-3">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="mx-auto text-white/30 animate-spin mb-4" />
            <p className="text-white/40">Loading templates...</p>
          </div>
        ) : sortedTemplates.length > 0 ? (
          sortedTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => setSelectedTemplate(template)}
              onEdit={() => console.log('Edit:', template.id)}
              onDelete={() => deleteTemplate(template.id)}
              onToggleFavorite={() => toggleFavorite(template.id)}
              onSchedule={() => handleSchedule(template)}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <Dumbbell size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">No templates found</p>
            {search && (
              <p className="text-sm text-white/30 mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>

      {/* Template detail modal */}
      {selectedTemplate && (
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onStartWorkout={() => handleStartWorkout(selectedTemplate)}
          onSchedule={() => handleSchedule(selectedTemplate)}
          onDuplicate={() => handleDuplicate(selectedTemplate)}
        />
      )}

      {/* Schedule modal */}
      {scheduleTemplate && (
        <ScheduleModal
          template={scheduleTemplate}
          onClose={() => setScheduleTemplate(null)}
          onSchedule={(date) => scheduleWorkout(scheduleTemplate, date)}
        />
      )}
    </div>
  )
}
