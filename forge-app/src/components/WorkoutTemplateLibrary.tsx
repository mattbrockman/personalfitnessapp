'use client'

import { useState } from 'react'
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

// Mock templates
const MOCK_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'push1',
    name: 'Push Day A - Chest Focus',
    description: 'Horizontal push emphasis with tricep accessories',
    category: 'push',
    estimated_duration_min: 60,
    is_favorite: true,
    is_system: true,
    times_used: 12,
    last_used: '2024-12-28',
    created_at: '2024-01-01',
    exercises: [
      { exercise_id: '1', exercise_name: 'Barbell Bench Press', sets: 4, reps_min: 6, reps_max: 8, rpe_target: 8, rest_seconds: 180 },
      { exercise_id: '2', exercise_name: 'Incline Dumbbell Press', sets: 3, reps_min: 8, reps_max: 10, rpe_target: 8, rest_seconds: 120 },
      { exercise_id: '3', exercise_name: 'Cable Flyes', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 90 },
      { exercise_id: '4', exercise_name: 'Overhead Press', sets: 3, reps_min: 8, reps_max: 10, rpe_target: 7, rest_seconds: 120 },
      { exercise_id: '5', exercise_name: 'Tricep Pushdown', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60, superset_group: 'A' },
      { exercise_id: '6', exercise_name: 'Lateral Raise', sets: 3, reps_min: 15, reps_max: 20, rest_seconds: 60, superset_group: 'A' },
    ],
  },
  {
    id: 'pull1',
    name: 'Pull Day A - Back Focus',
    description: 'Vertical and horizontal pulls with bicep work',
    category: 'pull',
    estimated_duration_min: 55,
    is_favorite: true,
    is_system: true,
    times_used: 10,
    last_used: '2024-12-27',
    created_at: '2024-01-01',
    exercises: [
      { exercise_id: '7', exercise_name: 'Pull-Ups', sets: 4, reps_min: 6, reps_max: 10, rpe_target: 8, rest_seconds: 180 },
      { exercise_id: '8', exercise_name: 'Barbell Row', sets: 4, reps_min: 6, reps_max: 8, rpe_target: 8, rest_seconds: 150 },
      { exercise_id: '9', exercise_name: 'Seated Cable Row', sets: 3, reps_min: 10, reps_max: 12, rest_seconds: 90 },
      { exercise_id: '10', exercise_name: 'Face Pulls', sets: 3, reps_min: 15, reps_max: 20, rest_seconds: 60 },
      { exercise_id: '11', exercise_name: 'Barbell Curl', sets: 3, reps_min: 10, reps_max: 12, rest_seconds: 60, superset_group: 'A' },
      { exercise_id: '12', exercise_name: 'Hammer Curls', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60, superset_group: 'A' },
    ],
  },
  {
    id: 'legs1',
    name: 'Leg Day A - Quad Focus',
    description: 'Squat-based leg day with quad emphasis',
    category: 'legs',
    estimated_duration_min: 65,
    is_favorite: true,
    is_system: true,
    times_used: 8,
    last_used: '2024-12-26',
    created_at: '2024-01-01',
    exercises: [
      { exercise_id: '13', exercise_name: 'Barbell Back Squat', sets: 4, reps_min: 5, reps_max: 6, rpe_target: 8, rest_seconds: 180 },
      { exercise_id: '14', exercise_name: 'Leg Press', sets: 3, reps_min: 10, reps_max: 12, rest_seconds: 120 },
      { exercise_id: '15', exercise_name: 'Walking Lunges', sets: 3, reps_min: 10, reps_max: 12, notes: 'per leg', rest_seconds: 90 },
      { exercise_id: '16', exercise_name: 'Leg Extension', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60 },
      { exercise_id: '17', exercise_name: 'Leg Curl', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60 },
      { exercise_id: '18', exercise_name: 'Calf Raises', sets: 4, reps_min: 12, reps_max: 15, rest_seconds: 45 },
    ],
  },
  {
    id: 'legs2',
    name: 'Leg Day B - Posterior Chain',
    description: 'Deadlift-based with hamstring and glute focus',
    category: 'legs',
    estimated_duration_min: 60,
    is_favorite: false,
    is_system: true,
    times_used: 6,
    created_at: '2024-01-01',
    exercises: [
      { exercise_id: '19', exercise_name: 'Deadlift', sets: 4, reps_min: 4, reps_max: 5, rpe_target: 8, rest_seconds: 180 },
      { exercise_id: '20', exercise_name: 'Romanian Deadlift', sets: 3, reps_min: 8, reps_max: 10, rest_seconds: 120 },
      { exercise_id: '21', exercise_name: 'Hip Thrust', sets: 3, reps_min: 10, reps_max: 12, rest_seconds: 90 },
      { exercise_id: '22', exercise_name: 'Leg Curl', sets: 3, reps_min: 12, reps_max: 15, rest_seconds: 60 },
      { exercise_id: '23', exercise_name: 'Glute Bridge', sets: 3, reps_min: 15, reps_max: 20, rest_seconds: 45 },
    ],
  },
  {
    id: 'upper1',
    name: 'Upper Body - Strength',
    description: 'Compound-focused upper body for strength',
    category: 'upper',
    estimated_duration_min: 70,
    is_favorite: false,
    is_system: true,
    times_used: 4,
    created_at: '2024-01-01',
    exercises: [
      { exercise_id: '1', exercise_name: 'Barbell Bench Press', sets: 4, reps_min: 5, reps_max: 6, rpe_target: 8, rest_seconds: 180 },
      { exercise_id: '7', exercise_name: 'Pull-Ups', sets: 4, reps_min: 6, reps_max: 8, rest_seconds: 150 },
      { exercise_id: '4', exercise_name: 'Overhead Press', sets: 3, reps_min: 6, reps_max: 8, rpe_target: 8, rest_seconds: 150 },
      { exercise_id: '8', exercise_name: 'Barbell Row', sets: 3, reps_min: 6, reps_max: 8, rest_seconds: 120 },
      { exercise_id: '24', exercise_name: 'Dips', sets: 3, reps_min: 8, reps_max: 10, rest_seconds: 90 },
      { exercise_id: '25', exercise_name: 'Chin-Ups', sets: 3, reps_min: 8, reps_max: 10, rest_seconds: 90 },
    ],
  },
]

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
export function WorkoutTemplateLibrary() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(MOCK_TEMPLATES)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null)

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

  const toggleFavorite = (id: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, is_favorite: !t.is_favorite } : t
    ))
  }

  const deleteTemplate = (id: string) => {
    if (confirm('Delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleStartWorkout = (template: WorkoutTemplate) => {
    // Would navigate to lifting tracker with template loaded
    console.log('Starting workout with template:', template.name)
    setSelectedTemplate(null)
  }

  const handleSchedule = (template: WorkoutTemplate) => {
    // Would open date picker and add to calendar
    console.log('Scheduling template:', template.name)
  }

  const handleDuplicate = (template: WorkoutTemplate) => {
    const duplicate: WorkoutTemplate = {
      ...template,
      id: `${template.id}-copy-${Date.now()}`,
      name: `${template.name} (Copy)`,
      is_system: false,
      is_favorite: false,
      times_used: 0,
      created_at: new Date().toISOString(),
    }
    setTemplates(prev => [...prev, duplicate])
    setSelectedTemplate(null)
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Workout Templates</h1>
          <p className="text-white/50">{templates.length} templates</p>
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
        {sortedTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => setSelectedTemplate(template)}
            onEdit={() => console.log('Edit:', template.id)}
            onDelete={() => deleteTemplate(template.id)}
            onToggleFavorite={() => toggleFavorite(template.id)}
            onSchedule={() => handleSchedule(template)}
          />
        ))}

        {sortedTemplates.length === 0 && (
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
    </div>
  )
}
