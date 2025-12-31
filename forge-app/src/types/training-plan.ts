// Training Plan Types for Long-term Periodization

export type PlanGoal = 'strength' | 'endurance' | 'weight_loss' | 'general_fitness' | 'event_prep'
export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type PhaseType = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'transition'
export type IntensityFocus = 'volume' | 'intensity' | 'speed' | 'strength' | 'recovery'
export type WeekType = 'normal' | 'build' | 'recovery' | 'deload' | 'test' | 'race'
export type EventType = 'race' | 'competition' | 'vacation' | 'travel' | 'deload' | 'test' | 'milestone'
export type EventPriority = 'A' | 'B' | 'C'
export type ActivityType = 'cycling' | 'running' | 'swimming' | 'lifting' | 'soccer' | 'tennis' | 'skiing' | 'other' | 'rest'
export type BalanceRuleType = 'reduce_when' | 'increase_when' | 'substitute' | 'conflict'

// Phase display configuration
export const PHASE_COLORS: Record<PhaseType, string> = {
  base: 'bg-blue-500',
  build: 'bg-amber-500',
  peak: 'bg-red-500',
  taper: 'bg-purple-500',
  recovery: 'bg-green-500',
  transition: 'bg-gray-500',
}

export const PHASE_LABELS: Record<PhaseType, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  recovery: 'Recovery',
  transition: 'Transition',
}

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  race: '🏁',
  competition: '🏆',
  vacation: '🏖️',
  travel: '✈️',
  deload: '😴',
  test: '📊',
  milestone: '🎯',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  cycling: 'Cycling',
  running: 'Running',
  swimming: 'Swimming',
  lifting: 'Lifting',
  soccer: 'Soccer',
  tennis: 'Tennis',
  skiing: 'Skiing',
  other: 'Other',
  rest: 'Rest',
}

// Database Row Types
export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  goal: PlanGoal | null
  start_date: string
  end_date: string | null  // null for rolling plans
  primary_sport: string | null
  weekly_hours_target: number | null
  status: PlanStatus
  ai_generated: boolean
  ai_prompt: string | null
  created_at: string
  updated_at: string

  // Joined data (when fetched with relations)
  phases?: TrainingPhase[]
  events?: PlanEvent[]
  balance_rules?: ActivityBalanceRule[]
}

export interface TrainingPhase {
  id: string
  plan_id: string
  name: string
  phase_type: PhaseType
  order_index: number
  start_date: string
  end_date: string
  intensity_focus: IntensityFocus | null
  volume_modifier: number
  intensity_modifier: number
  activity_distribution: Record<ActivityType, number>
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string

  // Computed
  duration_weeks?: number

  // Joined data
  weekly_targets?: WeeklyTarget[]
}

export interface WeeklyTarget {
  id: string
  phase_id: string
  week_number: number
  week_start_date: string
  target_hours: number | null
  target_tss: number | null
  cycling_hours: number
  running_hours: number
  swimming_hours: number
  lifting_sessions: number
  other_hours: number
  zone_distribution: Record<string, number>
  week_type: WeekType
  daily_structure: Record<string, string>
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlanEvent {
  id: string
  plan_id: string
  name: string
  event_type: EventType
  priority: EventPriority
  event_date: string
  end_date: string | null
  sport: ActivityType | null
  distance_miles: number | null
  elevation_ft: number | null
  expected_duration_hours: number | null
  taper_days: number
  recovery_days: number
  blocks_training: boolean
  notes: string | null
  location: string | null
  external_url: string | null
  created_at: string
  updated_at: string
}

export interface ActivityBalanceRule {
  id: string
  plan_id: string
  rule_type: BalanceRuleType
  trigger_activity: ActivityType
  trigger_phase: PhaseType | null
  affected_activity: ActivityType
  modifier: number
  description: string | null
  is_active: boolean
  created_at: string
}

// API Request/Response Types
export interface CreateTrainingPlanRequest {
  name: string
  description?: string
  goal?: PlanGoal
  start_date: string
  end_date?: string
  primary_sport?: string
  weekly_hours_target?: number
  phases?: CreateTrainingPhaseRequest[]
  events?: CreatePlanEventRequest[]
}

export interface CreateTrainingPhaseRequest {
  name: string
  phase_type: PhaseType
  order_index: number
  start_date: string
  end_date: string
  intensity_focus?: IntensityFocus
  volume_modifier?: number
  intensity_modifier?: number
  activity_distribution?: Record<ActivityType, number>
  description?: string
  notes?: string
  weekly_targets?: CreateWeeklyTargetRequest[]
}

export interface CreateWeeklyTargetRequest {
  week_number: number
  week_start_date: string
  target_hours?: number
  target_tss?: number
  cycling_hours?: number
  running_hours?: number
  swimming_hours?: number
  lifting_sessions?: number
  other_hours?: number
  zone_distribution?: Record<string, number>
  week_type?: WeekType
  daily_structure?: Record<string, string>
  notes?: string
}

export interface CreatePlanEventRequest {
  name: string
  event_type: EventType
  priority?: EventPriority
  event_date: string
  end_date?: string
  sport?: ActivityType
  distance_miles?: number
  elevation_ft?: number
  expected_duration_hours?: number
  taper_days?: number
  recovery_days?: number
  blocks_training?: boolean
  notes?: string
  location?: string
  external_url?: string
}

// AI Generation Types
export interface AIGeneratePlanRequest {
  goal: PlanGoal
  primary_activities: ActivityType[]
  weekly_hours_available: number
  start_date: string
  end_date?: string  // Optional for rolling plans

  // Target events
  events: Array<{
    name: string
    date: string
    event_type: EventType
    priority: EventPriority
    sport?: ActivityType
  }>

  // Constraints
  preferences?: {
    preferred_deload_frequency?: number  // weeks between deloads
    vacation_dates?: Array<{ start: string; end: string; name?: string }>
    existing_commitments?: string  // free-form text about schedule constraints
    strength_priority?: 'maintain' | 'build' | 'peak'  // how to handle strength vs cardio
  }

  custom_prompt?: string
}

export interface AIGeneratePlanResponse {
  plan: {
    name: string
    description: string
    goal: PlanGoal
    start_date: string
    end_date: string | null
    primary_sport: string
    weekly_hours_target: number
  }
  phases: Array<{
    name: string
    phase_type: PhaseType
    order_index: number
    start_date: string
    end_date: string
    intensity_focus: IntensityFocus
    volume_modifier: number
    intensity_modifier: number
    activity_distribution: Record<ActivityType, number>
    description: string
  }>
  weekly_targets: Array<{
    phase_index: number  // Reference to phases array index
    targets: Array<{
      week_number: number
      week_start_date: string
      target_hours: number
      cycling_hours: number
      running_hours: number
      swimming_hours: number
      lifting_sessions: number
      other_hours: number
      zone_distribution: Record<string, number>
      week_type: WeekType
      daily_structure: Record<string, string>
    }>
  }>
  balance_rules: Array<{
    rule_type: BalanceRuleType
    trigger_activity: ActivityType
    trigger_phase: PhaseType | null
    affected_activity: ActivityType
    modifier: number
    description: string
  }>
  reasoning: string
}

// UI State Types
export interface PlanViewState {
  selectedPhaseId: string | null
  selectedWeekDate: string | null
  viewMode: 'timeline' | 'calendar' | 'list'
  expandedPhases: string[]
  showEvents: boolean
}

export interface WeeklyComplianceData {
  target_hours: number
  actual_hours: number
  hours_compliance: number
  target_tss: number
  actual_tss: number
  tss_compliance: number
}

// Current Week Target (from database function)
export interface CurrentWeekTarget {
  target_id: string
  plan_name: string
  phase_name: string
  phase_type: PhaseType
  week_type: WeekType
  target_hours: number | null
  target_tss: number | null
  cycling_hours: number
  running_hours: number
  swimming_hours: number
  lifting_sessions: number
  other_hours: number
  zone_distribution: Record<string, number>
  daily_structure: Record<string, string>
}

// Helper functions
export function calculatePhaseDurationWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.ceil(diffDays / 7)
}

export function getWeekStartDate(date: Date, weekStartDay: 'monday' | 'sunday' = 'monday'): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = weekStartDay === 'monday'
    ? (day === 0 ? -6 : 1 - day)
    : -day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startMonth} - ${endMonth}`
}
