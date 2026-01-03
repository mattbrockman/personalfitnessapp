'use client'

import { AthleteProfileSnapshot } from '@/types/training-plan'
import { User, Weight, Ruler, Heart, Activity, AlertTriangle } from 'lucide-react'

interface AthleteProfileCardProps {
  profile: AthleteProfileSnapshot | null
  className?: string
}

function MetricItem({
  label,
  value,
  unit,
  icon: Icon
}: {
  label: string
  value: number | string | undefined
  unit?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  if (value === undefined || value === null) return null

  return (
    <div className="flex flex-col">
      <span className="text-xs text-tertiary">{label}</span>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-amber-400" />}
        <span className="text-sm font-medium">
          {value}
          {unit && <span className="text-tertiary ml-0.5">{unit}</span>}
        </span>
      </div>
    </div>
  )
}

export function AthleteProfileCard({ profile, className = '' }: AthleteProfileCardProps) {
  if (!profile) return null

  const hasBasicMetrics = profile.age || profile.weight_lbs || profile.height_inches
  const hasStrengthMetrics = profile.squat_1rm || profile.bench_1rm || profile.deadlift_1rm || profile.ohp_1rm
  const hasCardioMetrics = profile.vo2max || profile.max_hr || profile.resting_hr

  if (!hasBasicMetrics && !hasStrengthMetrics && !hasCardioMetrics) return null

  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold">Athlete Profile</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Metrics */}
        {hasBasicMetrics && (
          <div className="grid grid-cols-3 gap-4">
            <MetricItem label="Age" value={profile.age} unit="yrs" />
            <MetricItem label="Weight" value={profile.weight_lbs} unit="lbs" icon={Weight} />
            <MetricItem
              label="Height"
              value={profile.height_inches ? `${Math.floor(profile.height_inches / 12)}'${profile.height_inches % 12}"` : undefined}
              icon={Ruler}
            />
          </div>
        )}

        {/* Cardio Metrics */}
        {hasCardioMetrics && (
          <div>
            <p className="text-xs text-secondary mb-2">Cardiovascular</p>
            <div className="grid grid-cols-3 gap-4">
              <MetricItem label="VO2max" value={profile.vo2max} unit="ml/kg/min" icon={Activity} />
              <MetricItem label="Max HR" value={profile.max_hr} unit="bpm" icon={Heart} />
              <MetricItem label="Resting HR" value={profile.resting_hr} unit="bpm" />
            </div>
          </div>
        )}

        {/* Strength Metrics */}
        {hasStrengthMetrics && (
          <div>
            <p className="text-xs text-secondary mb-2">Estimated 1RM</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricItem label="Squat" value={profile.squat_1rm} unit="lbs" />
              <MetricItem label="Bench" value={profile.bench_1rm} unit="lbs" />
              <MetricItem label="Deadlift" value={profile.deadlift_1rm} unit="lbs" />
              <MetricItem label="OHP" value={profile.ohp_1rm} unit="lbs" />
            </div>
            {profile.total_1rm && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-sm text-white/60">Total (SBD)</span>
                <span className="text-lg font-bold text-amber-400">{profile.total_1rm} lbs</span>
              </div>
            )}
          </div>
        )}

        {/* Injury Notes */}
        {profile.injury_notes && (
          <div className="pt-3 border-t border-white/5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-yellow-400 font-medium">Injury Considerations</p>
                <p className="text-sm text-white/70 mt-1">{profile.injury_notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Training History */}
        {profile.training_history && (
          <div className="pt-3 border-t border-white/5">
            <p className="text-xs text-secondary mb-1">Training History</p>
            <p className="text-sm text-white/70">{profile.training_history}</p>
          </div>
        )}
      </div>
    </div>
  )
}
