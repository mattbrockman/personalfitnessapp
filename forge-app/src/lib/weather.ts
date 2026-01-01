// Weather API client using Open-Meteo (free, no API key required)

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const US_ZIP_GEOCODING_URL = 'https://api.zippopotam.us/us'

export type PrecipType = 'rain' | 'snow' | 'mix' | 'none'

export interface WeatherDay {
  date: string // YYYY-MM-DD
  weatherCode: number
  weatherDescription: string
  weatherIcon: string
  tempHigh: number // Fahrenheit
  tempLow: number // Fahrenheit
  precipProbability: number // 0-100
  humidity: number // 0-100
  windSpeed: number // mph
  windGusts: number // mph
  hourly: {
    time: string[] // HH:MM format
    temperature: number[] // Fahrenheit
    precipProbability: number[] // 0-100
    precipType: PrecipType[] // rain, snow, mix, or none
  }
}

export interface GeoLocation {
  lat: number
  lon: number
  name: string
}

// Weather code to icon mapping (Open-Meteo WMO codes)
const WEATHER_CODE_MAP: Record<number, { icon: string; description: string }> = {
  0: { icon: 'sun', description: 'Clear sky' },
  1: { icon: 'cloud-sun', description: 'Mainly clear' },
  2: { icon: 'cloud-sun', description: 'Partly cloudy' },
  3: { icon: 'cloud', description: 'Overcast' },
  45: { icon: 'cloud-fog', description: 'Fog' },
  48: { icon: 'cloud-fog', description: 'Depositing rime fog' },
  51: { icon: 'cloud-drizzle', description: 'Light drizzle' },
  53: { icon: 'cloud-drizzle', description: 'Moderate drizzle' },
  55: { icon: 'cloud-drizzle', description: 'Dense drizzle' },
  56: { icon: 'cloud-drizzle', description: 'Freezing drizzle' },
  57: { icon: 'cloud-drizzle', description: 'Dense freezing drizzle' },
  61: { icon: 'cloud-rain', description: 'Slight rain' },
  63: { icon: 'cloud-rain', description: 'Moderate rain' },
  65: { icon: 'cloud-rain', description: 'Heavy rain' },
  66: { icon: 'cloud-rain', description: 'Freezing rain' },
  67: { icon: 'cloud-rain', description: 'Heavy freezing rain' },
  71: { icon: 'snowflake', description: 'Slight snow' },
  73: { icon: 'snowflake', description: 'Moderate snow' },
  75: { icon: 'snowflake', description: 'Heavy snow' },
  77: { icon: 'snowflake', description: 'Snow grains' },
  80: { icon: 'cloud-rain', description: 'Slight rain showers' },
  81: { icon: 'cloud-rain', description: 'Moderate rain showers' },
  82: { icon: 'cloud-rain', description: 'Violent rain showers' },
  85: { icon: 'snowflake', description: 'Slight snow showers' },
  86: { icon: 'snowflake', description: 'Heavy snow showers' },
  95: { icon: 'cloud-lightning', description: 'Thunderstorm' },
  96: { icon: 'cloud-lightning', description: 'Thunderstorm with hail' },
  99: { icon: 'cloud-lightning', description: 'Thunderstorm with heavy hail' },
}

export function weatherCodeToIcon(code: number): string {
  return WEATHER_CODE_MAP[code]?.icon || 'cloud'
}

export function weatherCodeToDescription(code: number): string {
  return WEATHER_CODE_MAP[code]?.description || 'Unknown'
}

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5) + 32)
}

// Convert km/h to mph
function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371)
}

// Determine precipitation type from hourly rain/snow amounts
function getPrecipType(rainMm: number, snowCm: number): PrecipType {
  const hasRain = rainMm > 0
  const hasSnow = snowCm > 0
  if (hasRain && hasSnow) return 'mix'
  if (hasSnow) return 'snow'
  if (hasRain) return 'rain'
  return 'none'
}

/**
 * Get coordinates from a US zip code using Zippopotam.us API
 */
export async function getCoordinatesFromZip(zipCode: string): Promise<GeoLocation> {
  // Clean zip code
  const cleanZip = zipCode.replace(/\D/g, '').slice(0, 5)

  if (cleanZip.length !== 5) {
    throw new Error('Invalid zip code format')
  }

  const response = await fetch(`${US_ZIP_GEOCODING_URL}/${cleanZip}`)

  if (!response.ok) {
    throw new Error('Zip code not found')
  }

  const data = await response.json()

  if (!data.places || data.places.length === 0) {
    throw new Error('No location found for this zip code')
  }

  const place = data.places[0]

  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    name: `${place['place name']}, ${place['state abbreviation']}`,
  }
}

/**
 * Get coordinates from lat/lon (reverse geocoding for display name)
 */
export async function getLocationName(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    count: '1',
  })

  try {
    // Open-Meteo doesn't have reverse geocoding, so we'll just return coordinates
    // For better names, you could integrate with a reverse geocoding API
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
  } catch {
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
  }
}

/**
 * Fetch weather forecast from Open-Meteo API
 */
export async function getWeatherForecast(
  lat: number,
  lon: number,
  days: number = 14
): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max,wind_gusts_10m_max',
    hourly: 'temperature_2m,precipitation_probability,rain,snowfall',
    temperature_unit: 'celsius', // We'll convert to Fahrenheit
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    timezone: 'auto',
    forecast_days: Math.min(days, 16).toString(), // Open-Meteo max is 16 days
  })

  const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`)

  if (!response.ok) {
    throw new Error('Failed to fetch weather data')
  }

  const data = await response.json()

  if (!data.daily || !data.daily.time) {
    throw new Error('Invalid weather data received')
  }

  const forecast: WeatherDay[] = []

  for (let i = 0; i < data.daily.time.length; i++) {
    const date = data.daily.time[i]
    const weatherCode = data.daily.weather_code[i]

    // Get hourly data for this day
    const dayStartIndex = i * 24
    const hourlyTemps = data.hourly.temperature_2m.slice(dayStartIndex, dayStartIndex + 24)
    const hourlyPrecip = data.hourly.precipitation_probability.slice(dayStartIndex, dayStartIndex + 24)
    const hourlyRain = data.hourly.rain.slice(dayStartIndex, dayStartIndex + 24)
    const hourlySnow = data.hourly.snowfall.slice(dayStartIndex, dayStartIndex + 24)
    const hourlyTimes = data.hourly.time.slice(dayStartIndex, dayStartIndex + 24).map((t: string) => {
      const date = new Date(t)
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    })

    // Determine precip type for each hour
    const hourlyPrecipType: PrecipType[] = hourlyRain.map((rain: number, idx: number) =>
      getPrecipType(rain, hourlySnow[idx])
    )

    forecast.push({
      date,
      weatherCode,
      weatherDescription: weatherCodeToDescription(weatherCode),
      weatherIcon: weatherCodeToIcon(weatherCode),
      tempHigh: celsiusToFahrenheit(data.daily.temperature_2m_max[i]),
      tempLow: celsiusToFahrenheit(data.daily.temperature_2m_min[i]),
      precipProbability: data.daily.precipitation_probability_max[i] || 0,
      humidity: data.daily.relative_humidity_2m_max[i] || 0,
      windSpeed: kmhToMph(data.daily.wind_speed_10m_max[i] || 0),
      windGusts: kmhToMph(data.daily.wind_gusts_10m_max[i] || 0),
      hourly: {
        time: hourlyTimes,
        temperature: hourlyTemps.map((t: number) => celsiusToFahrenheit(t)),
        precipProbability: hourlyPrecip,
        precipType: hourlyPrecipType,
      },
    })
  }

  return forecast
}

/**
 * Check if weather is bad for outdoor activities
 */
export function isBadWeatherForOutdoor(weather: WeatherDay): boolean {
  // Rain or snow
  if (weather.weatherCode >= 51) return true
  // High rain probability
  if (weather.precipProbability > 60) return true
  // Extreme temperatures
  if (weather.tempHigh > 95 || weather.tempLow < 32) return true
  return false
}

/**
 * Get weather summary for AI context
 */
export function getWeatherSummaryForAI(forecast: WeatherDay[]): string {
  if (forecast.length === 0) return ''

  const lines = forecast.map(day => {
    const badWeather = isBadWeatherForOutdoor(day)
    return `${day.date}: ${day.weatherDescription}, ${day.tempHigh}°F/${day.tempLow}°F, ${day.precipProbability}% rain${badWeather ? ' [POOR CONDITIONS]' : ''}`
  })

  return `Weather forecast (next ${forecast.length} days):\n${lines.join('\n')}`
}
