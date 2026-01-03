'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  X,
  Dumbbell,
  ChevronDown,
  Play,
  Info,
  Loader2,
  Plus,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { EquipmentIcon } from '@/lib/equipment-icons'

interface Exercise {
  id: string
  name: string
  description: string | null
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string
  difficulty: string | null
  instructions: string | null
  cues: string[]
  common_mistakes: string[]
  is_compound: boolean | null
  is_unilateral: boolean | null
  video_url: string | null
  thumbnail_url: string | null
  body_part: string | null
  galpin_adaptations: string[]
}

interface FilterOptions {
  muscle_groups: string[]
  equipment: string[]
  body_parts: string[]
  difficulties: string[]
  adaptations: string[]
}

const ADAPTATION_LABELS: Record<string, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  power: 'Power',
  speed: 'Speed',
  muscular_endurance: 'Muscular Endurance',
  anaerobic_capacity: 'Anaerobic',
  vo2max: 'VO2max',
  long_duration: 'Endurance',
  flexibility: 'Flexibility',
}

const BODY_PART_LABELS: Record<string, string> = {
  back: 'Back',
  chest: 'Chest',
  shoulders: 'Shoulders',
  'upper arms': 'Arms',
  'lower arms': 'Forearms',
  'upper legs': 'Legs',
  'lower legs': 'Calves',
  waist: 'Core',
  cardio: 'Cardio',
  neck: 'Neck',
}

export function ExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false) // Subtle indicator for search
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)

  // Debounce search to prevent flickering
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Filter state
  const [filters, setFilters] = useState({
    bodyPart: '',
    equipment: '',
    difficulty: '',
    adaptation: '',
    isCompound: '',
  })

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions()
    fetchExercises()
  }, [])

  // Fetch exercises when debounced search or filters change
  useEffect(() => {
    if (debouncedSearch !== '' || Object.values(filters).some(Boolean)) {
      fetchExercises()
    }
  }, [filters, debouncedSearch])

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/exercises', { method: 'OPTIONS' })
      if (response.ok) {
        const data = await response.json()
        setFilterOptions(data)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchExercises = useCallback(async () => {
    // Only show full loading on initial load
    if (exercises.length === 0) {
      setLoading(true)
    } else {
      setIsSearching(true)
    }

    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (filters.bodyPart) params.append('body_part', filters.bodyPart)
      if (filters.equipment) params.append('equipment', filters.equipment)
      if (filters.difficulty) params.append('difficulty', filters.difficulty)
      if (filters.adaptation) params.append('adaptation', filters.adaptation)
      if (filters.isCompound) params.append('is_compound', filters.isCompound)
      params.append('limit', '200')

      const response = await fetch(`/api/exercises?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setExercises(data.exercises || [])
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    } finally {
      setLoading(false)
      setIsSearching(false)
    }
  }, [debouncedSearch, filters])

  const clearFilters = () => {
    setFilters({
      bodyPart: '',
      equipment: '',
      difficulty: '',
      adaptation: '',
      isCompound: '',
    })
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold mb-2">Exercise Library</h1>
        <p className="text-white/60">
          Browse {exercises.length} exercises with demonstrations and coaching cues
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          />
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-secondary focus:outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          }`}
        >
          <Filter size={18} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-violet-500 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && filterOptions && (
        <div className="glass rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Body Part Filter */}
            <div>
              <label className="block text-xs text-secondary mb-1">Body Part</label>
              <select
                value={filters.bodyPart}
                onChange={(e) => setFilters({ ...filters, bodyPart: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="">All</option>
                {filterOptions.body_parts.map((bp) => (
                  <option key={bp} value={bp}>
                    {BODY_PART_LABELS[bp] || bp}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment Filter */}
            <div>
              <label className="block text-xs text-secondary mb-1">Equipment</label>
              <select
                value={filters.equipment}
                onChange={(e) => setFilters({ ...filters, equipment: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="">All</option>
                {filterOptions.equipment.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-xs text-secondary mb-1">Difficulty</label>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="">All</option>
                {filterOptions.difficulties.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Adaptation Filter */}
            <div>
              <label className="block text-xs text-secondary mb-1">Training Goal</label>
              <select
                value={filters.adaptation}
                onChange={(e) => setFilters({ ...filters, adaptation: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="">All</option>
                {filterOptions.adaptations.map((a) => (
                  <option key={a} value={a}>
                    {ADAPTATION_LABELS[a] || a}
                  </option>
                ))}
              </select>
            </div>

            {/* Compound/Isolation Filter */}
            <div>
              <label className="block text-xs text-secondary mb-1">Type</label>
              <select
                value={filters.isCompound}
                onChange={(e) => setFilters({ ...filters, isCompound: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="">All</option>
                <option value="true">Compound</option>
                <option value="false">Isolation</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-secondary" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell size={48} className="mx-auto mb-4 text-white/20" />
          <p className="text-secondary">No exercises found</p>
          <p className="text-sm text-muted mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
        {/* Subtle searching indicator */}
        {isSearching && (
          <div className="flex items-center gap-2 text-xs text-secondary mb-4">
            <Loader2 size={12} className="animate-spin" />
            Searching...
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onClick={() => setSelectedExercise(exercise)}
            />
          ))}
        </div>
        </>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      )}
    </div>
  )
}

// Exercise Card Component
function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: Exercise
  onClick: () => void
}) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Show GIF only on hover, otherwise show static thumbnail (or placeholder if none)
  const displayUrl = isHovered
    ? exercise.video_url
    : exercise.thumbnail_url

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="glass rounded-xl overflow-hidden text-left transition-all hover:scale-[1.02] hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
    >
      {/* GIF/Thumbnail - static by default, animated on hover */}
      <div className="aspect-video bg-black relative">
        {displayUrl && !imageError ? (
          <img
            src={displayUrl}
            alt={exercise.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5">
            <EquipmentIcon equipment={exercise.equipment} size={32} className="opacity-40" />
          </div>
        )}

        {/* Play indicator when not hovering and has GIF */}
        {exercise.video_url && !isHovered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={18} className="text-white/80 ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-1">{exercise.name}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-violet-400 capitalize">
            {exercise.primary_muscle?.replace(/_/g, ' ')}
          </span>
          {exercise.equipment && (
            <>
              <span className="text-white/20">•</span>
              <span className="text-xs text-secondary capitalize">
                {exercise.equipment.replace(/_/g, ' ')}
              </span>
            </>
          )}
          {exercise.difficulty && (
            <>
              <span className="text-white/20">•</span>
              <span className="text-xs text-secondary capitalize">
                {exercise.difficulty}
              </span>
            </>
          )}
        </div>

        {/* Adaptation Tags */}
        {exercise.galpin_adaptations && exercise.galpin_adaptations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {exercise.galpin_adaptations.slice(0, 3).map((a) => (
              <span
                key={a}
                className="px-1.5 py-0.5 bg-white/5 rounded text-xs text-tertiary"
              >
                {ADAPTATION_LABELS[a] || a}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

// Exercise Detail Modal
function ExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: Exercise
  onClose: () => void
}) {
  const [imageError, setImageError] = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">{exercise.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
          {/* GIF/Image */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
            {(exercise.video_url || exercise.thumbnail_url) && !imageError ? (
              <img
                src={exercise.video_url || exercise.thumbnail_url || ''}
                alt={exercise.name}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5">
                <EquipmentIcon equipment={exercise.equipment} size={48} className="opacity-40" />
              </div>
            )}
            {/* Badge for static vs animated */}
            {!exercise.video_url && exercise.thumbnail_url && (
              <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white/60">
                Static image
              </span>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            {exercise.difficulty && (
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  exercise.difficulty === 'beginner'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : exercise.difficulty === 'intermediate'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                }`}
              >
                {exercise.difficulty}
              </span>
            )}
            {exercise.is_compound !== null && (
              <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/60">
                {exercise.is_compound ? 'Compound' : 'Isolation'}
              </span>
            )}
            {exercise.is_unilateral && (
              <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/60">
                Unilateral
              </span>
            )}
          </div>

          {/* Muscles */}
          <div className="flex gap-4">
            <div>
              <h4 className="text-xs text-secondary mb-1">Primary</h4>
              <span className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-sm capitalize">
                {exercise.primary_muscle?.replace(/_/g, ' ')}
              </span>
            </div>
            {exercise.secondary_muscles && exercise.secondary_muscles.length > 0 && (
              <div>
                <h4 className="text-xs text-secondary mb-1">Secondary</h4>
                <div className="flex flex-wrap gap-1">
                  {exercise.secondary_muscles.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-1 bg-white/10 text-white/60 rounded text-sm capitalize"
                    >
                      {m.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Adaptations */}
          {exercise.galpin_adaptations && exercise.galpin_adaptations.length > 0 && (
            <div>
              <h4 className="text-xs text-secondary mb-2">Training Adaptations</h4>
              <div className="flex flex-wrap gap-2">
                {exercise.galpin_adaptations.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-1 bg-sky-500/20 text-sky-400 rounded text-sm"
                  >
                    {ADAPTATION_LABELS[a] || a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {exercise.description && (
            <div>
              <h4 className="text-xs text-secondary mb-1">Description</h4>
              <p className="text-sm text-white/70">{exercise.description}</p>
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

          {/* Common Mistakes */}
          {exercise.common_mistakes && exercise.common_mistakes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2">Common Mistakes</h4>
              <ul className="space-y-2">
                {exercise.common_mistakes.map((mistake, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="text-red-500 mt-1">✕</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {exercise.instructions && (
            <div>
              <h4 className="text-xs text-secondary mb-1">Instructions</h4>
              <p className="text-sm text-white/70">{exercise.instructions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
