'use client'

import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { Target, AlertTriangle, CheckCircle } from 'lucide-react'
import { PolarizedAnalysis, ZoneDistribution } from '@/types/endurance'
import { zoneSecondsToHours } from '@/lib/training-load'

interface IntensityPieChartProps {
  distribution: ZoneDistribution
  analysis: PolarizedAnalysis
  showZoneBreakdown?: boolean
}

const ZONE_COLORS = {
  zone1: '#22C55E', // Green - Recovery
  zone2: '#3B82F6', // Blue - Endurance
  zone3: '#F59E0B', // Amber - Tempo (gray zone)
  zone4: '#EF4444', // Red - Threshold
  zone5: '#8B5CF6', // Purple - VO2max
}

const INTENSITY_COLORS = {
  low: '#3B82F6',   // Blue - Low intensity (Z1-Z2)
  mid: '#F59E0B',   // Amber - Mid intensity (Z3)
  high: '#EF4444',  // Red - High intensity (Z4-Z5)
}

export function IntensityPieChart({
  distribution,
  analysis,
  showZoneBreakdown = false,
}: IntensityPieChartProps) {
  const polarizedData = useMemo(() => [
    {
      name: 'Low (Z1-Z2)',
      value: analysis.lowIntensityPct,
      target: analysis.targetLowPct,
      color: INTENSITY_COLORS.low,
    },
    {
      name: 'Mid (Z3)',
      value: analysis.midIntensityPct,
      target: 100 - analysis.targetLowPct - analysis.targetHighPct,
      color: INTENSITY_COLORS.mid,
    },
    {
      name: 'High (Z4-Z5)',
      value: analysis.highIntensityPct,
      target: analysis.targetHighPct,
      color: INTENSITY_COLORS.high,
    },
  ], [analysis])

  const zoneData = useMemo(() => [
    { name: 'Zone 1', value: distribution.zone1Seconds, color: ZONE_COLORS.zone1 },
    { name: 'Zone 2', value: distribution.zone2Seconds, color: ZONE_COLORS.zone2 },
    { name: 'Zone 3', value: distribution.zone3Seconds, color: ZONE_COLORS.zone3 },
    { name: 'Zone 4', value: distribution.zone4Seconds, color: ZONE_COLORS.zone4 },
    { name: 'Zone 5', value: distribution.zone5Seconds, color: ZONE_COLORS.zone5 },
  ].filter(z => z.value > 0), [distribution])

  const data = showZoneBreakdown ? zoneData : polarizedData.filter(d => d.value > 0)

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-blue-400" size={24} />
          <h3 className="text-lg font-semibold">Intensity Distribution</h3>
        </div>
        {analysis.isPolarized ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-lg">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-400">Polarized</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-lg">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs text-amber-400">Not Polarized</span>
          </div>
        )}
      </div>

      {/* Compliance Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white/50">Compliance Score</span>
          <span className="text-sm font-medium">{analysis.complianceScore}%</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              analysis.complianceScore >= 80
                ? 'bg-green-500'
                : analysis.complianceScore >= 60
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${analysis.complianceScore}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${value.toFixed(1)}%`}
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
            />
            <Legend
              formatter={(value, entry: any) => (
                <span className="text-xs text-white/70">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Target vs Actual */}
      {!showZoneBreakdown && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {polarizedData.map((item) => (
            <div key={item.name} className="text-center">
              <div className="text-xs text-white/40 mb-1">{item.name}</div>
              <div className="flex items-center justify-center gap-1">
                <span
                  className={`text-sm font-medium ${
                    Math.abs(item.value - item.target) <= 5
                      ? 'text-green-400'
                      : Math.abs(item.value - item.target) <= 10
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {item.value.toFixed(0)}%
                </span>
                <span className="text-xs text-white/30">/ {item.target}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone breakdown */}
      {showZoneBreakdown && (
        <div className="space-y-2 mt-4">
          {[
            { zone: 'Zone 1', seconds: distribution.zone1Seconds, color: ZONE_COLORS.zone1, label: 'Recovery' },
            { zone: 'Zone 2', seconds: distribution.zone2Seconds, color: ZONE_COLORS.zone2, label: 'Endurance' },
            { zone: 'Zone 3', seconds: distribution.zone3Seconds, color: ZONE_COLORS.zone3, label: 'Tempo' },
            { zone: 'Zone 4', seconds: distribution.zone4Seconds, color: ZONE_COLORS.zone4, label: 'Threshold' },
            { zone: 'Zone 5', seconds: distribution.zone5Seconds, color: ZONE_COLORS.zone5, label: 'VO2max' },
          ].map(({ zone, seconds, color, label }) => (
            <div key={zone} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-white/50 w-16">{zone}</span>
              <span className="text-xs text-white/30 w-16">{label}</span>
              <span className="text-xs text-white/70 ml-auto">
                {zoneSecondsToHours(seconds)}h
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      <div className={`mt-4 p-3 rounded-lg text-sm ${
        analysis.isPolarized
          ? 'bg-green-500/10 text-green-300'
          : 'bg-amber-500/10 text-amber-300'
      }`}>
        {analysis.recommendation}
      </div>
    </div>
  )
}
