'use client'

import { useState } from 'react'
import {
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Calendar,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import {
  TrainingPlan,
  PlanGoal,
  ActivityType,
  EventType,
  EventPriority,
  AIGeneratePlanRequest,
  ACTIVITY_LABELS,
} from '@/types/training-plan'

interface AIGeneratePlanModalProps {
  onClose: () => void
  onPlanGenerated: (plan: TrainingPlan) => void
  existingPlan?: TrainingPlan
}

type WizardStep = 'goal' | 'activities' | 'events' | 'preferences' | 'generating' | 'review'

const GOAL_OPTIONS: { value: PlanGoal; label: string; description: string }[] = [
  { value: 'strength', label: 'Build Strength', description: 'Focus on increasing muscle mass and strength' },
  { value: 'endurance', label: 'Build Endurance', description: 'Improve cardiovascular fitness and stamina' },
  { value: 'event_prep', label: 'Event Preparation', description: 'Peak for specific races or competitions' },
  { value: 'general_fitness', label: 'General Fitness', description: 'Balanced approach to overall fitness' },
  { value: 'weight_loss', label: 'Weight Loss', description: 'Optimize training for fat loss while maintaining muscle' },
]

const ACTIVITY_OPTIONS: ActivityType[] = [
  'cycling', 'running', 'swimming', 'lifting', 'soccer', 'tennis', 'skiing'
]

export function AIGeneratePlanModal({
  onClose,
  onPlanGenerated,
  existingPlan,
}: AIGeneratePlanModalProps) {
  const [step, setStep] = useState<WizardStep>('goal')
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [goal, setGoal] = useState<PlanGoal>('general_fitness')
  const [activities, setActivities] = useState<ActivityType[]>(['lifting', 'cycling'])
  const [weeklyHours, setWeeklyHours] = useState(8)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [events, setEvents] = useState<Array<{
    id: string
    name: string
    date: string
    event_type: EventType
    priority: EventPriority
    sport?: ActivityType
  }>>([])
  const [vacations, setVacations] = useState<Array<{
    id: string
    start: string
    end: string
    name: string
  }>>([])
  const [deloadFrequency, setDeloadFrequency] = useState(4)
  const [customPrompt, setCustomPrompt] = useState('')

  // Generated plan preview
  const [generatedPlan, setGeneratedPlan] = useState<TrainingPlan | null>(null)
  const [reasoning, setReasoning] = useState('')

  // Toggle activity
  const toggleActivity = (activity: ActivityType) => {
    setActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    )
  }

  // Add event
  const addEvent = () => {
    setEvents(prev => [...prev, {
      id: `event-${Date.now()}`,
      name: '',
      date: '',
      event_type: 'race',
      priority: 'B',
    }])
  }

  // Remove event
  const removeEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // Add vacation
  const addVacation = () => {
    setVacations(prev => [...prev, {
      id: `vac-${Date.now()}`,
      start: '',
      end: '',
      name: '',
    }])
  }

  // Remove vacation
  const removeVacation = (id: string) => {
    setVacations(prev => prev.filter(v => v.id !== id))
  }

  // Generate plan
  const handleGenerate = async () => {
    setStep('generating')
    setError(null)

    try {
      const request: AIGeneratePlanRequest = {
        goal,
        primary_activities: activities,
        weekly_hours_available: weeklyHours,
        start_date: startDate,
        end_date: endDate || undefined,
        events: events.filter(e => e.name && e.date).map(e => ({
          name: e.name,
          date: e.date,
          event_type: e.event_type,
          priority: e.priority,
          sport: e.sport,
        })),
        preferences: {
          preferred_deload_frequency: deloadFrequency,
          vacation_dates: vacations.filter(v => v.start && v.end).map(v => ({
            start: v.start,
            end: v.end,
            name: v.name,
          })),
        },
        custom_prompt: customPrompt || undefined,
      }

      const res = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate plan')
      }

      const data = await res.json()
      setGeneratedPlan(data.plan)
      setReasoning(data.reasoning || '')
      setStep('review')
    } catch (err) {
      console.error('Plan generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
      setStep('preferences') // Go back to last step
    }
  }

  // Save plan
  const handleSavePlan = async () => {
    if (!generatedPlan) return

    try {
      // The plan is already saved by the generate endpoint
      onPlanGenerated(generatedPlan)
    } catch (err) {
      console.error('Error saving plan:', err)
      setError('Failed to save plan')
    }
  }

  // Navigate steps
  const goNext = () => {
    const steps: WizardStep[] = ['goal', 'activities', 'events', 'preferences']
    const currentIndex = steps.indexOf(step as any)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    } else {
      handleGenerate()
    }
  }

  const goBack = () => {
    const steps: WizardStep[] = ['goal', 'activities', 'events', 'preferences']
    const currentIndex = steps.indexOf(step as any)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Sparkles size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold">AI Training Plan Generator</h2>
              <p className="text-sm text-white/50">
                {step === 'goal' && 'Step 1: Choose your goal'}
                {step === 'activities' && 'Step 2: Select activities'}
                {step === 'events' && 'Step 3: Add events & vacations'}
                {step === 'preferences' && 'Step 4: Set preferences'}
                {step === 'generating' && 'Generating your plan...'}
                {step === 'review' && 'Review your plan'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step: Goal */}
          {step === 'goal' && (
            <div className="space-y-4">
              <p className="text-white/60">What's your primary training goal?</p>
              <div className="space-y-3">
                {GOAL_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setGoal(option.value)}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      goal === option.value
                        ? 'bg-violet-500/20 border border-violet-500/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-white/50">{option.description}</p>
                      </div>
                      {goal === option.value && (
                        <Check size={20} className="text-violet-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Activities */}
          {step === 'activities' && (
            <div className="space-y-6">
              <div>
                <p className="text-white/60 mb-4">Select all activities you want to include:</p>
                <div className="grid grid-cols-2 gap-3">
                  {ACTIVITY_OPTIONS.map(activity => (
                    <button
                      key={activity}
                      onClick={() => toggleActivity(activity)}
                      className={`p-3 rounded-xl text-left transition-colors ${
                        activities.includes(activity)
                          ? 'bg-amber-500/20 border border-amber-500/50'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{ACTIVITY_LABELS[activity]}</span>
                        {activities.includes(activity) && (
                          <Check size={16} className="text-amber-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Weekly training hours available
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={weeklyHours}
                    onChange={e => setWeeklyHours(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xl font-semibold w-16 text-right">{weeklyHours}h</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    End Date <span className="text-white/40">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Events */}
          {step === 'events' && (
            <div className="space-y-6">
              {/* Target Events */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/60">Target Events (races, competitions)</p>
                  <button
                    onClick={addEvent}
                    className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add Event
                  </button>
                </div>

                {events.length === 0 ? (
                  <p className="text-sm text-white/40 p-4 bg-white/5 rounded-lg text-center">
                    No events added. Add target events to optimize peaking.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {events.map(event => (
                      <div key={event.id} className="p-3 bg-white/5 rounded-lg">
                        <div className="flex gap-3">
                          <input
                            type="text"
                            placeholder="Event name"
                            value={event.name}
                            onChange={e => setEvents(prev => prev.map(ev =>
                              ev.id === event.id ? { ...ev, name: e.target.value } : ev
                            ))}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                          />
                          <input
                            type="date"
                            value={event.date}
                            onChange={e => setEvents(prev => prev.map(ev =>
                              ev.id === event.id ? { ...ev, date: e.target.value } : ev
                            ))}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => removeEvent(event.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <select
                            value={event.priority}
                            onChange={e => setEvents(prev => prev.map(ev =>
                              ev.id === event.id ? { ...ev, priority: e.target.value as EventPriority } : ev
                            ))}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                          >
                            <option value="A">A Priority (Peak)</option>
                            <option value="B">B Priority</option>
                            <option value="C">C Priority</option>
                          </select>
                          <select
                            value={event.event_type}
                            onChange={e => setEvents(prev => prev.map(ev =>
                              ev.id === event.id ? { ...ev, event_type: e.target.value as EventType } : ev
                            ))}
                            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                          >
                            <option value="race">Race</option>
                            <option value="competition">Competition</option>
                            <option value="test">Fitness Test</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vacations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/60">Vacations / Time Off</p>
                  <button
                    onClick={addVacation}
                    className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add Vacation
                  </button>
                </div>

                {vacations.length === 0 ? (
                  <p className="text-sm text-white/40 p-4 bg-white/5 rounded-lg text-center">
                    No vacations added. Add time off to adjust the plan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vacations.map(vac => (
                      <div key={vac.id} className="p-3 bg-white/5 rounded-lg flex gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Name (optional)"
                          value={vac.name}
                          onChange={e => setVacations(prev => prev.map(v =>
                            v.id === vac.id ? { ...v, name: e.target.value } : v
                          ))}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={vac.start}
                          onChange={e => setVacations(prev => prev.map(v =>
                            v.id === vac.id ? { ...v, start: e.target.value } : v
                          ))}
                          className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                        />
                        <span className="text-white/40">to</span>
                        <input
                          type="date"
                          value={vac.end}
                          onChange={e => setVacations(prev => prev.map(v =>
                            v.id === vac.id ? { ...v, end: e.target.value } : v
                          ))}
                          className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => removeVacation(vac.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Preferences */}
          {step === 'preferences' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Deload frequency (weeks between recovery weeks)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={deloadFrequency}
                    onChange={e => setDeloadFrequency(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xl font-semibold w-24 text-right">
                    Every {deloadFrequency} weeks
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Additional instructions (optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="E.g., 'I have a recurring soccer game on Sundays' or 'Focus more on cycling than running'"
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="text-center py-12">
              <Loader2 size={48} className="mx-auto text-violet-400 animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Generating Your Plan</h3>
              <p className="text-white/50">
                AI is creating a personalized periodization plan based on your goals...
              </p>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && generatedPlan && (
            <div className="space-y-6">
              <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                <h3 className="font-semibold mb-2">{generatedPlan.name}</h3>
                <p className="text-sm text-white/60">{generatedPlan.description}</p>
              </div>

              {reasoning && (
                <div>
                  <p className="text-sm text-white/60 mb-2">AI Reasoning:</p>
                  <p className="text-sm bg-white/5 p-3 rounded-lg">{reasoning}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-white/50">Phases</p>
                  <p className="text-xl font-semibold">{generatedPlan.phases?.length || 0}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-white/50">Weekly Hours</p>
                  <p className="text-xl font-semibold">{generatedPlan.weekly_hours_target}h</p>
                </div>
              </div>

              {generatedPlan.phases && generatedPlan.phases.length > 0 && (
                <div>
                  <p className="text-sm text-white/60 mb-2">Phase Overview:</p>
                  <div className="space-y-2">
                    {generatedPlan.phases.map(phase => (
                      <div
                        key={phase.id}
                        className="p-3 bg-white/5 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{phase.name}</p>
                          <p className="text-sm text-white/50">
                            {new Date(phase.start_date).toLocaleDateString()} - {new Date(phase.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-sm text-white/60 capitalize">
                          {phase.phase_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          {step !== 'generating' && step !== 'review' && (
            <>
              <button
                onClick={step === 'goal' ? onClose : goBack}
                className="px-4 py-2 text-white/60 hover:text-white flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                {step === 'goal' ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={goNext}
                disabled={step === 'activities' && activities.length === 0}
                className="px-6 py-2 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {step === 'preferences' ? (
                  <>
                    <Sparkles size={16} />
                    Generate Plan
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('preferences')}
                className="px-4 py-2 text-white/60 hover:text-white flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                Regenerate
              </button>
              <button
                onClick={handleSavePlan}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2"
              >
                <Check size={16} />
                Save & Activate Plan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
