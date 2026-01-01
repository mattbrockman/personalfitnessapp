'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
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
    }))
  }, [weather.hourly])

  // Filter to show every 3 hours for cleaner chart
  const chartData = useMemo(() => {
    return hourlyData.filter((_, i) => i % 3 === 0)
  }, [hourlyData])

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
            <p className="text-xs text-white/40">High</p>
          </div>
          <div className="text-center">
            <Thermometer size={18} className="mx-auto text-sky-400 mb-1" />
            <p className="text-lg font-semibold">{weather.tempLow}°</p>
            <p className="text-xs text-white/40">Low</p>
          </div>
          <div className="text-center">
            <Droplets size={18} className="mx-auto text-sky-400 mb-1" />
            <p className="text-lg font-semibold">{weather.precipProbability}%</p>
            <p className="text-xs text-white/40">Rain</p>
          </div>
          <div className="text-center">
            <Wind size={18} className="mx-auto text-white/60 mb-1" />
            <p className="text-lg font-semibold">{weather.windSpeed}</p>
            <p className="text-xs text-white/40">mph</p>
          </div>
        </div>

        {/* Temperature Chart */}
        <div className="p-4 border-b border-white/10">
          <h4 className="text-sm font-medium text-white/60 mb-3">Temperature</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}°`}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  formatter={(value: number) => [`${value}°F`, 'Temp']}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: '#f59e0b', strokeWidth: 0, r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Precipitation Chart */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-white/60 mb-3">Chance of Rain</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
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
                  formatter={(value: number) => [`${value}%`, 'Rain']}
                />
                <Bar
                  dataKey="precip"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
