'use client'

import { DeloadTrigger, DeloadRecommendation, DeloadResponse } from '@/types/galpin'

interface DeloadAlertCardProps {
  trigger?: DeloadTrigger
  recommendation?: DeloadRecommendation
  onRespond?: (response: DeloadResponse, notes?: string) => Promise<void>
  className?: string
}

export function DeloadAlertCard({
  trigger,
  recommendation,
  onRespond,
  className = '',
}: DeloadAlertCardProps) {
  // If neither trigger nor recommendation, show nothing
  if (!trigger && !recommendation) return null

  // If recommendation says no deload needed
  if (recommendation && !recommendation.shouldDeload) return null

  const severity = trigger?.severity || recommendation?.severity || 'moderate'
  const deloadType = trigger?.recommended_deload_type || recommendation?.deloadType || 'volume'
  const duration = trigger?.recommended_duration_days || recommendation?.durationDays || 7

  const severityColors = {
    mild: 'border-yellow-500 bg-yellow-900/20',
    moderate: 'border-orange-500 bg-orange-900/20',
    severe: 'border-red-500 bg-red-900/20',
  }

  const severityText = {
    mild: 'text-yellow-400',
    moderate: 'text-orange-400',
    severe: 'text-red-400',
  }

  const handleAccept = () => onRespond?.('accepted')
  const handleDismiss = () => onRespond?.('dismissed')

  return (
    <div className={`border-2 rounded-lg p-4 ${severityColors[severity]} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`text-lg font-semibold ${severityText[severity]}`}>
            Deload Recommended
          </h3>
          <p className="text-sm text-gray-400 capitalize">
            {severity} fatigue detected
          </p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium ${severityText[severity]} bg-black/30`}>
          {deloadType.replace('_', ' ')}
        </div>
      </div>

      {/* Triggers */}
      {recommendation?.triggers && recommendation.triggers.length > 0 && (
        <div className="mb-4 space-y-2">
          {recommendation.triggers.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-red-400">!</span>
              <span className="text-gray-300">{t.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div className="mb-4 p-3 bg-black/20 rounded">
        <div className="text-sm text-gray-300 mb-2">Suggested approach:</div>
        <ul className="space-y-1 text-sm">
          {recommendation?.suggestions?.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span className="text-gray-300">{s}</span>
            </li>
          )) || (
            <>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span className="text-gray-300">
                  {deloadType === 'volume' && 'Reduce sets by 40-50%, maintain intensity'}
                  {deloadType === 'intensity' && 'Reduce weights by 10-20%, maintain volume'}
                  {deloadType === 'full' && 'Reduce both volume and intensity by 40-50%'}
                  {deloadType === 'active_recovery' && 'Light movement only, no structured training'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span className="text-gray-300">Duration: {duration} days</span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Response buttons */}
      {onRespond && trigger?.user_response === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
          >
            Accept Deload
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {trigger?.user_response && trigger.user_response !== 'pending' && (
        <div className="text-sm text-gray-400">
          Response: <span className="capitalize text-gray-300">{trigger.user_response}</span>
        </div>
      )}
    </div>
  )
}
