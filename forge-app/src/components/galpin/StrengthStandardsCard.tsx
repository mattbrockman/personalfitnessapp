'use client'

import { StrengthProfile, UserStrengthPercentile, ADAPTATION_LABELS } from '@/types/galpin'

interface StrengthStandardsCardProps {
  profile: StrengthProfile | null
  isLoading?: boolean
  className?: string
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  untrained: 'text-gray-400',
  beginner: 'text-gray-300',
  novice: 'text-green-400',
  intermediate: 'text-blue-400',
  advanced: 'text-purple-400',
  elite: 'text-yellow-400',
}

const CLASSIFICATION_BG: Record<string, string> = {
  untrained: 'bg-gray-700',
  beginner: 'bg-gray-600',
  novice: 'bg-green-900/30',
  intermediate: 'bg-blue-900/30',
  advanced: 'bg-purple-900/30',
  elite: 'bg-yellow-900/30',
}

function LiftRow({ lift }: { lift: UserStrengthPercentile }) {
  const liftNames: Record<string, string> = {
    squat: 'Squat',
    bench_press: 'Bench Press',
    deadlift: 'Deadlift',
    overhead_press: 'OHP',
    barbell_row: 'Barbell Row',
  }

  return (
    <div className={`p-3 rounded-lg ${CLASSIFICATION_BG[lift.classification]}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-medium text-white">
            {liftNames[lift.exercise_name] || lift.exercise_name}
          </div>
          <div className="text-lg font-bold text-white">
            {Math.round(lift.current1RM)} lbs
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium capitalize ${CLASSIFICATION_COLORS[lift.classification]}`}>
            {lift.classification}
          </div>
          <div className="text-xs text-gray-400">
            {lift.percentile}th percentile
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            lift.percentile >= 90 ? 'bg-yellow-500' :
            lift.percentile >= 75 ? 'bg-purple-500' :
            lift.percentile >= 50 ? 'bg-blue-500' :
            lift.percentile >= 25 ? 'bg-green-500' :
            'bg-gray-500'
          }`}
          style={{ width: `${lift.percentile}%` }}
        />
      </div>

      {lift.toNextLevel > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          +{Math.round(lift.toNextLevel)} lbs to next level
        </div>
      )}
    </div>
  )
}

export function StrengthStandardsCard({
  profile,
  isLoading,
  className = '',
}: StrengthStandardsCardProps) {
  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!profile || profile.lifts.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-2">Strength Standards</h3>
        <p className="text-gray-400 text-sm">
          Log some strength tests to see how you compare to population standards.
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Strength Standards</h3>

      {/* Overall classification */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Overall Level</span>
          <span className={`text-lg font-bold capitalize ${CLASSIFICATION_COLORS[profile.overallClassification]}`}>
            {profile.overallClassification}
          </span>
        </div>

        {/* Wilks/DOTS scores */}
        {(profile.wilksScore || profile.dotsScore) && (
          <div className="flex gap-4 mt-2 pt-2 border-t border-gray-600">
            {profile.wilksScore && (
              <div>
                <span className="text-xs text-gray-400">Wilks</span>
                <div className="text-white font-medium">{profile.wilksScore}</div>
              </div>
            )}
            {profile.dotsScore && (
              <div>
                <span className="text-xs text-gray-400">DOTS</span>
                <div className="text-white font-medium">{profile.dotsScore}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Individual lifts */}
      <div className="space-y-3">
        {profile.lifts.map((lift) => (
          <LiftRow key={lift.exercise_name} lift={lift} />
        ))}
      </div>

      {/* Insights */}
      {(profile.strongestLift || profile.weakestLift) && (
        <div className="mt-4 pt-3 border-t border-gray-700 text-sm">
          {profile.strongestLift && (
            <div className="flex justify-between text-gray-400">
              <span>Strongest lift:</span>
              <span className="text-green-400 capitalize">
                {profile.strongestLift.replace('_', ' ')}
              </span>
            </div>
          )}
          {profile.weakestLift && profile.weakestLift !== profile.strongestLift && (
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Needs work:</span>
              <span className="text-orange-400 capitalize">
                {profile.weakestLift.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
