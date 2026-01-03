'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import {
  RefreshCw,
  Settings,
  Heart,
} from 'lucide-react'

// Import all longevity components
import { VO2maxCard } from './VO2maxCard'
import { GripStrengthCard } from './GripStrengthCard'
import { BodyCompCard } from './BodyCompCard'
import { GlucoseCard } from './GlucoseCard'
import { MovementScreen } from './MovementScreen'
import { MEDCard } from './MEDCard'
import { RHRCard } from './RHRCard'
import { SupplementsCard } from './SupplementsCard'
import { CentenarianDecathlon } from './CentenarianDecathlon'

// Types
import {
  VO2maxTest,
  GripStrengthReading,
  BodyCompositionLog,
  CGMReading,
  MovementScreen as MovementScreenType,
  MEDCompliance,
  HealthMetric,
  Supplement,
  CentenarianGoal,
} from '@/types/longevity'

interface LongevityDashboardProps {
  user: User
  profile: Profile | null
}

export function LongevityDashboard({ user, profile }: LongevityDashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const supabase = createClient()

  // Data state
  const [vo2maxData, setVo2maxData] = useState<{
    current: number | null
    lastDate: string | null
    tests: VO2maxTest[]
  }>({ current: null, lastDate: null, tests: [] })

  const [gripData, setGripData] = useState<{
    left: number | null
    right: number | null
    lastDate: string | null
    readings: GripStrengthReading[]
  }>({ left: null, right: null, lastDate: null, readings: [] })

  const [bodyCompData, setBodyCompData] = useState<{
    latest: BodyCompositionLog | null
    logs: BodyCompositionLog[]
  }>({ latest: null, logs: [] })

  const [glucoseData, setGlucoseData] = useState<{
    readings: CGMReading[]
    avgFasting: number | undefined
    timeInRange: number | undefined
  }>({ readings: [], avgFasting: undefined, timeInRange: undefined })

  const [movementData, setMovementData] = useState<MovementScreenType | null>(null)

  const [rhrData, setRhrData] = useState<{
    current: number | null
    readings: HealthMetric[]
    avg7Day: number | undefined
    avg30Day: number | undefined
  }>({ current: null, readings: [], avg7Day: undefined, avg30Day: undefined })

  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [centenarianGoals, setCentenarianGoals] = useState<CentenarianGoal[]>([])

  // MED Compliance (calculated from workouts and other data)
  const [medCompliance, setMedCompliance] = useState<MEDCompliance>({
    cardioMinutes: 0,
    strengthSessions: 0,
    avgSleepHours: 0,
    proteinDays: 0,
    stabilitySessions: 0,
  })

  // User demographics
  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 35 // Default age
  const sex = ((profile as any)?.biological_sex as 'male' | 'female') || 'male'

  // Fetch all data
  const fetchData = async () => {
    try {
      // Fetch health metrics (VO2max, grip, RHR)
      const metricsRes = await fetch('/api/health-metrics?limit=100')
      if (metricsRes.ok) {
        const { metrics } = await metricsRes.json()

        // Process VO2max
        const vo2maxMetrics = metrics.filter((m: HealthMetric) => m.metric_type === 'vo2max')
        if (vo2maxMetrics.length > 0) {
          setVo2maxData({
            current: Number(vo2maxMetrics[0].value),
            lastDate: vo2maxMetrics[0].metric_date,
            tests: vo2maxMetrics.map((m: HealthMetric) => ({
              test_date: m.metric_date,
              test_type: m.source || 'field_test',
              estimated_vo2max: Number(m.value),
            })),
          })
        }

        // Process grip strength
        const gripLeftMetrics = metrics.filter((m: HealthMetric) => m.metric_type === 'grip_strength_left')
        const gripRightMetrics = metrics.filter((m: HealthMetric) => m.metric_type === 'grip_strength_right')
        if (gripLeftMetrics.length > 0 || gripRightMetrics.length > 0) {
          setGripData({
            left: gripLeftMetrics[0] ? Number(gripLeftMetrics[0].value) : null,
            right: gripRightMetrics[0] ? Number(gripRightMetrics[0].value) : null,
            lastDate: gripLeftMetrics[0]?.metric_date || gripRightMetrics[0]?.metric_date || null,
            readings: [],
          })
        }

        // Process RHR
        const rhrMetrics = metrics.filter((m: HealthMetric) => m.metric_type === 'rhr')
        if (rhrMetrics.length > 0) {
          const avg7 = rhrMetrics.slice(0, 7).reduce((sum: number, m: HealthMetric) => sum + Number(m.value), 0) / Math.min(7, rhrMetrics.length)
          const avg30 = rhrMetrics.slice(0, 30).reduce((sum: number, m: HealthMetric) => sum + Number(m.value), 0) / Math.min(30, rhrMetrics.length)
          setRhrData({
            current: Number(rhrMetrics[0].value),
            readings: rhrMetrics,
            avg7Day: avg7,
            avg30Day: avg30,
          })
        }
      }

      // Fetch body composition
      const bodyCompRes = await fetch('/api/body-composition?limit=30')
      if (bodyCompRes.ok) {
        const { logs } = await bodyCompRes.json()
        setBodyCompData({
          latest: logs[0] || null,
          logs: logs,
        })
      }

      // Fetch CGM readings
      const cgmRes = await fetch('/api/cgm?limit=500')
      if (cgmRes.ok) {
        const { readings } = await cgmRes.json()
        const fastingReadings = readings.filter((r: CGMReading) => r.meal_context === 'fasting')
        const avgFasting = fastingReadings.length > 0
          ? Math.round(fastingReadings.reduce((sum: number, r: CGMReading) => sum + r.glucose_mg_dl, 0) / fastingReadings.length)
          : undefined
        const inRange = readings.filter((r: CGMReading) => r.glucose_mg_dl >= 70 && r.glucose_mg_dl <= 140).length
        const tir = readings.length > 0 ? Math.round((inRange / readings.length) * 100) : undefined

        setGlucoseData({
          readings: readings,
          avgFasting,
          timeInRange: tir,
        })
      }

      // Fetch supplements
      const supplementsRes = await fetch('/api/supplements?active_only=true')
      if (supplementsRes.ok) {
        const { supplements } = await supplementsRes.json()
        setSupplements(supplements)
      }

      // Fetch centenarian goals
      const goalsRes = await fetch('/api/centenarian-goals')
      if (goalsRes.ok) {
        const { goals } = await goalsRes.json()
        setCentenarianGoals(goals)
      }

      // Calculate MED compliance from workouts
      // This would normally fetch from workouts API for the past week
      setMedCompliance({
        cardioMinutes: 120, // Placeholder - calculate from workouts
        strengthSessions: 2,
        avgSleepHours: 7.2,
        proteinDays: 5,
        stabilitySessions: 1,
      })

    } catch (error) {
      console.error('Error fetching longevity data:', error)
    }
  }

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [])

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
            <Heart className="text-red-400" size={28} />
            Longevity Dashboard
          </h1>
          <p className="text-tertiary text-sm mt-1">
            Track the metrics that matter most for healthspan
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

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <VO2maxCard
          currentVO2max={vo2maxData.current}
          lastTestDate={vo2maxData.lastDate}
          age={age}
          sex={sex}
          recentTests={vo2maxData.tests}
          onRefresh={handleRefresh}
        />

        <GripStrengthCard
          leftGrip={gripData.left}
          rightGrip={gripData.right}
          lastTestDate={gripData.lastDate}
          age={age}
          sex={sex}
          recentReadings={gripData.readings}
          onRefresh={handleRefresh}
        />

        <BodyCompCard
          latestLog={bodyCompData.latest}
          recentLogs={bodyCompData.logs}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <GlucoseCard
          recentReadings={glucoseData.readings}
          averageFasting={glucoseData.avgFasting}
          timeInRange={glucoseData.timeInRange}
          onRefresh={handleRefresh}
        />

        <RHRCard
          currentRHR={rhrData.current}
          recentReadings={rhrData.readings}
          avgRHR7Day={rhrData.avg7Day}
          avgRHR30Day={rhrData.avg30Day}
          onRefresh={handleRefresh}
        />

        <MovementScreen
          latestScreen={movementData}
          onRefresh={handleRefresh}
        />
      </div>

      {/* MED and Supplements Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MEDCard compliance={medCompliance} />
        <SupplementsCard
          supplements={supplements}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Centenarian Decathlon */}
      <div className="mb-6">
        <CentenarianDecathlon
          goals={centenarianGoals}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-muted py-4">
        <p>
          Inspired by Dr. Peter Attia's framework for longevity.
          Focus on VO2max, strength, stability, and metabolic health.
        </p>
      </div>
    </div>
  )
}
