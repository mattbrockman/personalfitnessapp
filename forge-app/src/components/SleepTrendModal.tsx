'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts'
import { X, TrendingUp, Activity, Heart, Wind, Clock, Moon, Sun } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface SleepLog {
  id: string
  log_date: string
  bedtime?: string
  wake_time?: string
  total_sleep_minutes?: number
  deep_sleep_minutes?: number
  rem_sleep_minutes?: number
  light_sleep_minutes?: number
  awake_minutes?: number
  sleep_score?: number
  hrv_avg?: number
  resting_hr?: number
  respiratory_rate?: number
}

export type SleepMetricType = 'score' | 'duration' | 'bedtime' | 'wake_time' | 'hrv' | 'hr' | 'respiratory' | 'stages' | 'all'

interface SleepTrendModalProps {
  metric: SleepMetricType
  sleepLogs: SleepLog[]
  onClose: () => void
}

const METRIC_CONFIG: Record<string, {
  label: string
  color: string
  icon: typeof Activity
  unit: string
  getValue: (log: SleepLog) => number | null
  formatValue: (value: number) => string
}> = {
  score: {
    label: 'Sleep Score',
    color: '#f59e0b',
    icon: TrendingUp,
    unit: '',
    getValue: (log) => log.sleep_score ?? null,
    formatValue: (v) => `${Math.round(v)}`,
  },
  duration: {
    label: 'Total Sleep',
    color: '#8b5cf6',
    icon: Clock,
    unit: '',
    getValue: (log) => log.total_sleep_minutes ?? null,
    formatValue: (v) => `${Math.floor(Math.round(v) / 60)}h ${Math.round(v) % 60}m`,
  },
  hrv: {
    label: 'HRV',
    color: '#10b981',
    icon: Activity,
    unit: 'ms',
    getValue: (log) => log.hrv_avg ?? null,
    formatValue: (v) => `${Math.round(v)} ms`,
  },
  hr: {
    label: 'Resting Heart Rate',
    color: '#ef4444',
    icon: Heart,
    unit: 'bpm',
    getValue: (log) => log.resting_hr ?? null,
    formatValue: (v) => `${Math.round(v)} bpm`,
  },
  respiratory: {
    label: 'Respiratory Rate',
    color: '#0ea5e9',
    icon: Wind,
    unit: 'bpm',
    getValue: (log) => log.respiratory_rate ?? null,
    formatValue: (v) => `${v.toFixed(1)} bpm`,
  },
  bedtime: {
    label: 'Bedtime',
    color: '#8b5cf6',
    icon: Moon,
    unit: '',
    getValue: (log) => {
      if (!log.bedtime) return null
      const date = new Date(log.bedtime)
      let hours = date.getHours() + date.getMinutes() / 60
      // Normalize to evening hours (move early morning times to after midnight representation)
      if (hours < 12) hours += 24
      return hours
    },
    formatValue: (v) => {
      const hours = v >= 24 ? v - 24 : v
      const h = Math.floor(hours)
      const m = Math.round((hours - h) * 60)
      const period = h >= 12 && h < 24 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
    },
  },
  wake_time: {
    label: 'Wake Time',
    color: '#f59e0b',
    icon: Sun,
    unit: '',
    getValue: (log) => {
      if (!log.wake_time) return null
      const date = new Date(log.wake_time)
      return date.getHours() + date.getMinutes() / 60
    },
    formatValue: (v) => {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      const period = h >= 12 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
    },
  },
}

// Custom tooltip component
function CustomTooltip({ active, payload, label, metricKey }: any) {
  if (!active || !payload?.length) return null

  const config = METRIC_CONFIG[metricKey]
  if (!config) return null

  return (
    <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-tertiary mb-1">{label}</p>
      <p className="text-sm font-medium" style={{ color: config.color }}>
        {config.formatValue(payload[0].value)}
      </p>
    </div>
  )
}

// Single metric chart
function MetricChart({
  metricKey,
  sleepLogs
}: {
  metricKey: string
  sleepLogs: SleepLog[]
}) {
  const config = METRIC_CONFIG[metricKey]
  if (!config) return null

  const chartData = useMemo(() => {
    return sleepLogs
      .filter(log => config.getValue(log) !== null)
      .map(log => ({
        date: format(parseISO(log.log_date), 'MMM d'),
        value: config.getValue(log),
        fullDate: log.log_date,
      }))
      .reverse() // Oldest first for chart
  }, [sleepLogs, config])

  const average = useMemo(() => {
    const values = chartData.map(d => d.value).filter((v): v is number => v !== null)
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-secondary">
        No data available
      </div>
    )
  }

  const Icon = config.icon

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: config.color }} />
          <span className="font-medium">{config.label}</span>
        </div>
        <div className="text-sm text-tertiary">
          Avg: <span style={{ color: config.color }}>{config.formatValue(average)}</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              domain={metricKey === 'bedtime' ? [21, 27] : metricKey === 'wake_time' ? [5, 10] : ['auto', 'auto']}
              ticks={metricKey === 'bedtime' ? [21, 22, 23, 24, 25, 26, 27] : metricKey === 'wake_time' ? [5, 6, 7, 8, 9, 10] : undefined}
              tickFormatter={metricKey === 'bedtime' || metricKey === 'wake_time' ? (v) => {
                const hours = v >= 24 ? v - 24 : v
                const period = hours >= 12 && hours < 24 ? 'PM' : 'AM'
                const displayH = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
                return `${displayH} ${period}`
              } : undefined}
            />
            <Tooltip content={<CustomTooltip metricKey={metricKey} />} />
            <ReferenceLine y={average} stroke={config.color} strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 0, r: 3 }}
              activeDot={{ fill: config.color, strokeWidth: 0, r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Sleep stages stacked area chart
function StagesChart({ sleepLogs }: { sleepLogs: SleepLog[] }) {
  const chartData = useMemo(() => {
    return sleepLogs
      .filter(log => log.deep_sleep_minutes || log.rem_sleep_minutes || log.light_sleep_minutes)
      .map(log => {
        const total = (log.deep_sleep_minutes || 0) + (log.rem_sleep_minutes || 0) +
                     (log.light_sleep_minutes || 0) + (log.awake_minutes || 0)
        return {
          date: format(parseISO(log.log_date), 'MMM d'),
          deep: log.deep_sleep_minutes || 0,
          rem: log.rem_sleep_minutes || 0,
          light: log.light_sleep_minutes || 0,
          awake: log.awake_minutes || 0,
          total,
        }
      })
      .reverse()
  }, [sleepLogs])

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-secondary">
        No sleep stage data available
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">Sleep Stages</span>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-tertiary">Deep</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-tertiary">REM</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-tertiary">Light</span>
          </div>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => `${Math.floor(v / 60)}h`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#27272a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              formatter={(value: number, name: string) => [
                `${Math.floor(value / 60)}h ${value % 60}m`,
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <Area
              type="monotone"
              dataKey="deep"
              stackId="1"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="rem"
              stackId="1"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="light"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.8}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SleepTrendModal({ metric, sleepLogs, onClose }: SleepTrendModalProps) {
  // Filter to last 30 days of data
  const recentLogs = useMemo(() => {
    return sleepLogs.slice(0, 30)
  }, [sleepLogs])

  const renderContent = () => {
    if (metric === 'all') {
      // Show all metrics in a scrollable view
      return (
        <div className="space-y-6">
          <MetricChart metricKey="score" sleepLogs={recentLogs} />
          <div className="border-t border-white/10 pt-6">
            <MetricChart metricKey="duration" sleepLogs={recentLogs} />
          </div>
          <div className="border-t border-white/10 pt-6">
            <StagesChart sleepLogs={recentLogs} />
          </div>
          <div className="border-t border-white/10 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricChart metricKey="bedtime" sleepLogs={recentLogs} />
              <MetricChart metricKey="wake_time" sleepLogs={recentLogs} />
            </div>
          </div>
          <div className="border-t border-white/10 pt-6">
            <MetricChart metricKey="hrv" sleepLogs={recentLogs} />
          </div>
          <div className="border-t border-white/10 pt-6">
            <MetricChart metricKey="hr" sleepLogs={recentLogs} />
          </div>
          <div className="border-t border-white/10 pt-6">
            <MetricChart metricKey="respiratory" sleepLogs={recentLogs} />
          </div>
        </div>
      )
    }

    if (metric === 'stages') {
      return <StagesChart sleepLogs={recentLogs} />
    }

    return <MetricChart metricKey={metric} sleepLogs={recentLogs} />
  }

  const getTitle = () => {
    if (metric === 'all') return 'Sleep Trends'
    if (metric === 'stages') return 'Sleep Stages Trend'
    return `${METRIC_CONFIG[metric]?.label || 'Sleep'} Trend`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-3xl overflow-hidden border border-white/10 animate-slide-up max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg">{getTitle()}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {recentLogs.length === 0 ? (
            <div className="text-center py-12 text-secondary">
              <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
              <p>No sleep data to display</p>
              <p className="text-sm mt-1">Sync your Eight Sleep data to see trends</p>
            </div>
          ) : (
            renderContent()
          )}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          <p className="text-xs text-secondary text-center">
            Showing last {recentLogs.length} days of sleep data
          </p>
        </div>
      </div>
    </div>
  )
}
