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
    'include-all-sessions': 'true',
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
 * Convert Eight Sleep session to our sleep_logs format
 */
export function mapEightSleepToSleepLog(day: EightSleepTrends['days'][0], session: EightSleepSession) {
  // Get average HRV from timeseries or quality score
  const avgHrv = session.sleepQualityScore?.hrv ||
    (session.timeseries?.hrv?.length > 0
      ? Math.round(session.timeseries.hrv.reduce((sum, [, val]) => sum + val, 0) / session.timeseries.hrv.length)
      : null)

  // Get average heart rate from timeseries
  const avgHr = session.timeseries?.heartRate?.length > 0
    ? Math.round(session.timeseries.heartRate.reduce((sum, [, val]) => sum + val, 0) / session.timeseries.heartRate.length)
    : null

  // Get average respiratory rate
  const avgRespRate = session.timeseries?.respiratoryRate?.length > 0
    ? Math.round(session.timeseries.respiratoryRate.reduce((sum, [, val]) => sum + val, 0) / session.timeseries.respiratoryRate.length * 10) / 10
    : null

  // Convert seconds to minutes
  const secondsToMinutes = (seconds: number | undefined) =>
    seconds ? Math.round(seconds / 60) : null

  // Total sleep = light + deep + rem (not including awake)
  const totalSleepSeconds = (session.stages?.light || 0) +
                           (session.stages?.deep || 0) +
                           (session.stages?.rem || 0)

  return {
    log_date: day.day,
    bedtime: session.startTime,
    wake_time: session.endTime,
    total_sleep_minutes: secondsToMinutes(totalSleepSeconds),
    deep_sleep_minutes: secondsToMinutes(session.stages?.deep),
    rem_sleep_minutes: secondsToMinutes(session.stages?.rem),
    light_sleep_minutes: secondsToMinutes(session.stages?.light),
    awake_minutes: secondsToMinutes(session.stages?.awake),
    sleep_score: session.score || day.score,
    hrv_avg: avgHrv,
    resting_hr: avgHr,
    respiratory_rate: avgRespRate,
    source: 'eight_sleep_direct' as const,
  }
}
