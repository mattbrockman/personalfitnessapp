'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target,
  Plus,
  Sparkles,
  Loader2,
  Calendar,
  ChevronRight,
  Flag,
  AlertCircle,
  Dumbbell,
} from 'lucide-react'
import { PlanTimeline } from './PlanTimeline'
import { AIGeneratePlanModal } from './AIGeneratePlanModal'
import { WeeklyWorkoutView } from './WeeklyWorkoutView'
import { WorkoutEditor } from './WorkoutEditor'
import { BulkScheduleModal } from './BulkScheduleModal'
import { PlanTimelineHeader } from './PlanTimelineHeader'
import { CreateSuggestedWorkoutModal } from './CreateSuggestedWorkoutModal'
import { ConflictResolutionModal } from './ConflictResolutionModal'
import { WeatherDay } from '@/lib/weather'
import { startOfWeek, format } from 'date-fns'
import {
  TrainingPlan,
  TrainingPhase,
  PlanEvent,
  SuggestedWorkout,
  PHASE_COLORS,
  PHASE_LABELS,
  EVENT_TYPE_ICONS,
} from '@/types/training-plan'

type ViewMode = 'timeline' | 'list' | 'workouts'

export function TrainingPlanView() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('workouts')
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<string[]>([])

  // Suggested workouts state
  const [suggestedWorkouts, setSuggestedWorkouts] = useState<SuggestedWorkout[]>([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<SuggestedWorkout | null>(null)
  const [bulkScheduleWorkouts, setBulkScheduleWorkouts] = useState<SuggestedWorkout[] | null>(null)

  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )

  // Add workout modal state
  const [addWorkoutDate, setAddWorkoutDate] = useState<Date | null>(null)

  // Weather state
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([])

  // Conflict resolution state
  const [conflictWorkouts, setConflictWorkouts] = useState<SuggestedWorkout[] | null>(null)
  const [conflicts, setConflicts] = useState<Record<string, any[]>>({})
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)

  // Fetch active plan
  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // First get list of plans to find active one
      const listRes = await fetch('/api/training-plans?status=active&include=details')
      if (!listRes.ok) {
        throw new Error('Failed to fetch plans')
      }

      const { plans } = await listRes.json()

      if (plans && plans.length > 0) {
        // Get the most recent active plan with full details
        const planRes = await fetch(`/api/training-plans/${plans[0].id}`)
        if (!planRes.ok) {
          throw new Error('Failed to fetch plan details')
        }
        const { plan: fullPlan } = await planRes.json()
        setPlan(fullPlan)

        // Auto-expand current phase
        const currentPhase = getCurrentPhase(fullPlan.phases || [])
        if (currentPhase) {
          setExpandedPhases([currentPhase.id])
        }
      } else {
        setPlan(null)
      }
    } catch (err) {
      console.error('Error fetching plan:', err)
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  // Fetch suggested workouts for a plan
  const fetchSuggestedWorkouts = useCallback(async (planId: string) => {
    try {
      setLoadingWorkouts(true)
      const res = await fetch(`/api/training-plans/${planId}/suggested-workouts`)
      if (res.ok) {
        const { suggested_workouts } = await res.json()
        setSuggestedWorkouts(suggested_workouts || [])
      }
    } catch (err) {
      console.error('Error fetching suggested workouts:', err)
    } finally {
      setLoadingWorkouts(false)
    }
  }, [])

  // Fetch workouts when plan is loaded
  useEffect(() => {
    if (plan?.id) {
      fetchSuggestedWorkouts(plan.id)
    }
  }, [plan?.id, fetchSuggestedWorkouts])

  // Fetch weather forecast
  useEffect(() => {
    fetch('/api/weather')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.forecast) {
          setWeatherForecast(data.forecast)
        }
      })
      .catch(err => console.error('Failed to fetch weather:', err))
  }, [])

  // Handle workout edit save
  const handleSaveWorkout = async (workout: SuggestedWorkout) => {
    try {
      const res = await fetch(`/api/suggested-workouts/${workout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout),
      })
      if (res.ok) {
        const { suggested_workout } = await res.json()
        setSuggestedWorkouts(prev =>
          prev.map(w => (w.id === suggested_workout.id ? suggested_workout : w))
        )
      }
    } catch (err) {
      console.error('Error saving workout:', err)
    }
    setEditingWorkout(null)
  }

  // Handle single workout schedule
  const handleScheduleWorkout = async (workout: SuggestedWorkout) => {
    try {
      const res = await fetch(`/api/suggested-workouts/${workout.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        // Update status in local state
        setSuggestedWorkouts(prev =>
          prev.map(w => (w.id === workout.id ? { ...w, status: 'scheduled' as const } : w))
        )
      }
    } catch (err) {
      console.error('Error scheduling workout:', err)
    }
  }

  // Handle workout skip
  const handleSkipWorkout = async (workout: SuggestedWorkout) => {
    try {
      const res = await fetch(`/api/suggested-workouts/${workout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      })
      if (res.ok) {
        setSuggestedWorkouts(prev =>
          prev.map(w => (w.id === workout.id ? { ...w, status: 'skipped' as const } : w))
        )
      }
    } catch (err) {
      console.error('Error skipping workout:', err)
    }
  }

  // Handle schedule week - check for conflicts first
  const handleScheduleWeek = async (workouts: SuggestedWorkout[]) => {
    setIsCheckingConflicts(true)
    setBulkScheduleWorkouts(workouts)

    try {
      // Get unique dates from workouts
      const dates = Array.from(new Set(workouts.map(w => w.suggested_date)))

      // Check for conflicts
      const res = await fetch(`/api/workouts/conflicts?dates=${dates.join(',')}`)
      if (res.ok) {
        const { conflicts: foundConflicts } = await res.json()

        if (Object.keys(foundConflicts).length > 0) {
          // Show conflict resolution modal
          setConflicts(foundConflicts)
          setConflictWorkouts(workouts)
          setBulkScheduleWorkouts(null)
        } else {
          // No conflicts - proceed with bulk schedule directly
          await executeBulkSchedule(workouts.map(w => w.id), [], [])
          setBulkScheduleWorkouts(null)
        }
      }
    } catch (err) {
      console.error('Error checking conflicts:', err)
    } finally {
      setIsCheckingConflicts(false)
    }
  }

  // Execute bulk schedule with conflict resolution options
  const executeBulkSchedule = async (
    workoutIds: string[],
    overwriteWorkoutIds: string[],
    skipSuggestedIds: string[]
  ) => {
    setIsScheduling(true)
    try {
      const res = await fetch('/api/suggested-workouts/schedule-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggested_workout_ids: workoutIds,
          overwrite_workout_ids: overwriteWorkoutIds,
          skip_suggested_ids: skipSuggestedIds,
        }),
      })
      if (res.ok) {
        const scheduledIds = workoutIds.filter(id => !skipSuggestedIds.includes(id))
        // Update scheduled workouts in local state
        setSuggestedWorkouts(prev =>
          prev.map(w =>
            scheduledIds.includes(w.id) ? { ...w, status: 'scheduled' as const } : w
          )
        )
      }
    } catch (err) {
      console.error('Error bulk scheduling:', err)
      throw err
    } finally {
      setIsScheduling(false)
      setConflictWorkouts(null)
      setConflicts({})
    }
  }

  // Handle conflict resolution confirm
  const handleConflictResolutionConfirm = async (options: {
    suggestedWorkoutIds: string[]
    overwriteWorkoutIds: string[]
    skipSuggestedIds: string[]
  }) => {
    await executeBulkSchedule(
      options.suggestedWorkoutIds,
      options.overwriteWorkoutIds,
      options.skipSuggestedIds
    )
  }

  // Legacy bulk schedule (from modal)
  const handleBulkSchedule = async (workoutIds: string[]) => {
    await executeBulkSchedule(workoutIds, [], [])
    setBulkScheduleWorkouts(null)
  }

  // Handle moving a workout to a different day (drag-and-drop)
  const handleMoveWorkout = async (workoutId: string, newDate: string, newDayOfWeek: string) => {
    // Optimistic update
    setSuggestedWorkouts(prev =>
      prev.map(w =>
        w.id === workoutId
          ? { ...w, suggested_date: newDate, day_of_week: newDayOfWeek }
          : w
      )
    )

    try {
      const res = await fetch(`/api/suggested-workouts/${workoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggested_date: newDate, day_of_week: newDayOfWeek }),
      })
      if (!res.ok) {
        // Rollback on error
        if (plan?.id) fetchSuggestedWorkouts(plan.id)
      }
    } catch (err) {
      console.error('Error moving workout:', err)
      if (plan?.id) fetchSuggestedWorkouts(plan.id)
    }
  }

  // Handle adding a new workout to a day
  const handleAddWorkout = (date: Date) => {
    setAddWorkoutDate(date)
  }

  // Handle workout created from modal
  const handleWorkoutCreated = (workout: SuggestedWorkout) => {
    setSuggestedWorkouts(prev => [...prev, workout])
    setAddWorkoutDate(null)
  }

  // Get current phase based on today's date
  const getCurrentPhase = (phases: TrainingPhase[]): TrainingPhase | null => {
    const today = new Date().toISOString().split('T')[0]
    return phases.find(p => p.start_date <= today && p.end_date >= today) || null
  }

  // Handle AI plan generation complete
  const handlePlanGenerated = (newPlan: TrainingPlan) => {
    setPlan(newPlan)
    setShowAIGenerator(false)
    if (newPlan.phases && newPlan.phases.length > 0) {
      const currentPhase = getCurrentPhase(newPlan.phases)
      if (currentPhase) {
        setExpandedPhases([currentPhase.id])
      }
    }
  }

  // Toggle phase expansion
  const togglePhaseExpansion = (phaseId: string) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId)
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-amber-400 animate-spin mb-4" />
          <p className="text-white/60">Loading training plan...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <div className="glass rounded-xl p-6 text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Error Loading Plan</h2>
          <p className="text-white/60 mb-4">{error}</p>
          <button
            onClick={fetchPlan}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state - no plan exists
  if (!plan) {
    return (
      <div className="p-4 lg:p-6">
        <div className="text-center py-16">
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Target size={48} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-display font-semibold mb-3">
            Create Your Training Plan
          </h1>
          <p className="text-white/50 mb-8 max-w-md mx-auto">
            Build a periodized training plan that balances your activities,
            peaks for your events, and adjusts for vacations and recovery.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowAIGenerator(true)}
              className="px-6 py-3 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Generate with AI
            </button>
            <button
              onClick={() => {/* TODO: Manual create */}}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Create Manually
            </button>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <FeatureCard
              icon="📅"
              title="Periodized Phases"
              description="Base, build, peak, taper, and recovery phases structured for optimal gains"
            />
            <FeatureCard
              icon="🎯"
              title="Event Peaking"
              description="Automatically taper for A-priority races and competitions"
            />
            <FeatureCard
              icon="⚖️"
              title="Activity Balance"
              description="Smart balancing between strength, cardio, and sports"
            />
          </div>
        </div>

        {showAIGenerator && (
          <AIGeneratePlanModal
            onClose={() => setShowAIGenerator(false)}
            onPlanGenerated={handlePlanGenerated}
          />
        )}
      </div>
    )
  }

  // Plan exists - show plan view
  const currentPhase = getCurrentPhase(plan.phases || [])
  const upcomingEvents = (plan.events || [])
    .filter(e => e.event_date >= new Date().toISOString().split('T')[0])
    .slice(0, 3)

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">{plan.name}</h1>
          {plan.description && (
            <p className="text-white/50 text-sm mt-1">{plan.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIGenerator(true)}
            className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm flex items-center gap-2"
          >
            <Sparkles size={16} />
            Regenerate
          </button>
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('workouts')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 ${
                viewMode === 'workouts' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Dumbbell size={14} />
              Workouts
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'timeline' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'list' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Current Phase Card */}
      {currentPhase && (
        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${PHASE_COLORS[currentPhase.phase_type]}`} />
            <div>
              <p className="text-sm text-white/50">Current Phase</p>
              <p className="font-semibold">
                {currentPhase.name}
                <span className="text-white/50 font-normal ml-2">
                  ({PHASE_LABELS[currentPhase.phase_type]})
                </span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-white/50">Volume</p>
              <p className="font-semibold">
                {Math.round(currentPhase.volume_modifier * 100)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Weekly Target"
          value={plan.weekly_hours_target ? `${plan.weekly_hours_target}h` : '—'}
        />
        <StatCard
          label="Total Phases"
          value={String(plan.phases?.length || 0)}
        />
        <StatCard
          label="Upcoming Events"
          value={String(upcomingEvents.length)}
        />
        <StatCard
          label="Plan Duration"
          value={plan.end_date ? formatDuration(plan.start_date, plan.end_date) : 'Rolling'}
        />
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="glass rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
            <Flag size={16} />
            Upcoming Events
          </h3>
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{EVENT_TYPE_ICONS[event.event_type]}</span>
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-white/50">
                      {formatDate(event.event_date)}
                      {event.location && ` • ${event.location}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  event.priority === 'A' ? 'bg-red-500/20 text-red-400' :
                  event.priority === 'B' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-white/10 text-white/60'
                }`}>
                  {event.priority}-Priority
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Content */}
      {viewMode === 'workouts' && (
        <>
          {/* Timeline Header */}
          <PlanTimelineHeader
            phases={plan.phases || []}
            planStartDate={plan.start_date}
            planEndDate={plan.end_date}
            currentWeekStart={currentWeekStart}
            onWeekSelect={setCurrentWeekStart}
          />

          <WeeklyWorkoutView
            planId={plan.id}
            suggestedWorkouts={suggestedWorkouts}
            phases={plan.phases || []}
            currentWeekStart={currentWeekStart}
            onWeekChange={setCurrentWeekStart}
            onEdit={setEditingWorkout}
            onSchedule={handleScheduleWorkout}
            onScheduleWeek={handleScheduleWeek}
            onSkip={handleSkipWorkout}
            onRefresh={() => fetchSuggestedWorkouts(plan.id)}
            onAddWorkout={handleAddWorkout}
            onMoveWorkout={handleMoveWorkout}
            isLoading={loadingWorkouts || isCheckingConflicts}
          />
        </>
      )}

      {viewMode === 'timeline' && (
        <PlanTimeline
          phases={plan.phases || []}
          events={plan.events || []}
          expandedPhases={expandedPhases}
          onTogglePhase={togglePhaseExpansion}
        />
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
          {(plan.phases || []).map(phase => (
            <PhaseListCard
              key={phase.id}
              phase={phase}
              isExpanded={expandedPhases.includes(phase.id)}
              onToggle={() => togglePhaseExpansion(phase.id)}
              isCurrent={currentPhase?.id === phase.id}
            />
          ))}
        </div>
      )}

      {/* AI Generator Modal */}
      {showAIGenerator && (
        <AIGeneratePlanModal
          onClose={() => setShowAIGenerator(false)}
          onPlanGenerated={handlePlanGenerated}
          existingPlan={plan}
        />
      )}

      {/* Workout Editor Modal */}
      {editingWorkout && (
        <WorkoutEditor
          workout={editingWorkout}
          onSave={handleSaveWorkout}
          onClose={() => setEditingWorkout(null)}
        />
      )}

      {/* Bulk Schedule Modal */}
      {bulkScheduleWorkouts && (
        <BulkScheduleModal
          workouts={bulkScheduleWorkouts}
          onSchedule={handleBulkSchedule}
          onClose={() => setBulkScheduleWorkouts(null)}
          onUpdateWorkoutDate={async (workoutId, newDate) => {
            const dayOfWeek = format(new Date(newDate), 'EEEE').toLowerCase()
            await handleMoveWorkout(workoutId, newDate, dayOfWeek)
          }}
        />
      )}

      {/* Add Workout Modal */}
      {addWorkoutDate && plan && (
        <CreateSuggestedWorkoutModal
          planId={plan.id}
          date={addWorkoutDate}
          weather={weatherForecast.find(w => w.date === format(addWorkoutDate, 'yyyy-MM-dd'))}
          onCreated={handleWorkoutCreated}
          onClose={() => setAddWorkoutDate(null)}
        />
      )}

      {/* Conflict Resolution Modal */}
      {conflictWorkouts && (
        <ConflictResolutionModal
          suggestedWorkouts={conflictWorkouts}
          conflicts={conflicts}
          onConfirm={handleConflictResolutionConfirm}
          onClose={() => {
            setConflictWorkouts(null)
            setConflicts({})
          }}
          isSubmitting={isScheduling}
        />
      )}
    </div>
  )
}

// Helper Components
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="glass rounded-xl p-4 text-left">
      <span className="text-2xl">{icon}</span>
      <h3 className="font-semibold mt-2 mb-1">{title}</h3>
      <p className="text-sm text-white/50">{description}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function PhaseListCard({
  phase,
  isExpanded,
  onToggle,
  isCurrent,
}: {
  phase: TrainingPhase
  isExpanded: boolean
  onToggle: () => void
  isCurrent: boolean
}) {
  return (
    <div className={`glass rounded-xl overflow-hidden ${isCurrent ? 'ring-2 ring-amber-500/50' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
      >
        <div className={`w-4 h-4 rounded-full ${PHASE_COLORS[phase.phase_type]}`} />
        <div className="flex-1 text-left">
          <p className="font-semibold">{phase.name}</p>
          <p className="text-sm text-white/50">
            {formatDateRange(phase.start_date, phase.end_date)}
          </p>
        </div>
        {isCurrent && (
          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
            Current
          </span>
        )}
        <ChevronRight
          size={20}
          className={`text-white/40 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-white/50">Phase Type</p>
              <p className="font-medium">{PHASE_LABELS[phase.phase_type]}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Volume</p>
              <p className="font-medium">{Math.round(phase.volume_modifier * 100)}%</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Intensity</p>
              <p className="font-medium">{Math.round(phase.intensity_modifier * 100)}%</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Focus</p>
              <p className="font-medium capitalize">{phase.intensity_focus || 'Balanced'}</p>
            </div>
          </div>

          {phase.description && (
            <p className="text-sm text-white/60 mt-4">{phase.description}</p>
          )}

          {/* Activity Distribution */}
          {phase.activity_distribution && Object.keys(phase.activity_distribution).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/50 mb-2">Activity Distribution</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(phase.activity_distribution).map(([activity, pct]) => (
                  <span
                    key={activity}
                    className="px-2 py-1 bg-white/10 rounded text-xs"
                  >
                    {activity}: {pct}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper functions
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startStr} - ${endStr}`
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = endDate.getTime() - startDate.getTime()
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
  return `${diffWeeks} weeks`
}
