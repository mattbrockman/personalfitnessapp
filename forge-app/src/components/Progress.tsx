'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Dumbbell,
  Scale,
  Heart,
  Activity,
  Zap,
  Target,
  Award,
  Flame,
  Camera,
  X,
  Loader2,
} from 'lucide-react'
import { BodyScanner } from './BodyScanner'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts'

// Types
interface ProgressDataPoint {
  date: string
  weekStart: string
  weight?: number
  bodyFat?: number
  benchPress?: number
  squat?: number
  deadlift?: number
  ctl?: number
  atl?: number
  tsb?: number
  weeklyVolume?: number
  avgSleepScore?: number
  avgHRV?: number
  proteinAvg?: number
}

interface PersonalRecord {
  exercise: string
  weight: number
  reps: number
  date: string
  previousBest?: number
}

interface ProgressData {
  weeklyData: ProgressDataPoint[]
  personalRecords: PersonalRecord[]
  summary: {
    latestWeight: number | null
    latestBenchPress: number | null
    latestCTL: number | null
    latestHRV: number | null
  }
}

// Time range options
const TIME_RANGES = [
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-white/60 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/60">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  change,
  changeLabel,
  color,
  loading,
}: {
  icon: React.ElementType
  label: string
  value: string | number | null
  unit?: string
  change?: number
  changeLabel?: string
  color: string
  loading?: boolean
}) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {loading ? (
          <Loader2 size={24} className="animate-spin text-secondary" />
        ) : (
          <>
            <span className="text-2xl font-bold">{value ?? '—'}</span>
            {unit && value !== null && <span className="text-secondary">{unit}</span>}
          </>
        )}
      </div>
      {change !== undefined && !loading && (
        <div className={`flex items-center gap-1 mt-1 text-sm ${
          isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-secondary'
        }`}>
          {isPositive && <TrendingUp size={14} />}
          {isNegative && <TrendingDown size={14} />}
          {!isPositive && !isNegative && <Minus size={14} />}
          <span>{isPositive ? '+' : ''}{change}%</span>
          {changeLabel && <span className="text-secondary">{changeLabel}</span>}
        </div>
      )}
    </div>
  )
}

// PR Card
function PRCard({ record }: { record: PersonalRecord }) {
  const improvement = record.previousBest
    ? Math.round(((record.weight - record.previousBest) / record.previousBest) * 100)
    : null

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
        <Award size={24} className="text-amber-400" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium">{record.exercise}</h4>
        <p className="text-sm text-tertiary">
          {record.weight} lbs × {record.reps} rep{record.reps > 1 ? 's' : ''}
        </p>
      </div>
      <div className="text-right">
        {improvement !== null && improvement > 0 && (
          <span className="text-emerald-400 text-sm font-medium">+{improvement}%</span>
        )}
        <p className="text-xs text-secondary">
          {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Activity size={32} className="text-white/20" />
      </div>
      <p className="text-secondary">{message}</p>
    </div>
  )
}

// Main Progress component
export function Progress() {
  const [timeRange, setTimeRange] = useState('3m')
  const [activeChart, setActiveChart] = useState<'strength' | 'body' | 'fitness' | 'recovery'>('strength')
  const [showBodyScanner, setShowBodyScanner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProgressData | null>(null)

  // Fetch progress data
  useEffect(() => {
    async function fetchProgress() {
      setLoading(true)
      try {
        const response = await fetch(`/api/progress?range=${timeRange}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProgress()
  }, [timeRange])

  // Calculate changes from data
  const weeklyData = data?.weeklyData || []
  const firstData = weeklyData[0]
  const latestData = weeklyData[weeklyData.length - 1]

  const weightChange = latestData?.weight && firstData?.weight
    ? Math.round(((latestData.weight - firstData.weight) / firstData.weight) * 100 * 10) / 10
    : undefined

  const strengthChange = latestData?.benchPress && firstData?.benchPress
    ? Math.round(((latestData.benchPress - firstData.benchPress) / firstData.benchPress) * 100)
    : undefined

  const fitnessChange = latestData?.ctl && firstData?.ctl
    ? Math.round(((latestData.ctl - firstData.ctl) / firstData.ctl) * 100)
    : undefined

  const hrvChange = latestData?.avgHRV && firstData?.avgHRV
    ? Math.round(((latestData.avgHRV - firstData.avgHRV) / firstData.avgHRV) * 100)
    : undefined

  const hasStrengthData = weeklyData.some(d => d.benchPress || d.squat || d.deadlift)
  const hasBodyData = weeklyData.some(d => d.weight || d.bodyFat)
  const hasFitnessData = weeklyData.some(d => d.ctl || d.atl || d.tsb)
  const hasRecoveryData = weeklyData.some(d => d.avgHRV || d.avgSleepScore)
  const hasVolumeData = weeklyData.some(d => d.weeklyVolume)
  const hasProteinData = weeklyData.some(d => d.proteinAvg)

  return (
    <div className="p-4 lg:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Progress</h1>
          <p className="text-tertiary">Track your gains over time</p>
        </div>

        {/* Time range selector */}
        <div className="relative">
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            className="appearance-none bg-white/10 border border-white/10 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:border-amber-500/50"
          >
            {TIME_RANGES.map(range => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Scale}
          label="Body Weight"
          value={data?.summary.latestWeight ?? latestData?.weight ?? null}
          unit="lbs"
          change={weightChange}
          changeLabel="vs start"
          color="bg-sky-500/20 text-sky-400"
          loading={loading}
        />
        <StatCard
          icon={Dumbbell}
          label="Bench Press"
          value={data?.summary.latestBenchPress ?? latestData?.benchPress ?? null}
          unit="lbs"
          change={strengthChange}
          changeLabel="vs start"
          color="bg-violet-500/20 text-violet-400"
          loading={loading}
        />
        <StatCard
          icon={Zap}
          label="Fitness (CTL)"
          value={data?.summary.latestCTL ?? latestData?.ctl ?? null}
          change={fitnessChange}
          changeLabel="vs start"
          color="bg-amber-500/20 text-amber-400"
          loading={loading}
        />
        <StatCard
          icon={Heart}
          label="Avg HRV"
          value={data?.summary.latestHRV ?? latestData?.avgHRV ?? null}
          unit="ms"
          change={hrvChange}
          changeLabel="vs start"
          color="bg-emerald-500/20 text-emerald-400"
          loading={loading}
        />
      </div>

      {/* Chart type tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { id: 'strength', label: 'Strength', icon: Dumbbell },
          { id: 'body', label: 'Body Comp', icon: Scale },
          { id: 'fitness', label: 'Fitness', icon: Activity },
          { id: 'recovery', label: 'Recovery', icon: Heart },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveChart(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeChart === tab.id
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body Scan Button - show when on body tab */}
      {activeChart === 'body' && (
        <button
          onClick={() => setShowBodyScanner(true)}
          className="w-full mb-4 py-3 bg-gradient-to-r from-amber-500/20 to-violet-500/20 hover:from-amber-500/30 hover:to-violet-500/30 border border-amber-500/30 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Camera size={18} className="text-amber-400" />
          <span>AI Body Scan</span>
          <span className="text-xs text-tertiary ml-2">Analyze from photo</span>
        </button>
      )}

      {/* Main chart */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="h-80">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-secondary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === 'strength' ? (
                hasStrengthData ? (
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="benchPress"
                      name="Bench Press"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="squat"
                      name="Squat"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="deadlift"
                      name="Deadlift"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 0 }}
                      connectNulls
                    />
                  </LineChart>
                ) : (
                  <EmptyState message="No strength data yet. Log workouts to track your lifts." />
                )
              ) : activeChart === 'body' ? (
                hasBodyData ? (
                  <ComposedChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="weight"
                      name="Weight (lbs)"
                      fill="rgba(14, 165, 233, 0.2)"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      connectNulls
                    />
                    {weeklyData.some(d => d.bodyFat) && (
                      <Line
                        type="monotone"
                        dataKey="bodyFat"
                        name="Body Fat %"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', strokeWidth: 0 }}
                        connectNulls
                      />
                    )}
                  </ComposedChart>
                ) : (
                  <EmptyState message="No body composition data yet. Log your weight or do a body scan." />
                )
              ) : activeChart === 'fitness' ? (
                hasFitnessData ? (
                  <ComposedChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ctl"
                      name="Fitness (CTL)"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="atl"
                      name="Fatigue (ATL)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', strokeWidth: 0 }}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="tsb"
                      name="Form (TSB)"
                      fill="rgba(139, 92, 246, 0.2)"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      connectNulls
                    />
                  </ComposedChart>
                ) : (
                  <EmptyState message="No training load data yet. Complete workouts to build your fitness profile." />
                )
              ) : (
                hasRecoveryData ? (
                  <ComposedChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis yAxisId="left" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avgHRV"
                      name="HRV (ms)"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avgSleepScore"
                      name="Sleep Score"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                      connectNulls
                    />
                  </ComposedChart>
                ) : (
                  <EmptyState message="No recovery data yet. Log sleep or connect a wearable." />
                )
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Weekly Volume chart */}
      {hasVolumeData && (
        <div className="glass rounded-xl p-4 mb-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Flame size={18} className="text-amber-400" />
            Weekly Training Volume
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="weeklyVolume"
                  name="Volume (lbs)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Personal Records */}
      {data?.personalRecords && data.personalRecords.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            Recent Personal Records
          </h3>
          <div className="space-y-3">
            {data.personalRecords.map((record, i) => (
              <PRCard key={i} record={record} />
            ))}
          </div>
        </div>
      )}

      {/* Protein tracking */}
      {hasProteinData && (
        <div className="glass rounded-xl p-4">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Target size={18} className="text-emerald-400" />
            Protein Consistency
          </h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="proteinGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="proteinAvg"
                  name="Protein (g)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#proteinGradient)"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-secondary mt-2">
            Avg: {Math.round(weeklyData.reduce((sum, d) => sum + (d.proteinAvg || 0), 0) / weeklyData.filter(d => d.proteinAvg).length) || '—'}g/day
          </p>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!loading && weeklyData.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Activity size={40} className="text-amber-500/50" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Progress Data Yet</h3>
          <p className="text-tertiary max-w-sm mx-auto">
            Start logging workouts, body weight, sleep, and nutrition to see your progress over time.
          </p>
        </div>
      )}

      {/* Body Scanner Modal */}
      {showBodyScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setShowBodyScanner(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <BodyScanner />
          </div>
        </div>
      )}
    </div>
  )
}
