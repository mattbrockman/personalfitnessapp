// Direct Eight Sleep API client (unofficial/reverse-engineered)
// Based on Home Assistant integration: https://github.com/lukas-clarke/eight_sleep

const AUTH_URL = 'https://auth-api.8slp.net/v1/tokens'
const CLIENT_API_URL = 'https://client-api.8slp.net/v1'
const APP_API_URL = 'https://app-api.8slp.net/'

// Default client credentials from Home Assistant integration
const DEFAULT_CLIENT_ID = '0894c7f33bb94800a03f1f4df13a4f38'
const DEFAULT_CLIENT_SECRET = 'f0954a3ed5763ba3d06834c73731a32f15f168f47d4f164751275def86db0c76'

export interface EightSleepTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: string
}

export interface EightSleepSession {
  id: string
  startTime: string
  endTime: string
  score: number
  stages: {
    light: number  // seconds
    deep: number   // seconds
    rem: number    // seconds
    awake: number  // seconds
  }
  timeseries: {
    heartRate: [number, number][]  // [timestamp, value]
    hrv: [number, number][]
    respiratoryRate: [number, number][]
    tempBedC: [number, number][]
    tempRoomC: [number, number][]
  }
  sleepQualityScore?: {
    hrv?: number
    latencyAsleep?: number
    latencyOut?: number
    wakeupConsistency?: number
  }
}

export interface EightSleepTrends {
  days: {
    day: string  // YYYY-MM-DD
    score: number
    sleepDuration: number  // seconds
    presenceDuration: number
    sessions: EightSleepSession[]
  }[]
}

/**
 * Authenticate with Eight Sleep
 */
export async function authenticate(
  email: string,
  password: string
): Promise<EightSleepTokens> {
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'okhttp/4.9.3',
    },
    body: JSON.stringify({
      client_id: DEFAULT_CLIENT_ID,
      client_secret: DEFAULT_CLIENT_SECRET,
      grant_type: 'password',
      username: email,
      password: password,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Eight Sleep auth error:', response.status, error)
    throw new Error(`Authentication failed: ${response.status}`)
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.userId,
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(refresh_token: string): Promise<EightSleepTokens> {
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'okhttp/4.9.3',
    },
    body: JSON.stringify({
      client_id: DEFAULT_CLIENT_ID,
      client_secret: DEFAULT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    }),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.userId,
  }
}

/**
 * Get user info
 */
export async function getUserInfo(accessToken: string) {
  const response = await fetch(`${CLIENT_API_URL}/users/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'okhttp/4.9.3',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get user info')
  }

  return response.json()
}

/**
 * Get sleep trends/data for a date range
 */
export async function getSleepTrends(
  accessToken: string,
  userId: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string,    // YYYY-MM-DD
  timezone: string = 'America/New_York'
): Promise<EightSleepTrends> {
  const params = new URLSearchParams({
    'tz': timezone,
    'from': startDate,
    'to': endDate,
    'include-main': 'true',
    'model-version': 'v2',
  })

  const response = await fetch(
    `${CLIENT_API_URL}/users/${userId}/trends?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'okhttp/4.9.3',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Eight Sleep trends error:', response.status, error)
    throw new Error(`Failed to get sleep trends: ${response.status}`)
  }

  return response.json()
}

/**
 * Convert Eight Sleep day data to our sleep_logs format
 * The API returns sleep data directly on the day object
 */
export function mapEightSleepDayToSleepLog(day: any) {
  try {
    // Convert seconds to minutes
    const secondsToMinutes = (seconds: number | undefined | null) =>
      seconds ? Math.round(seconds / 60) : null

    // Calculate awake time (presence - sleep)
    const awakeDuration = day.presenceDuration && day.sleepDuration
      ? day.presenceDuration - day.sleepDuration
      : null

    // Get metrics from sleepQualityScore
    const qualityScore = day.sleepQualityScore
    const hrv = qualityScore?.hrv?.current
    const heartRate = qualityScore?.heartRate?.current
    const respRate = qualityScore?.respiratoryRate?.current

    return {
      log_date: day.day,
      bedtime: day.sleepStart || null,  // ISO timestamp
      wake_time: day.sleepEnd || null,  // ISO timestamp
      total_sleep_minutes: secondsToMinutes(day.sleepDuration),
      deep_sleep_minutes: secondsToMinutes(day.deepDuration),
      rem_sleep_minutes: secondsToMinutes(day.remDuration),
      light_sleep_minutes: secondsToMinutes(day.lightDuration),
      awake_minutes: secondsToMinutes(awakeDuration),
      sleep_score: day.score || null,
      hrv_avg: hrv ? Math.round(hrv) : null,
      resting_hr: heartRate ? Math.round(heartRate) : null,
      respiratory_rate: respRate ? Math.round(respRate * 10) / 10 : null,
      source: 'eight_sleep_direct' as const,
    }
  } catch (error) {
    console.error('Error mapping sleep data for day:', day.day, error)
    return {
      log_date: day.day,
      bedtime: null,
      wake_time: null,
      total_sleep_minutes: null,
      deep_sleep_minutes: null,
      rem_sleep_minutes: null,
      light_sleep_minutes: null,
      awake_minutes: null,
      sleep_score: null,
      hrv_avg: null,
      resting_hr: null,
      respiratory_rate: null,
      source: 'eight_sleep_direct' as const,
    }
  }
}
