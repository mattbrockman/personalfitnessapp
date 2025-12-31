'use client'

import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronDown,
  Dumbbell,
  Scale,
  Heart,
  Activity,
  Zap,
  Target,
  Award,
  Flame,
} from 'lucide-react'
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
  weight?: number
  bodyFat?: number
  benchPress?: number
  squat?: number
  deadlift?: number
  ctl?: number // Chronic Training Load (fitness)
  atl?: number // Acute Training Load (fatigue)
  tsb?: number // Training Stress Balance (form)
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

// Mock data
const PROGRESS_DATA: ProgressDataPoint[] = [
  { date: 'Nov 1', weight: 186, benchPress: 175, squat: 225, deadlift: 315, ctl: 45, atl: 50, tsb: -5, weeklyVolume: 42000, avgSleepScore: 78, avgHRV: 42, proteinAvg: 165 },
  { date: 'Nov 8', weight: 185, benchPress: 175, squat: 230, deadlift: 315, ctl: 48, atl: 55, tsb: -7, weeklyVolume: 45000, avgSleepScore: 75, avgHRV: 40, proteinAvg: 170 },
  { date: 'Nov 15', weight: 185, benchPress: 180, squat: 235, deadlift: 325, ctl: 52, atl: 58, tsb: -6, weeklyVolume: 48000, avgSleepScore: 80, avgHRV: 44, proteinAvg: 168 },
  { date: 'Nov 22', weight: 184, benchPress: 180, squat: 240, deadlift: 325, ctl: 55, atl: 52, tsb: 3, weeklyVolume: 40000, avgSleepScore: 82, avgHRV: 46, proteinAvg: 175 },
  { date: 'Nov 29', weight: 185, benchPress: 185, squat: 245, deadlift: 335, ctl: 58, atl: 60, tsb: -2, weeklyVolume: 50000, avgSleepScore: 79, avgHRV: 45, proteinAvg: 172 },
  { date: 'Dec 6', weight: 184, benchPress: 185, squat: 245, deadlift: 335, ctl: 60, atl: 65, tsb: -5, weeklyVolume: 52000, avgSleepScore: 76, avgHRV: 43, proteinAvg: 168 },
  { date: 'Dec 13', weight: 183, benchPress: 190, squat: 250, deadlift: 345, ctl: 62, atl: 58, tsb: 4, weeklyVolume: 45000, avgSleepScore: 84, avgHRV: 48, proteinAvg: 178 },
  { date: 'Dec 20', weight: 184, benchPress: 190, squat: 255, deadlift: 350, ctl: 64, atl: 62, tsb: 2, weeklyVolume: 48000, avgSleepScore: 81, avgHRV: 47, proteinAvg: 175 },
  { date: 'Dec 27', weight: 183, benchPress: 195, squat: 260, deadlift: 355, ctl: 65, atl: 55, tsb: 10, weeklyVolume: 42000, avgSleepScore: 85, avgHRV: 50, proteinAvg: 180 },
]

const PERSONAL_RECORDS: PersonalRecord[] = [
  { exercise: 'Deadlift', weight: 355, reps: 1, date: '2024-12-27', previousBest: 335 },
  { exercise: 'Squat', weight: 260, reps: 1, date: '2024-12-27', previousBest: 245 },
  { exercise: 'Bench Press', weight: 195, reps: 1, date: '2024-12-27', previousBest: 185 },
  { exercise: 'Overhead Press', weight: 135, reps: 1, date: '2024-12-15', previousBest: 125 },
  { exercise: 'Barbell Row', weight: 185, reps: 5, date: '2024-12-20', previousBest: 175 },
]

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
}: {
  icon: React.ElementType
  label: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  color: string
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
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-white/40">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-sm ${
          isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-white/40'
        }`}>
          {isPositive && <TrendingUp size={14} />}
          {isNegative && <TrendingDown size={14} />}
          {!isPositive && !isNegative && <Minus size={14} />}
          <span>{isPositive ? '+' : ''}{change}%</span>
          {changeLabel && <span className="text-white/40">{changeLabel}</span>}
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
        <p className="text-sm text-white/50">
          {record.weight} lbs × {record.reps} rep{record.reps > 1 ? 's' : ''}
        </p>
      </div>
      <div className="text-right">
        {improvement !== null && (
          <span className="text-emerald-400 text-sm font-medium">+{improvement}%</span>
        )}
        <p className="text-xs text-white/40">
          {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

// Main Progress component
export function Progress() {
  const [timeRange, setTimeRange] = useState('3m')
  const [activeChart, setActiveChart] = useState<'strength' | 'body' | 'fitness' | 'recovery'>('strength')

  // Calculate summary stats
  const latestData = PROGRESS_DATA[PROGRESS_DATA.length - 1]
  const firstData = PROGRESS_DATA[0]

  const weightChange = latestData.weight && firstData.weight
    ? Math.round(((latestData.weight - firstData.weight) / firstData.weight) * 100 * 10) / 10
    : 0

  const strengthChange = latestData.benchPress && firstData.benchPress
    ? Math.round(((latestData.benchPress - firstData.benchPress) / firstData.benchPress) * 100)
    : 0

  const fitnessChange = latestData.ctl && firstData.ctl
    ? Math.round(((latestData.ctl - firstData.ctl) / firstData.ctl) * 100)
    : 0

  const hrvChange = latestData.avgHRV && firstData.avgHRV
    ? Math.round(((latestData.avgHRV - firstData.avgHRV) / firstData.avgHRV) * 100)
    : 0

  return (
    <div className="p-4 lg:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Progress</h1>
          <p className="text-white/50">Track your gains over time</p>
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
          <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Scale}
          label="Body Weight"
          value={latestData.weight || 0}
          unit="lbs"
          change={weightChange}
          changeLabel="vs start"
          color="bg-sky-500/20 text-sky-400"
        />
        <StatCard
          icon={Dumbbell}
          label="Bench Press"
          value={latestData.benchPress || 0}
          unit="lbs"
          change={strengthChange}
          changeLabel="vs start"
          color="bg-violet-500/20 text-violet-400"
        />
        <StatCard
          icon={Zap}
          label="Fitness (CTL)"
          value={latestData.ctl || 0}
          change={fitnessChange}
          changeLabel="vs start"
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          icon={Heart}
          label="Avg HRV"
          value={latestData.avgHRV || 0}
          unit="ms"
          change={hrvChange}
          changeLabel="vs start"
          color="bg-emerald-500/20 text-emerald-400"
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

      {/* Main chart */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === 'strength' ? (
              <LineChart data={PROGRESS_DATA}>
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
                />
                <Line 
                  type="monotone" 
                  dataKey="squat" 
                  name="Squat" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="deadlift" 
                  name="Deadlift" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 0 }}
                />
              </LineChart>
            ) : activeChart === 'body' ? (
              <ComposedChart data={PROGRESS_DATA}>
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
                />
              </ComposedChart>
            ) : activeChart === 'fitness' ? (
              <ComposedChart data={PROGRESS_DATA}>
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
                />
                <Line 
                  type="monotone" 
                  dataKey="atl" 
                  name="Fatigue (ATL)" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 0 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="tsb" 
                  name="Form (TSB)" 
                  fill="rgba(139, 92, 246, 0.2)" 
                  stroke="#8b5cf6"
                  strokeWidth={2}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={PROGRESS_DATA}>
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
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="avgSleepScore" 
                  name="Sleep Score" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Volume chart */}
      <div className="glass rounded-xl p-4 mb-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Flame size={18} className="text-amber-400" />
          Weekly Training Volume
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PROGRESS_DATA}>
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

      {/* Personal Records */}
      <div className="mb-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Award size={18} className="text-amber-400" />
          Recent Personal Records
        </h3>
        <div className="space-y-3">
          {PERSONAL_RECORDS.map((record, i) => (
            <PRCard key={i} record={record} />
          ))}
        </div>
      </div>

      {/* Protein tracking */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Target size={18} className="text-emerald-400" />
          Protein Consistency
        </h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PROGRESS_DATA}>
              <defs>
                <linearGradient id="proteinGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} domain={[150, 190]} />
              <Tooltip content={<CustomTooltip />} />
              {/* Target line */}
              <Line 
                type="monotone" 
                dataKey={() => 180} 
                name="Target" 
                stroke="rgba(255,255,255,0.3)" 
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
              />
              <Area 
                type="monotone" 
                dataKey="proteinAvg" 
                name="Protein (g)" 
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#proteinGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-sm text-white/40 mt-2">
          Avg: {Math.round(PROGRESS_DATA.reduce((sum, d) => sum + (d.proteinAvg || 0), 0) / PROGRESS_DATA.length)}g/day • Target: 180g
        </p>
      </div>
    </div>
  )
}
