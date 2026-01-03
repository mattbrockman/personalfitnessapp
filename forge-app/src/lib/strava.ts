// Strava API utilities

const STRAVA_API_BASE = 'https://www.strava.com/api/v3'
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

// OAuth scope configurations
export const STRAVA_SCOPES = {
  READ: 'read,activity:read_all,profile:read_all',
  WRITE: 'read,activity:read_all,profile:read_all,activity:write',
} as const

/**
 * Check if scopes array includes write permission
 */
export function hasWriteScope(scopes: string[] | null | undefined): boolean {
  return scopes?.includes('activity:write') ?? false
}

/**
 * Parse scope string from OAuth response into array
 */
export function parseScopeString(scopeString: string): string[] {
  return scopeString.split(',').map(s => s.trim()).filter(Boolean)
}

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
    profile: string
  }
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  start_date_local: string
  elapsed_time: number
  moving_time: number
  distance: number
  total_elevation_gain: number
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  max_watts?: number
  weighted_average_watts?: number
  kilojoules?: number
  suffer_score?: number
  calories?: number
  device_watts?: boolean
  has_heartrate?: boolean
  external_id?: string
  upload_id?: number
  map?: {
    summary_polyline?: string
  }
}

export interface StravaZones {
  heart_rate?: {
    custom_zones: boolean
    zones: Array<{ min: number; max: number }>
  }
  power?: {
    zones: Array<{ min: number; max: number }>
  }
}

export interface StravaActivityZones {
  type: 'heartrate' | 'power'
  distribution_buckets: Array<{
    max: number
    min: number
    time: number
  }>
}

/**
 * Generate Strava OAuth URL
 * @param redirectUri - OAuth redirect URI
 * @param state - Optional state for CSRF protection
 * @param includeWriteScope - Request activity:write scope for pushing workouts
 */
export function getStravaAuthUrl(
  redirectUri: string,
  state?: string,
  includeWriteScope: boolean = false
): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: includeWriteScope ? STRAVA_SCOPES.WRITE : STRAVA_SCOPES.READ,
    ...(state && { state }),
  })

  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Strava token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token
 */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Strava token refresh failed: ${error}`)
  }

  return response.json()
}

/**
 * Make authenticated Strava API request
 */
export async function stravaFetch<T>(
  accessToken: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Strava API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Get athlete activities
 */
export async function getStravaActivities(
  accessToken: string,
  params?: {
    before?: number
    after?: number
    page?: number
    per_page?: number
  }
): Promise<StravaActivity[]> {
  const searchParams = new URLSearchParams()
  if (params?.before) searchParams.set('before', params.before.toString())
  if (params?.after) searchParams.set('after', params.after.toString())
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.per_page) searchParams.set('per_page', params.per_page.toString())

  const query = searchParams.toString()
  return stravaFetch<StravaActivity[]>(
    accessToken,
    `/athlete/activities${query ? `?${query}` : ''}`
  )
}

/**
 * Get single activity with full details
 */
export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  return stravaFetch<StravaActivity>(accessToken, `/activities/${activityId}`)
}

/**
 * Get activity zones (HR and Power distribution)
 */
export async function getStravaActivityZones(
  accessToken: string,
  activityId: number
): Promise<StravaActivityZones[]> {
  return stravaFetch<StravaActivityZones[]>(
    accessToken,
    `/activities/${activityId}/zones`
  )
}

/**
 * Get athlete zones (configured zones)
 */
export async function getStravaAthleteZones(accessToken: string): Promise<StravaZones> {
  return stravaFetch<StravaZones>(accessToken, '/athlete/zones')
}

/**
 * Map Strava sport_type to our workout_type
 */
export function mapStravaTypeToWorkoutType(sportType: string): {
  category: 'cardio' | 'strength' | 'other'
  workoutType: string
} {
  const mapping: Record<string, { category: 'cardio' | 'strength' | 'other'; workoutType: string }> = {
    // Cycling
    'Ride': { category: 'cardio', workoutType: 'bike' },
    'VirtualRide': { category: 'cardio', workoutType: 'bike' },
    'MountainBikeRide': { category: 'cardio', workoutType: 'bike' },
    'GravelRide': { category: 'cardio', workoutType: 'bike' },
    'EBikeRide': { category: 'cardio', workoutType: 'bike' },
    
    // Running
    'Run': { category: 'cardio', workoutType: 'run' },
    'VirtualRun': { category: 'cardio', workoutType: 'run' },
    'TrailRun': { category: 'cardio', workoutType: 'run' },
    
    // Swimming
    'Swim': { category: 'cardio', workoutType: 'swim' },
    
    // Other cardio
    'Rowing': { category: 'cardio', workoutType: 'row' },
    'Elliptical': { category: 'cardio', workoutType: 'elliptical' },
    'StairStepper': { category: 'cardio', workoutType: 'stairclimber' },
    'Walk': { category: 'other', workoutType: 'walk' },
    'Hike': { category: 'other', workoutType: 'hike' },
    
    // Strength
    'WeightTraining': { category: 'strength', workoutType: 'strength' },
    'Crossfit': { category: 'strength', workoutType: 'class' },
    
    // Other sports
    'Tennis': { category: 'other', workoutType: 'tennis' },
    'Soccer': { category: 'other', workoutType: 'soccer' },
    'AlpineSki': { category: 'other', workoutType: 'ski' },
    'NordicSki': { category: 'other', workoutType: 'ski' },
    'Yoga': { category: 'other', workoutType: 'yoga' },
    'Workout': { category: 'other', workoutType: 'class' },
  }

  return mapping[sportType] || { category: 'other', workoutType: 'other' }
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters / 1609.344
}

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084
}

/**
 * Calculate TSS from Strava activity (simplified)
 * Real TSS requires normalized power and FTP
 */
export function estimateTSS(activity: StravaActivity, ftp?: number): number | null {
  // If we have weighted average power and FTP, calculate proper TSS
  if (activity.weighted_average_watts && ftp) {
    const durationHours = activity.moving_time / 3600
    const intensityFactor = activity.weighted_average_watts / ftp
    return Math.round(durationHours * intensityFactor * intensityFactor * 100)
  }

  // Otherwise use suffer score as proxy (roughly TSS/10)
  if (activity.suffer_score) {
    return activity.suffer_score
  }

  return null
}

// ============================================
// Push to Strava functions
// ============================================

export interface CreateActivityParams {
  name: string
  sport_type: string
  start_date_local: string
  elapsed_time: number
  description?: string
  distance?: number
  trainer?: boolean
  commute?: boolean
}

/**
 * Create a new activity on Strava (requires activity:write scope)
 */
export async function createStravaActivity(
  accessToken: string,
  activity: CreateActivityParams
): Promise<StravaActivity> {
  const response = await fetch(`${STRAVA_API_BASE}/activities`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activity),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create Strava activity: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Map app workout types to Strava sport_type for pushing activities
 * Reverse of mapStravaTypeToWorkoutType
 */
export function mapWorkoutTypeToStravaType(
  category: string,
  workoutType: string
): string {
  // Strength activities
  if (category === 'strength') {
    return 'WeightTraining'
  }

  // Cardio activities
  const cardioMapping: Record<string, string> = {
    'bike': 'Ride',
    'run': 'Run',
    'swim': 'Swim',
    'row': 'Rowing',
    'elliptical': 'Elliptical',
    'stairclimber': 'StairStepper',
  }

  if (category === 'cardio' && cardioMapping[workoutType]) {
    return cardioMapping[workoutType]
  }

  // Other activities
  const otherMapping: Record<string, string> = {
    'walk': 'Walk',
    'hike': 'Hike',
    'yoga': 'Yoga',
    'ski': 'AlpineSki',
    'tennis': 'Tennis',
    'soccer': 'Soccer',
    'class': 'Workout',
  }

  return otherMapping[workoutType] || 'Workout'
}

/**
 * Get a single activity by ID from Strava
 */
export async function getStravaActivityById(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  return stravaFetch<StravaActivity>(accessToken, `/activities/${activityId}`)
}
