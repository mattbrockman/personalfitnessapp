'use client'

import { VolumeLandmarkStatus, VolumeLandmarks, VolumeStatus } from '@/types/strength'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useState } from 'react'

interface VolumeLandmarksCardProps {
  status: VolumeLandmarkStatus
  showDetails?: boolean
}

export function VolumeLandmarksCard({ status, showDetails = true }: VolumeLandmarksCardProps) {
  const [expanded, setExpanded] = useState(false)

  const { muscleGroup, currentSets, landmarks, status: volumeStatus, percentage, recommendation } = status

  const getStatusColor = (vs: VolumeStatus) => {
    switch (vs) {
      case 'below_mev': return 'text-yellow-400'
      case 'approaching_mev': return 'text-blue-400'
      case 'in_mav': return 'text-green-400'
      case 'approaching_mrv': return 'text-amber-400'
      case 'over_mrv': return 'text-red-400'
      default: return 'text-tertiary'
    }
  }

  const getStatusBgColor = (vs: VolumeStatus) => {
    switch (vs) {
      case 'below_mev': return 'bg-yellow-500/10'
      case 'approaching_mev': return 'bg-blue-500/10'
      case 'in_mav': return 'bg-green-500/10'
      case 'approaching_mrv': return 'bg-amber-500/10'
      case 'over_mrv': return 'bg-red-500/10'
      default: return 'bg-white/5'
    }
  }

  const getStatusIcon = (vs: VolumeStatus) => {
    switch (vs) {
      case 'below_mev': return <AlertTriangle size={14} className="text-yellow-400" />
      case 'in_mav': return <CheckCircle size={14} className="text-green-400" />
      case 'over_mrv': return <AlertTriangle size={14} className="text-red-400" />
      default: return <Info size={14} className="text-muted" />
    }
  }

  const getStatusLabel = (vs: VolumeStatus) => {
    switch (vs) {
      case 'below_mev': return 'Below MEV'
      case 'approaching_mev': return 'Near MEV'
      case 'in_mav': return 'In MAV'
      case 'approaching_mrv': return 'Near MRV'
      case 'over_mrv': return 'Over MRV'
      default: return 'Unknown'
    }
  }

  // Calculate position on progress bar
  const totalRange = landmarks.mrv
  const mevPct = (landmarks.mev / totalRange) * 100
  const mavLowPct = (landmarks.mavLow / totalRange) * 100
  const mavHighPct = (landmarks.mavHigh / totalRange) * 100
  const currentPct = Math.min((currentSets / totalRange) * 100, 100)

  return (
    <div className={`rounded-lg p-3 ${getStatusBgColor(volumeStatus)}`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon(volumeStatus)}
          <span className="font-medium capitalize">{muscleGroup.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${getStatusColor(volumeStatus)}`}>
            {currentSets} sets
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${getStatusBgColor(volumeStatus)} ${getStatusColor(volumeStatus)}`}>
            {getStatusLabel(volumeStatus)}
          </span>
          {showDetails && (
            expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 relative">
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          {/* MEV zone (yellow) */}
          <div
            className="absolute h-full bg-yellow-500/30"
            style={{ left: 0, width: `${mevPct}%` }}
          />
          {/* MAV zone (green) */}
          <div
            className="absolute h-full bg-green-500/30"
            style={{ left: `${mevPct}%`, width: `${mavHighPct - mevPct}%` }}
          />
          {/* MRV zone (red) */}
          <div
            className="absolute h-full bg-red-500/30"
            style={{ left: `${mavHighPct}%`, width: `${100 - mavHighPct}%` }}
          />
          {/* Current position indicator */}
          <div
            className="absolute h-full w-1 bg-white rounded-full"
            style={{ left: `calc(${currentPct}% - 2px)` }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-1 text-xs text-secondary">
          <span>0</span>
          <span style={{ position: 'absolute', left: `${mevPct}%`, transform: 'translateX(-50%)' }}>
            MEV ({landmarks.mev})
          </span>
          <span style={{ position: 'absolute', left: `${mavLowPct}%`, transform: 'translateX(-50%)' }}>
            MAV
          </span>
          <span>MRV ({landmarks.mrv})</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && showDetails && (
        <div className="mt-3 pt-3 border-t border-white/10 text-sm">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <div className="text-xs text-secondary">MEV</div>
              <div className="text-yellow-400">{landmarks.mev}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">MAV Low</div>
              <div className="text-green-400">{landmarks.mavLow}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">MAV High</div>
              <div className="text-green-400">{landmarks.mavHigh}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">MRV</div>
              <div className="text-red-400">{landmarks.mrv}</div>
            </div>
          </div>
          <p className="text-xs text-tertiary">{recommendation}</p>
        </div>
      )}
    </div>
  )
}

// Compact inline version
export function VolumeLandmarksInline({ status }: { status: VolumeLandmarkStatus }) {
  const { currentSets, landmarks, status: volumeStatus } = status

  const getStatusColor = (vs: VolumeStatus) => {
    switch (vs) {
      case 'below_mev': return 'text-yellow-400'
      case 'in_mav': return 'text-green-400'
      case 'over_mrv': return 'text-red-400'
      default: return 'text-tertiary'
    }
  }

  return (
    <span className={`text-xs ${getStatusColor(volumeStatus)}`}>
      {currentSets}/{landmarks.mavHigh} sets
    </span>
  )
}
