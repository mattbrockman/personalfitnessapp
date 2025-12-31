'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { CTLATLTSBPoint } from '@/types/endurance'
import { getTSBRange } from '@/lib/training-load'

interface FitnessFatigueChartProps {
  data: CTLATLTSBPoint[]
  currentCTL?: number
  currentATL?: number
  currentTSB?: number
  onRangeChange?: (days: number) => void
}

export function FitnessFatigueChart({
  data,
  currentCTL = 0,
  currentATL = 0,
  currentTSB = 0,
  onRangeChange,
}: FitnessFatigueChartProps) {
  const tsbRange = getTSBRange(currentTSB)

  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
  }, [data])

  // Calculate trends
  const ctlTrend = useMemo(() => {
    if (data.length < 7) return 'stable'
    const recent = data.slice(0, 7).reduce((sum, p) => sum + p.ctl, 0) / 7
    const older = data.slice(7, 14).reduce((sum, p) => sum + p.ctl, 0) / Math.min(7, data.length - 7)
    if (!older) return 'stable'
    if (recent > older * 1.05) return 'rising'
    if (recent < older * 0.95) return 'falling'
    return 'stable'
  }, [data])

  const TrendIcon = ctlTrend === 'rising' ? TrendingUp : ctlTrend === 'falling' ? TrendingDown : Minus

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-400" size={24} />
          <h3 className="text-lg font-semibold">Fitness & Fatigue</h3>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => onRangeChange?.(days)}
              className="px-3 py-1 text-xs rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-white/50">CTL (Fitness)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">{currentCTL.toFixed(0)}</span>
            <TrendIcon
              size={16}
              className={
                ctlTrend === 'rising'
                  ? 'text-green-400'
                  : ctlTrend === 'falling'
                  ? 'text-red-400'
                  : 'text-white/30'
              }
            />
          </div>
        </div>

        <div className="bg-dark-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-white/50">ATL (Fatigue)</span>
          </div>
          <span className="text-2xl font-semibold">{currentATL.toFixed(0)}</span>
        </div>

        <div className="bg-dark-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-white/50">TSB (Form)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">{currentTSB.toFixed(0)}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                tsbRange.color === 'green'
                  ? 'bg-green-500/20 text-green-400'
                  : tsbRange.color === 'blue'
                  ? 'bg-blue-500/20 text-blue-400'
                  : tsbRange.color === 'amber'
                  ? 'bg-amber-500/20 text-amber-400'
                  : tsbRange.color === 'orange'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {tsbRange.label}
            </span>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${
        tsbRange.color === 'red' || tsbRange.color === 'orange'
          ? 'bg-amber-500/10 border border-amber-500/20'
          : 'bg-dark-700/50'
      }`}>
        {(tsbRange.color === 'red' || tsbRange.color === 'orange') && (
          <AlertTriangle size={16} className="text-amber-400" />
        )}
        <span className="text-sm text-white/70">{tsbRange.recommendation}</span>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="tsb"
              fill="#10B981"
              fillOpacity={0.1}
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="ctl"
              name="CTL (Fitness)"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="atl"
              name="ATL (Fatigue)"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tsb"
              name="TSB (Form)"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="mt-4 text-xs text-white/40 space-y-1">
        <p><strong>CTL</strong> = Chronic Training Load (42-day avg) - Your fitness level</p>
        <p><strong>ATL</strong> = Acute Training Load (7-day avg) - Your fatigue level</p>
        <p><strong>TSB</strong> = Training Stress Balance (CTL - ATL) - Your form/freshness</p>
      </div>
    </div>
  )
}
