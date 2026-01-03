'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Trophy, Dumbbell, TrendingUp, TrendingDown, Minus, Clock, Flame, BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface WeeklySummary {
  week: {
    start: string
    end: string
    formatted: string
  }
  workouts: {
    completed: number
    planned: number
    skipped: number
    total: number
    byType: Record<string, number>
  }
  volume: {
    total: number
    totalSets: number
    previousWeek: number
    changePercent: number
  }
  duration: {
    total: number
    average: number
    previousWeek: number
    changePercent: number
  }
  prs: Array<{
    exerciseName: string
    exerciseId: string
    value: number
    type: string
    date: string
  }>
  muscleDistribution: Array<{
    muscle: string
    sets: number
  }>
  streak: {
    current: number
  }
  comparison: {
    volumeVsLastWeek: number
    workoutsVsLastWeek: number
    durationVsLastWeek: number
  }
}

interface WeeklyProgressModalProps {
  isOpen: boolean
  onClose: () => void
}

const TABS = ['Overview', 'PRs', 'Muscles', 'Trends'] as const
type Tab = typeof TABS[number]

const muscleColors: Record<string, string> = {
  chest: '#EF4444',
  back: '#3B82F6',
  shoulders: '#F59E0B',
  biceps: '#10B981',
  triceps: '#8B5CF6',
  quadriceps: '#EC4899',
  hamstrings: '#14B8A6',
  glutes: '#F97316',
  calves: '#6366F1',
  core: '#84CC16',
  forearms: '#06B6D4',
  traps: '#A855F7',
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function formatMuscle(muscle: string): string {
  return muscle
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex items-center text-emerald-400 text-sm">
        <TrendingUp size={14} className="mr-1" />
        +{value}%
      </span>
    )
  } else if (value < 0) {
    return (
      <span className="flex items-center text-red-400 text-sm">
        <TrendingDown size={14} className="mr-1" />
        {value}%
      </span>
    )
  }
  return (
    <span className="flex items-center text-secondary text-sm">
      <Minus size={14} className="mr-1" />
      0%
    </span>
  )
}

export function WeeklyProgressModal({ isOpen, onClose }: WeeklyProgressModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/weekly-summary?week_offset=${weekOffset}`)
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Failed to fetch weekly summary:', error)
    } finally {
      setLoading(false)
    }
  }, [weekOffset])

  useEffect(() => {
    if (isOpen) {
      fetchSummary()
    }
  }, [isOpen, fetchSummary])

  if (!isOpen) return null

  const completionRate = summary?.workouts.total
    ? Math.round((summary.workouts.completed / summary.workouts.total) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft size={20} className="text-white/60" />
            </button>
            <h2 className="text-lg font-bold">
              {loading ? 'Loading...' : summary?.week.formatted}
            </h2>
            <button
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
              aria-label="Next week"
            >
              <ChevronRight size={20} className="text-white/60" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-amber-400" size={32} />
            </div>
          ) : !summary ? (
            <div className="text-center py-12 text-secondary">
              No data available
            </div>
          ) : (
            <>
              {activeTab === 'Overview' && (
                <OverviewTab summary={summary} completionRate={completionRate} />
              )}
              {activeTab === 'PRs' && <PRsTab prs={summary.prs} />}
              {activeTab === 'Muscles' && <MusclesTab distribution={summary.muscleDistribution} />}
              {activeTab === 'Trends' && <TrendsTab summary={summary} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ summary, completionRate }: { summary: WeeklySummary; completionRate: number }) {
  return (
    <div className="space-y-6">
      {/* Completion Ring */}
      <div className="flex items-center justify-center gap-8">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#F59E0B"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(completionRate / 100) * 352} 352`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-amber-400">{completionRate}%</span>
            <span className="text-xs text-secondary">Complete</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm">{summary.workouts.completed} Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm">{summary.workouts.planned} Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm">{summary.workouts.skipped} Skipped</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <Dumbbell size={16} />
            <span className="text-xs">Total Volume</span>
          </div>
          <p className="text-xl font-bold">{summary.volume.total.toLocaleString()} lbs</p>
          <TrendIndicator value={summary.comparison.volumeVsLastWeek} />
        </div>

        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <BarChart3 size={16} />
            <span className="text-xs">Total Sets</span>
          </div>
          <p className="text-xl font-bold">{summary.volume.totalSets}</p>
          <span className="text-sm text-secondary">hard sets</span>
        </div>

        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <Clock size={16} />
            <span className="text-xs">Time Training</span>
          </div>
          <p className="text-xl font-bold">{formatDuration(summary.duration.total)}</p>
          <TrendIndicator value={summary.comparison.durationVsLastWeek} />
        </div>

        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <Flame size={16} />
            <span className="text-xs">Streak</span>
          </div>
          <p className="text-xl font-bold">{summary.streak.current} days</p>
          <span className="text-sm text-secondary">current</span>
        </div>
      </div>

      {/* PR Highlight */}
      {summary.prs.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={20} className="text-amber-400" />
            <span className="font-medium text-amber-300">
              {summary.prs.length} PR{summary.prs.length !== 1 ? 's' : ''} This Week!
            </span>
          </div>
          <p className="text-sm text-white/70">
            Latest: {summary.prs[0].exerciseName} - {summary.prs[0].value.toFixed(1)} lbs e1RM
          </p>
        </div>
      )}
    </div>
  )
}

function PRsTab({ prs }: { prs: WeeklySummary['prs'] }) {
  if (prs.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy size={48} className="mx-auto mb-4 text-white/20" />
        <p className="text-secondary">No PRs this week yet</p>
        <p className="text-sm text-muted mt-1">Keep pushing - your next PR is coming!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {prs.map((pr, index) => (
        <div
          key={`${pr.exerciseId}-${index}`}
          className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Trophy size={20} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{pr.exerciseName}</p>
            <p className="text-sm text-tertiary">
              {new Date(pr.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-amber-400">{pr.value.toFixed(1)}</p>
            <p className="text-xs text-secondary">lbs e1RM</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MusclesTab({ distribution }: { distribution: WeeklySummary['muscleDistribution'] }) {
  if (distribution.length === 0) {
    return (
      <div className="text-center py-12">
        <Dumbbell size={48} className="mx-auto mb-4 text-white/20" />
        <p className="text-secondary">No workout data this week</p>
      </div>
    )
  }

  const maxSets = Math.max(...distribution.map(d => d.sets))

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">Sets per muscle group this week</p>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={distribution}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="muscle"
              tick={{ fill: '#999', fontSize: 12 }}
              tickFormatter={formatMuscle}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value} sets`, 'Sets']}
              labelFormatter={(label) => formatMuscle(label as string)}
            />
            <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
              {distribution.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={muscleColors[entry.muscle] || '#F59E0B'}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
        {distribution.slice(0, 6).map((item) => (
          <div key={item.muscle} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: muscleColors[item.muscle] || '#F59E0B' }}
            />
            <span className="text-white/70">{formatMuscle(item.muscle)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendsTab({ summary }: { summary: WeeklySummary }) {
  const comparisonData = [
    {
      name: 'Volume',
      current: summary.volume.total,
      previous: summary.volume.previousWeek,
      change: summary.comparison.volumeVsLastWeek,
      unit: 'lbs',
    },
    {
      name: 'Duration',
      current: summary.duration.total,
      previous: summary.duration.previousWeek,
      change: summary.comparison.durationVsLastWeek,
      unit: 'min',
    },
    {
      name: 'Workouts',
      current: summary.workouts.completed,
      previous: summary.workouts.completed - (summary.comparison.workoutsVsLastWeek !== 0 ? 1 : 0),
      change: summary.comparison.workoutsVsLastWeek,
      unit: '',
    },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">Week-over-week comparison</p>

      {comparisonData.map((item) => (
        <div key={item.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{item.name}</span>
            <TrendIndicator value={item.change} />
          </div>
          <div className="flex gap-2 h-8">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded" style={{
                width: `${Math.min(100, (item.previous / Math.max(item.current, item.previous, 1)) * 100)}%`
              }} />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/60">
                Last: {item.previous.toLocaleString()}{item.unit && ` ${item.unit}`}
              </span>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 bg-amber-500/60 rounded" style={{
                width: `${Math.min(100, (item.current / Math.max(item.current, item.previous, 1)) * 100)}%`
              }} />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white">
                This: {item.current.toLocaleString()}{item.unit && ` ${item.unit}`}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Workout Type Breakdown */}
      {Object.keys(summary.workouts.byType).length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-sm text-white/60 mb-3">Workout Types</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.workouts.byType).map(([type, count]) => (
              <div
                key={type}
                className="px-3 py-1.5 bg-white/5 rounded-full text-sm"
              >
                <span className="text-white/70 capitalize">{type}</span>
                <span className="ml-1 text-amber-400 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for managing modal state
export function useWeeklyProgressModal() {
  const [isOpen, setIsOpen] = useState(false)
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}
