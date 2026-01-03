'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { PrecipType } from '@/lib/weather'
import {
  X,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Snowflake,
  Droplets,
  Wind,
  Thermometer,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { WeatherDay } from '@/lib/weather'

interface WeatherDetailModalProps {
  weather: WeatherDay
  onClose: () => void
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

export function WeatherDetailModal({ weather, onClose }: WeatherDetailModalProps) {
  const IconComponent = ICON_MAP[weather.weatherIcon] || Cloud
  const iconColor = ICON_COLORS[weather.weatherIcon] || 'text-gray-400'

  // Prepare hourly data for charts
  const hourlyData = useMemo(() => {
    return weather.hourly.time.map((time, i) => ({
      time,
      temp: weather.hourly.temperature[i],
      precip: weather.hourly.precipProbability[i],
      precipType: weather.hourly.precipType?.[i] || 'none',
    }))
  }, [weather.hourly])

  // Filter to show every 3 hours for cleaner chart
  const chartData = useMemo(() => {
    return hourlyData.filter((_, i) => i % 3 === 0)
  }, [hourlyData])

  // Get color for precipitation type
  const getPrecipColor = (type: PrecipType): string => {
    switch (type) {
      case 'rain': return '#0ea5e9'    // sky-500 (blue)
      case 'mix': return '#a855f7'     // purple-500
      case 'snow': return '#e5e7eb'    // gray-200 (white)
      default: return '#0ea5e9'
    }
  }

  const formattedDate = format(parseISO(weather.date), 'EEEE, MMMM d')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconComponent size={28} className={iconColor} />
            <div>
              <h3 className="font-semibold">{formattedDate}</h3>
              <p className="text-sm text-white/60">{weather.weatherDescription}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Main stats */}
        <div className="p-4 grid grid-cols-4 gap-4 border-b border-white/10">
          <div className="text-center">
            <Thermometer size={18} className="mx-auto text-red-400 mb-1" />
            <p className="text-lg font-semibold">{weather.tempHigh}°</p>
            <p className="text-xs text-secondary">High</p>
          </div>
          <div className="text-center">
            <Thermometer size={18} className="mx-auto text-sky-400 mb-1" />
            <p className="text-lg font-semibold">{weather.tempLow}°</p>
            <p className="text-xs text-secondary">Low</p>
          </div>
          <div className="text-center">
            <Droplets size={18} className="mx-auto text-sky-400 mb-1" />
            <p className="text-lg font-semibold">{weather.precipProbability}%</p>
            <p className="text-xs text-secondary">Rain</p>
          </div>
          <div className="text-center">
            <Wind size={18} className="mx-auto text-white/60 mb-1" />
            <p className="text-lg font-semibold">{weather.windSpeed}<span className="text-secondary">/</span>{weather.windGusts}</p>
            <p className="text-xs text-secondary">mph / gusts</p>
          </div>
        </div>

        {/* Combined Temperature & Precipitation Chart */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white/60">Hourly Forecast</h4>
            <div className="flex items-center gap-4 text-xs text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-500 rounded"></span> Temp
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-sky-500 rounded-sm"></span> Rain
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-500 rounded-sm"></span> Mix
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-200 rounded-sm"></span> Snow
              </span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                {/* Left Y-axis for Temperature */}
                <YAxis
                  yAxisId="temp"
                  orientation="left"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}°`}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                {/* Right Y-axis for Precipitation */}
                <YAxis
                  yAxisId="precip"
                  orientation="right"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'temp') return [`${value}°F`, 'Temperature']
                    if (name === 'precip') return [`${value}%`, 'Precipitation']
                    return [value, name]
                  }}
                />
                {/* Precipitation Bars (behind) */}
                <Bar
                  yAxisId="precip"
                  dataKey="precip"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPrecipColor(entry.precipType as PrecipType)} />
                  ))}
                </Bar>
                {/* Temperature Line (in front) */}
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: '#f59e0b', strokeWidth: 0, r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
