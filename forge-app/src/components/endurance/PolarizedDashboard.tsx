'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Target, Activity, TrendingUp, AlertTriangle } from 'lucide-react'

import { FitnessFatigueChart } from './FitnessFatigueChart'
import { IntensityPieChart } from './IntensityPieChart'
import { ThresholdCard } from './ThresholdCard'
import { TrainingStrainCard } from './TrainingStrainCard'

import {
  CTLATLTSBPoint,
  ZoneDistribution,
  PolarizedAnalysis,
  WeeklyIntensityDistribution,
  CurrentThresholds,
  ThresholdTest,
  TrainingStrain,
} from '@/types/endurance'
import { calculateCTLATLTSBHistory, analyzeTrainingStrain } from '@/lib/training-load'

interface PolarizedDashboardProps {
  user: User
}

export function PolarizedDashboard({ user }: PolarizedDashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState(90) // days
  const supabase = createClient()

  // Data state
  const [ctlAtlTsb, setCtlAtlTsb] = useState<{
    history: CTLATLTSBPoint[]
    currentCTL: number
    currentATL: number
    currentTSB: number
  }>({
    history: [],
    currentCTL: 0,
    currentATL: 0,
    currentTSB: 0,
  })

  const [intensityDistribution, setIntensityDistribution] = useState<{
    distribution: ZoneDistribution
    analysis: PolarizedAnalysis
    weeklyDistributions: WeeklyIntensityDistribution[]
  } | null>(null)

  const [thresholds, setThresholds] = useState<{
    current: CurrentThresholds
    tests: ThresholdTest[]
  }>({
    current: {
      ftp_watts: null,
      lthr_bpm: null,
      threshold_pace_min_mile: null,
      resting_hr: null,
      max_hr: null,
      last_ftp_test: null,
      last_lthr_test: null,
      ftp_trend: null,
    },
    tests: [],
  })

  const [trainingStrain, setTrainingStrain] = useState<TrainingStrain>({
    weeklyLoad: 0,
    monotony: 0,
    strain: 0,
    acwr: 0,
    riskLevel: 'low',
    recommendation: 'Loading...',
  })

  // Fetch data
  const fetchData = async () => {
    try {
      // Fetch training load data
      const loadRes = await fetch(`/api/training-load?days=${dateRange}`)
      if (loadRes.ok) {
        const data = await loadRes.json()

        // Build CTL/ATL/TSB history from the data
        const history: CTLATLTSBPoint[] = (data.history || []).map((h: any) => ({
          date: h.log_date,
          ctl: Number(h.ctl) || 0,
          atl: Number(h.atl) || 0,
          tsb: Number(h.tsb) || 0,
        }))

        setCtlAtlTsb({
          history,
          currentCTL: data.summary?.currentCTL || 0,
          currentATL: data.summary?.currentATL || 0,
          currentTSB: data.summary?.currentTSB || 0,
        })

        setTrainingStrain({
          weeklyLoad: data.summary?.weeklyLoad || 0,
          monotony: data.summary?.monotony || 0,
          strain: data.summary?.strain || 0,
          acwr: data.summary?.acwr || 0,
          riskLevel: getStrainRiskLevel(data.summary?.strain || 0, data.summary?.monotony || 0),
          recommendation: getStrainRecommendation(data.summary?.strain || 0, data.summary?.monotony || 0, data.summary?.acwr || 0),
        })
      }

      // Fetch intensity distribution
      const distRes = await fetch('/api/intensity-distribution?weeks=4')
      if (distRes.ok) {
        const data = await distRes.json()
        setIntensityDistribution({
          distribution: data.overallDistribution || {
            zone1Seconds: 0,
            zone2Seconds: 0,
            zone3Seconds: 0,
            zone4Seconds: 0,
            zone5Seconds: 0,
            totalSeconds: 0,
          },
          analysis: data.overallAnalysis || {
            lowIntensityPct: 0,
            midIntensityPct: 0,
            highIntensityPct: 0,
            isPolarized: false,
            complianceScore: 0,
            recommendation: 'No training data',
            targetLowPct: 80,
            targetHighPct: 20,
          },
          weeklyDistributions: data.weeklyDistributions || [],
        })
      }

      // Fetch thresholds
      const threshRes = await fetch('/api/thresholds')
      if (threshRes.ok) {
        const data = await threshRes.json()
        setThresholds({
          current: data.current || thresholds.current,
          tests: data.thresholds || [],
        })
      }
    } catch (error) {
      console.error('Error fetching endurance data:', error)
    }
  }

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [dateRange])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-tertiary" size={32} />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Target className="text-blue-400" size={28} />
            Polarized Training
          </h1>
          <p className="text-tertiary text-sm mt-1">
            80/20 intensity distribution based on Dr. Stephen Seiler's research
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          <RefreshCw size={20} className={`text-tertiary ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-blue-400" />
            <span className="text-xs text-tertiary">Fitness (CTL)</span>
          </div>
          <span className="text-2xl font-semibold">{ctlAtlTsb.currentCTL.toFixed(0)}</span>
        </div>

        <div className="bg-dark-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-amber-400" />
            <span className="text-xs text-tertiary">Fatigue (ATL)</span>
          </div>
          <span className="text-2xl font-semibold">{ctlAtlTsb.currentATL.toFixed(0)}</span>
        </div>

        <div className="bg-dark-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-3 h-3 rounded-full ${
              ctlAtlTsb.currentTSB >= 10 ? 'bg-green-500' :
              ctlAtlTsb.currentTSB >= -10 ? 'bg-blue-500' :
              ctlAtlTsb.currentTSB >= -25 ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-tertiary">Form (TSB)</span>
          </div>
          <span className="text-2xl font-semibold">{ctlAtlTsb.currentTSB.toFixed(0)}</span>
        </div>

        <div className="bg-dark-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            {trainingStrain.riskLevel === 'high' || trainingStrain.riskLevel === 'very_high' ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : (
              <Activity size={16} className="text-green-400" />
            )}
            <span className="text-xs text-tertiary">Weekly Load</span>
          </div>
          <span className="text-2xl font-semibold">{trainingStrain.weeklyLoad.toLocaleString()}</span>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Fitness/Fatigue Chart */}
        <FitnessFatigueChart
          data={ctlAtlTsb.history}
          currentCTL={ctlAtlTsb.currentCTL}
          currentATL={ctlAtlTsb.currentATL}
          currentTSB={ctlAtlTsb.currentTSB}
          onRangeChange={setDateRange}
        />

        {/* Intensity Distribution */}
        {intensityDistribution && (
          <IntensityPieChart
            distribution={intensityDistribution.distribution}
            analysis={intensityDistribution.analysis}
          />
        )}
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Thresholds */}
        <ThresholdCard
          thresholds={thresholds.current}
          recentTests={thresholds.tests}
          onRefresh={handleRefresh}
        />

        {/* Training Strain */}
        <TrainingStrainCard strain={trainingStrain} />
      </div>

      {/* Weekly distributions */}
      {intensityDistribution?.weeklyDistributions && intensityDistribution.weeklyDistributions.length > 0 && (
        <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Breakdown</h3>
          <div className="space-y-3">
            {intensityDistribution.weeklyDistributions.slice(0, 4).map((week) => (
              <div
                key={week.weekStart}
                className="flex items-center gap-4 p-3 bg-dark-700/30 rounded-lg"
              >
                <div className="w-24 text-sm text-tertiary">
                  {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>

                {/* Mini distribution bar */}
                <div className="flex-1 h-4 bg-dark-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${week.analysis.lowIntensityPct}%` }}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${week.analysis.midIntensityPct}%` }}
                  />
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${week.analysis.highIntensityPct}%` }}
                  />
                </div>

                <div className="w-16 text-right text-sm">
                  {week.totalHours}h
                </div>

                <div className={`w-20 text-right text-xs ${
                  week.analysis.isPolarized ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {week.analysis.complianceScore}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted py-4 mt-4">
        <p>
          Based on Dr. Stephen Seiler's research on polarized training distribution.
          Target: 80% low intensity (Z1-2), &lt;10% moderate (Z3), 10-20% high intensity (Z4-5).
        </p>
      </div>
    </div>
  )
}

// Helper functions
function getStrainRiskLevel(strain: number, monotony: number): TrainingStrain['riskLevel'] {
  if (strain > 7000 || monotony > 2.5) return 'very_high'
  if (strain > 5000 || monotony > 2.0) return 'high'
  if (strain > 3000 || monotony > 1.5) return 'moderate'
  return 'low'
}

function getStrainRecommendation(strain: number, monotony: number, acwr: number): string {
  if (strain > 7000 || monotony > 2.5) {
    return 'High injury risk - reduce training load and add variety'
  }
  if (strain > 5000 || monotony > 2.0) {
    return 'Elevated risk - consider reducing load this week'
  }
  if (acwr > 1.5) {
    return 'Rapid load increase detected - monitor fatigue closely'
  }
  if (acwr < 0.8) {
    return 'Training load may be too low to maintain fitness'
  }
  return 'Training load is appropriate - continue as planned'
}
