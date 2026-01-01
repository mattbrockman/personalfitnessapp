// Junction (formerly Vital) API client for wearable data integration

const JUNCTION_API_BASE = process.env.JUNCTION_ENVIRONMENT === 'production'
  ? 'https://api.tryvital.io'
  : 'https://api.sandbox.tryvital.io'

// Types
export interface JunctionUser {
  user_id: string
  client_user_id: string
  created_on: string
}

export interface LinkToken {
  link_token: string
}

export interface ConnectedProvider {
  name: string
  slug: string
  status: string
  created_on: string
}

export interface SleepSummary {
  id: string
  user_id: string
  date: string
  calendar_date: string
  bedtime_start: string | null
  bedtime_stop: string | null
  duration: number | null // seconds
  total: number | null // seconds
  awake: number | null // seconds
  light: number | null // seconds
  rem: number | null // seconds
  deep: number | null // seconds
  efficiency: number | null // 0-1
  latency: number | null // seconds
  hr_lowest: number | null
  hr_average: number | null
  respiratory_rate: number | null
  average_hrv: number | null
  temperature_delta: number | null
  skin_temperature: number | null
  source: {
    provider: string
    type: string
  }
}

/**
 * Make authenticated Junction API request
 */
async function junctionFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const apiKey = process.env.JUNCTION_API_KEY
  if (!apiKey) {
    throw new Error('JUNCTION_API_KEY environment variable is not set')
  }

  const response = await fetch(`${JUNCTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-vital-api-key': apiKey,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Junction API error:', response.status, error)
    throw new Error(`Junction API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Create a Junction user for our app user
 */
export async function createJunctionUser(clientUserId: string): Promise<JunctionUser> {
  return junctionFetch<JunctionUser>('/v2/user/', {
    method: 'POST',
    body: JSON.stringify({ client_user_id: clientUserId }),
  })
}

/**
 * Get a Junction user by their Junction user ID
 */
export async function getJunctionUser(junctionUserId: string): Promise<JunctionUser> {
  return junctionFetch<JunctionUser>(`/v2/user/${junctionUserId}`)
}

/**
 * Get link token for connecting a provider
 * @param junctionUserId - The Junction user ID
 * @param providers - Optional list of provider slugs to filter (e.g., ['eight_sleep'])
 */
export async function getLinkToken(
  junctionUserId: string,
  providers?: string[]
): Promise<LinkToken> {
  const body: Record<string, unknown> = { user_id: junctionUserId }
  if (providers && providers.length > 0) {
    body.filter_on_providers = providers
  }

  return junctionFetch<LinkToken>('/v2/link/token', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Get connected providers for a user
 */
export async function getConnectedProviders(junctionUserId: string): Promise<ConnectedProvider[]> {
  const response = await junctionFetch<{ providers: ConnectedProvider[] }>(
    `/v2/user/${junctionUserId}/providers`
  )
  return response.providers || []
}

/**
 * Disconnect a provider for a user
 */
export async function disconnectProvider(
  junctionUserId: string,
  provider: string
): Promise<void> {
  await junctionFetch(`/v2/user/${junctionUserId}/${provider}`, {
    method: 'DELETE',
  })
}

/**
 * Get sleep summaries for a user
 */
export async function getSleepSummaries(
  junctionUserId: string,
  startDate: string,
  endDate: string,
  provider?: string
): Promise<SleepSummary[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  })
  if (provider) {
    params.set('provider', provider)
  }

  const response = await junctionFetch<{ sleep: SleepSummary[] }>(
    `/v2/summary/sleep/${junctionUserId}?${params.toString()}`
  )
  return response.sleep || []
}

/**
 * Convert Junction sleep data to our sleep_logs format
 */
export function mapJunctionSleepToSleepLog(sleep: SleepSummary) {
  // Convert seconds to minutes for our schema
  const secondsToMinutes = (seconds: number | null) =>
    seconds ? Math.round(seconds / 60) : null

  // Parse bedtime/wake time to HH:MM format
  const parseTimeToHHMM = (isoString: string | null): string | null => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    } catch {
      return null
    }
  }

  return {
    log_date: sleep.calendar_date || sleep.date,
    bedtime: sleep.bedtime_start ? `${sleep.calendar_date}T${parseTimeToHHMM(sleep.bedtime_start)}:00` : null,
    wake_time: sleep.bedtime_stop ? `${sleep.calendar_date}T${parseTimeToHHMM(sleep.bedtime_stop)}:00` : null,
    total_sleep_minutes: secondsToMinutes(sleep.duration || sleep.total),
    deep_sleep_minutes: secondsToMinutes(sleep.deep),
    rem_sleep_minutes: secondsToMinutes(sleep.rem),
    light_sleep_minutes: secondsToMinutes(sleep.light),
    awake_minutes: secondsToMinutes(sleep.awake),
    sleep_score: sleep.efficiency ? Math.round(sleep.efficiency * 100) : null,
    hrv_avg: sleep.average_hrv ? Math.round(sleep.average_hrv) : null,
    resting_hr: sleep.hr_average ? Math.round(sleep.hr_average) : null,
    respiratory_rate: sleep.respiratory_rate,
    source: `${sleep.source.provider}_junction` as const,
  }
}

// Provider slugs for reference
export const JUNCTION_PROVIDERS = {
  EIGHT_SLEEP: 'eight_sleep',
  OURA: 'oura',
  WHOOP: 'whoop_v2',
  GARMIN: 'garmin',
  FITBIT: 'fitbit',
  APPLE_HEALTH: 'apple_health_kit',
  WITHINGS: 'withings',
  WAHOO: 'wahoo',
  ZWIFT: 'zwift',
} as const
