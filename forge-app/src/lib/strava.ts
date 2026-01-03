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
// All supported workout types with their Strava mappings
export const WORKOUT_TYPES = {
  // Cardio
  bike: { category: 'cardio', label: 'Cycling', stravaType: 'Ride' },
  run: { category: 'cardio', label: 'Running', stravaType: 'Run' },
  swim: { category: 'cardio', label: 'Swimming', stravaType: 'Swim' },
  row: { category: 'cardio', label: 'Rowing', stravaType: 'Rowing' },
  elliptical: { category: 'cardio', label: 'Elliptical', stravaType: 'Elliptical' },
  stairclimber: { category: 'cardio', label: 'Stair Climber', stravaType: 'StairStepper' },

  // Strength
  strength: { category: 'strength', label: 'Weight Training', stravaType: 'WeightTraining' },
  crossfit: { category: 'strength', label: 'CrossFit', stravaType: 'Crossfit' },

  // Winter sports
  ski: { category: 'other', label: 'Alpine Skiing', stravaType: 'AlpineSki' },
  nordic_ski: { category: 'other', label: 'Nordic Skiing', stravaType: 'NordicSki' },
  snowboard: { category: 'other', label: 'Snowboarding', stravaType: 'Snowboard' },
  snowshoe: { category: 'other', label: 'Snowshoeing', stravaType: 'Snowshoe' },
  ice_skate: { category: 'other', label: 'Ice Skating', stravaType: 'IceSkate' },

  // Racquet sports
  tennis: { category: 'other', label: 'Tennis', stravaType: 'Tennis' },
  pickleball: { category: 'other', label: 'Pickleball', stravaType: 'Pickleball' },
  badminton: { category: 'other', label: 'Badminton', stravaType: 'Badminton' },
  squash: { category: 'other', label: 'Squash', stravaType: 'Squash' },
  table_tennis: { category: 'other', label: 'Table Tennis', stravaType: 'TableTennis' },
  racquetball: { category: 'other', label: 'Racquetball', stravaType: 'Racquetball' },

  // Team sports
  soccer: { category: 'other', label: 'Soccer', stravaType: 'Soccer' },
  basketball: { category: 'other', label: 'Basketball', stravaType: 'Basketball' },
  football: { category: 'other', label: 'Football', stravaType: 'Football' },
  hockey: { category: 'other', label: 'Hockey', stravaType: 'Hockey' },
  volleyball: { category: 'other', label: 'Volleyball', stravaType: 'Volleyball' },

  // Water sports
  kayak: { category: 'cardio', label: 'Kayaking', stravaType: 'Kayaking' },
  canoe: { category: 'cardio', label: 'Canoeing', stravaType: 'Canoeing' },
  paddle: { category: 'cardio', label: 'Stand Up Paddling', stravaType: 'StandUpPaddling' },
  surf: { category: 'other', label: 'Surfing', stravaType: 'Surfing' },

  // Outdoor activities
  walk: { category: 'other', label: 'Walking', stravaType: 'Walk' },
  hike: { category: 'other', label: 'Hiking', stravaType: 'Hike' },
  rock_climb: { category: 'other', label: 'Rock Climbing', stravaType: 'RockClimbing' },
  golf: { category: 'other', label: 'Golf', stravaType: 'Golf' },

  // Fitness classes
  yoga: { category: 'other', label: 'Yoga', stravaType: 'Yoga' },
  pilates: { category: 'other', label: 'Pilates', stravaType: 'Pilates' },
  hiit: { category: 'strength', label: 'HIIT', stravaType: 'HIIT' },
  class: { category: 'other', label: 'Fitness Class', stravaType: 'Workout' },

  // Other
  other: { category: 'other', label: 'Other', stravaType: 'Workout' },
} as const

export type WorkoutType = keyof typeof WORKOUT_TYPES

/**
 * Detect workout type from name using keyword matching
 */
export function detectWorkoutTypeFromName(name: string): {
  category: 'cardio' | 'strength' | 'other'
  workoutType: WorkoutType
} {
  const lower = name.toLowerCase()

  // Keywords mapped to workout types (order matters - more specific first)
  const keywords: Array<{ patterns: string[]; type: WorkoutType }> = [
    // Winter sports (check before generic terms)
    { patterns: ['snowboard'], type: 'snowboard' },
    { patterns: ['snowshoe'], type: 'snowshoe' },
    { patterns: ['nordic ski', 'cross country ski', 'xc ski'], type: 'nordic_ski' },
    { patterns: ['ski', 'skiing', 'cannon', 'loon', 'killington', 'stowe', 'sugarloaf'], type: 'ski' },
    { patterns: ['ice skat', 'skating rink'], type: 'ice_skate' },

    // Racquet sports
    { patterns: ['pickleball'], type: 'pickleball' },
    { patterns: ['badminton'], type: 'badminton' },
    { patterns: ['squash'], type: 'squash' },
    { patterns: ['table tennis', 'ping pong'], type: 'table_tennis' },
    { patterns: ['racquetball'], type: 'racquetball' },
    { patterns: ['tennis'], type: 'tennis' },

    // Team sports
    { patterns: ['soccer', 'futbol', 'football match'], type: 'soccer' },
    { patterns: ['basketball', 'hoops'], type: 'basketball' },
    { patterns: ['football', 'nfl'], type: 'football' },
    { patterns: ['hockey'], type: 'hockey' },
    { patterns: ['volleyball'], type: 'volleyball' },

    // Water sports
    { patterns: ['kayak'], type: 'kayak' },
    { patterns: ['canoe'], type: 'canoe' },
    { patterns: ['paddle board', 'sup ', 'paddl'], type: 'paddle' },
    { patterns: ['surf'], type: 'surf' },

    // Cardio
    { patterns: ['mountain bike', 'mtb'], type: 'bike' },
    { patterns: ['bike', 'ride', 'cycling', 'spin', 'peloton', 'zwift'], type: 'bike' },
    { patterns: ['trail run'], type: 'run' },
    { patterns: ['run', 'jog', 'sprint', 'track'], type: 'run' },
    { patterns: ['swim', 'pool', 'lap'], type: 'swim' },
    { patterns: ['row', 'erg', 'concept2'], type: 'row' },
    { patterns: ['elliptical'], type: 'elliptical' },
    { patterns: ['stair', 'stairmaster'], type: 'stairclimber' },

    // Strength
    { patterns: ['crossfit', 'wod', 'amrap', 'emom'], type: 'crossfit' },
    { patterns: ['hiit', 'interval', 'tabata'], type: 'hiit' },
    { patterns: ['lift', 'weight', 'strength', 'gym', 'deadlift', 'squat', 'bench', 'press'], type: 'strength' },

    // Outdoor
    { patterns: ['hike', 'hiking', 'trail walk'], type: 'hike' },
    { patterns: ['walk', 'walking'], type: 'walk' },
    { patterns: ['climb', 'boulder'], type: 'rock_climb' },
    { patterns: ['golf'], type: 'golf' },

    // Fitness classes
    { patterns: ['yoga'], type: 'yoga' },
    { patterns: ['pilates'], type: 'pilates' },
    { patterns: ['class', 'studio', 'orangetheory', 'f45', 'barry'], type: 'class' },
  ]

  for (const { patterns, type } of keywords) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        const typeInfo = WORKOUT_TYPES[type]
        return {
          category: typeInfo.category as 'cardio' | 'strength' | 'other',
          workoutType: type
        }
      }
    }
  }

  return { category: 'other', workoutType: 'other' }
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
    'Kayaking': { category: 'cardio', workoutType: 'kayak' },
    'Canoeing': { category: 'cardio', workoutType: 'canoe' },
    'StandUpPaddling': { category: 'cardio', workoutType: 'paddle' },

    // Walking/Hiking
    'Walk': { category: 'other', workoutType: 'walk' },
    'Hike': { category: 'other', workoutType: 'hike' },

    // Strength
    'WeightTraining': { category: 'strength', workoutType: 'strength' },
    'Crossfit': { category: 'strength', workoutType: 'crossfit' },
    'HIIT': { category: 'strength', workoutType: 'hiit' },

    // Winter sports
    'AlpineSki': { category: 'other', workoutType: 'ski' },
    'BackcountrySki': { category: 'other', workoutType: 'ski' },
    'NordicSki': { category: 'other', workoutType: 'nordic_ski' },
    'Snowboard': { category: 'other', workoutType: 'snowboard' },
    'Snowshoe': { category: 'other', workoutType: 'snowshoe' },
    'IceSkate': { category: 'other', workoutType: 'ice_skate' },

    // Racquet sports
    'Tennis': { category: 'other', workoutType: 'tennis' },
    'Pickleball': { category: 'other', workoutType: 'pickleball' },
    'Badminton': { category: 'other', workoutType: 'badminton' },
    'Squash': { category: 'other', workoutType: 'squash' },
    'TableTennis': { category: 'other', workoutType: 'table_tennis' },
    'Racquetball': { category: 'other', workoutType: 'racquetball' },

    // Team sports
    'Soccer': { category: 'other', workoutType: 'soccer' },
    'Basketball': { category: 'other', workoutType: 'basketball' },
    'Football': { category: 'other', workoutType: 'football' },
    'Hockey': { category: 'other', workoutType: 'hockey' },
    'Volleyball': { category: 'other', workoutType: 'volleyball' },

    // Water sports
    'Surfing': { category: 'other', workoutType: 'surf' },

    // Outdoor
    'RockClimbing': { category: 'other', workoutType: 'rock_climb' },
    'Golf': { category: 'other', workoutType: 'golf' },

    // Fitness
    'Yoga': { category: 'other', workoutType: 'yoga' },
    'Pilates': { category: 'other', workoutType: 'pilates' },
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
 * Uses WORKOUT_TYPES constant for consistent mapping
 */
export function mapWorkoutTypeToStravaType(
  category: string,
  workoutType: string
): string {
  // Look up in WORKOUT_TYPES first
  const typeInfo = WORKOUT_TYPES[workoutType as WorkoutType]
  if (typeInfo) {
    return typeInfo.stravaType
  }

  // Fallback for legacy/unknown types
  if (category === 'strength') {
    return 'WeightTraining'
  }

  return 'Workout'
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
