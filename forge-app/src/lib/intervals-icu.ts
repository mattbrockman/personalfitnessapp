// Intervals.icu API utilities
// Docs: https://intervals.icu/api-docs.html
// Uses API Key authentication (Basic auth with athlete_id:api_key)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1'

// ============================================================================
// Types
// ============================================================================

export interface IntervalsAthlete {
  id: string
  name: string
  email: string
  sex: string
  weight: number
  ftp?: number
  lthr?: number
  max_hr?: number
}

export interface IntervalsEvent {
  id: number
  start_date_local: string
  name: string
  category: 'WORKOUT' | 'NOTE' | 'TARGET'
  description?: string
  type?: string
  moving_time?: number
  icu_training_load?: number
  external_id?: string
  filename?: string
  file_contents?: string
  color?: string
}

export interface IntervalsActivity {
  id: string
  start_date_local: string
  name: string
  type: string
  source: string
  moving_time: number
  elapsed_time: number
  distance?: number
  total_elevation_gain?: number
  average_watts?: number
  icu_weighted_avg_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  icu_training_load?: number
  icu_intensity?: number
  icu_zone_times?: Record<string, number>
  external_id?: string
}

export interface CreateEventPayload {
  category: 'WORKOUT' | 'NOTE' | 'TARGET'
  start_date_local: string
  name: string
  description?: string
  type?: string
  filename?: string
  file_contents?: string
  external_id?: string
  color?: string
}

// ============================================================================
// API Key Authentication
// ============================================================================

/**
 * Create Basic auth header for Intervals.icu API
 * Format: Basic base64(API_KEY:api_key)
 * Note: Username is the literal string "API_KEY", not the athlete ID
 */
export function createIntervalsAuthHeader(apiKey: string): string {
  const credentials = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Validate API key by fetching athlete profile
 */
export async function validateIntervalsApiKey(
  athleteId: string,
  apiKey: string
): Promise<IntervalsAthlete> {
  const authHeader = createIntervalsAuthHeader(apiKey)
  const url = `${INTERVALS_API_BASE}/athlete/${athleteId}`

  const response = await fetch(url, {
    headers: {
      'Authorization': authHeader,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    if (response.status === 401) {
      throw new Error('Invalid API key or athlete ID')
    }
    throw new Error(`Intervals.icu API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// API Client Class
// ============================================================================

/**
 * Intervals.icu API client using API Key authentication
 */
export class IntervalsICUClient {
  private supabase: SupabaseClientAny
  private userId: string
  private athleteId: string | null = null
  private apiKey: string | null = null

  constructor(supabase: SupabaseClientAny, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  /**
   * Get credentials from database
   */
  private async getCredentials(): Promise<{ athleteId: string; apiKey: string }> {
    const { data: integration, error } = await this.supabase
      .from('integrations')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'intervals_icu')
      .single()

    if (error || !integration) {
      throw new Error('No Intervals.icu connection found')
    }

    const athleteId = integration.intervals_athlete_id || integration.external_user_id
    const apiKey = integration.access_token // We store the API key in access_token field

    if (!athleteId || !apiKey) {
      throw new Error('Invalid Intervals.icu credentials')
    }

    this.athleteId = athleteId
    this.apiKey = apiKey

    return { athleteId, apiKey }
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { athleteId, apiKey } = await this.getCredentials()
    const authHeader = createIntervalsAuthHeader(apiKey)

    // Replace :athleteId placeholder with actual ID
    const url = endpoint.includes(':athleteId')
      ? `${INTERVALS_API_BASE}${endpoint.replace(':athleteId', athleteId)}`
      : `${INTERVALS_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Intervals.icu API error: ${response.status} - ${error}`)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) return {} as T

    return JSON.parse(text)
  }

  /**
   * Get athlete profile
   */
  async getAthlete(): Promise<IntervalsAthlete> {
    return this.request<IntervalsAthlete>('/athlete/:athleteId')
  }

  /**
   * Get events (planned workouts) for a date range
   */
  async getEvents(
    startDate: string,
    endDate: string
  ): Promise<IntervalsEvent[]> {
    return this.request<IntervalsEvent[]>(
      `/athlete/:athleteId/events?oldest=${startDate}&newest=${endDate}`
    )
  }

  /**
   * Create or update an event (workout) on the calendar
   * Uses bulk upsert endpoint with external_id for idempotency
   */
  async pushWorkout(event: CreateEventPayload): Promise<IntervalsEvent> {
    const events = await this.request<IntervalsEvent[]>(
      '/athlete/:athleteId/events/bulk?upsert=true',
      {
        method: 'POST',
        body: JSON.stringify([event]),
      }
    )
    return events[0]
  }

  /**
   * Push multiple workouts at once
   */
  async pushWorkouts(events: CreateEventPayload[]): Promise<IntervalsEvent[]> {
    return this.request<IntervalsEvent[]>(
      '/athlete/:athleteId/events/bulk?upsert=true',
      {
        method: 'POST',
        body: JSON.stringify(events),
      }
    )
  }

  /**
   * Delete a workout by external_id
   */
  async deleteWorkout(externalId: string): Promise<void> {
    await this.request<void>(
      '/athlete/:athleteId/events/bulk-delete',
      {
        method: 'PUT',
        body: JSON.stringify([{ external_id: externalId }]),
      }
    )
  }

  /**
   * Get completed activities for a date range
   */
  async getActivities(
    startDate: string,
    endDate: string
  ): Promise<IntervalsActivity[]> {
    return this.request<IntervalsActivity[]>(
      `/athlete/:athleteId/activities?oldest=${startDate}&newest=${endDate}`
    )
  }

  /**
   * Get detailed activity data including zone times
   */
  async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.request<IntervalsActivity>(
      `/activity/${activityId}?intervals=true`
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Intervals.icu source to platform name
 */
export function mapSourceToPlatform(source: string): string {
  const mapping: Record<string, string> = {
    'ZWIFT': 'zwift',
    'WAHOO': 'wahoo',
    'WAHOO_CLOUD': 'wahoo',
    'WAHOO_SYSTM': 'wahoo',
    'GARMIN': 'garmin',
    'GARMIN_CONNECT': 'garmin',
    'STRAVA': 'strava',
    'TRAINER_ROAD': 'trainerroad',
  }
  return mapping[source?.toUpperCase()] || 'other'
}

/**
 * Format date for Intervals.icu API (YYYY-MM-DD)
 */
export function formatDateForIntervals(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Generate external ID for a workout
 */
export function generateExternalId(workoutId: string, date?: string): string {
  const dateStr = date || new Date().toISOString().split('T')[0]
  return `forge_${workoutId}_${dateStr}`
}
