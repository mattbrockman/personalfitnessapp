'use client'

import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Snowflake,
} from 'lucide-react'
import { WeatherDay } from '@/lib/weather'

interface WeatherBadgeProps {
  weather: WeatherDay
  onClick?: () => void
  size?: 'sm' | 'md'
}

// Map weather icon names to Lucide components
const ICON_MAP: Record<string, typeof Sun> = {
  'sun': Sun,
  'cloud': Cloud,
  'cloud-sun': CloudSun,
  'cloud-rain': CloudRain,
  'cloud-drizzle': CloudDrizzle,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
  'cloud-fog': CloudFog,
  'snowflake': Snowflake,
}

// Weather icon colors
const ICON_COLORS: Record<string, string> = {
  'sun': 'text-amber-400',
  'cloud': 'text-gray-400',
  'cloud-sun': 'text-amber-300',
  'cloud-rain': 'text-sky-400',
  'cloud-drizzle': 'text-sky-300',
  'cloud-snow': 'text-blue-200',
  'cloud-lightning': 'text-violet-400',
  'cloud-fog': 'text-gray-400',
  'snowflake': 'text-blue-300',
}

export function WeatherBadge({ weather, onClick, size = 'sm' }: WeatherBadgeProps) {
  const IconComponent = ICON_MAP[weather.weatherIcon] || Cloud
  const iconColor = ICON_COLORS[weather.weatherIcon] || 'text-gray-400'

  const isSmall = size === 'sm'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md transition-colors hover:bg-white/10 ${
        isSmall ? 'px-1 py-0.5' : 'px-2 py-1'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      title={`${weather.weatherDescription}\nHigh: ${weather.tempHigh}°F, Low: ${weather.tempLow}°F\n${weather.precipProbability}% chance of rain`}
    >
      <IconComponent size={isSmall ? 12 : 16} className={iconColor} />
      <span className={`text-white/70 ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
        {weather.tempHigh}°/{weather.tempLow}°
      </span>
    </button>
  )
}

// Compact version for tight spaces
export function WeatherBadgeCompact({ weather, onClick }: { weather: WeatherDay; onClick?: () => void }) {
  const IconComponent = ICON_MAP[weather.weatherIcon] || Cloud
  const iconColor = ICON_COLORS[weather.weatherIcon] || 'text-gray-400'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 hover:bg-white/10 rounded px-0.5 transition-colors"
      title={weather.weatherDescription}
    >
      <IconComponent size={10} className={iconColor} />
      <span className="text-[9px] text-white/60">{weather.tempHigh}°</span>
    </button>
  )
}
