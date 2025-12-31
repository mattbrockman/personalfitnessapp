'use client'

import { useState } from 'react'
import { TechniqueRating, TECHNIQUE_RATING_LABELS, LogTechniqueRequest } from '@/types/galpin'

interface TechniqueRatingInputProps {
  exerciseName: string
  exerciseId?: string
  onSubmit: (data: LogTechniqueRequest) => Promise<void>
  className?: string
}

export function TechniqueRatingInput({
  exerciseName,
  exerciseId,
  onSubmit,
  className = '',
}: TechniqueRatingInputProps) {
  const [rating, setRating] = useState<TechniqueRating>(3)
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [cues, setCues] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit({
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        technique_rating: rating,
        video_url: videoUrl || undefined,
        strengths: strengths ? strengths.split(',').map(s => s.trim()) : undefined,
        areas_for_improvement: improvements ? improvements.split(',').map(s => s.trim()) : undefined,
        cues_to_focus: cues ? cues.split(',').map(s => s.trim()) : undefined,
      })

      // Reset form
      setRating(3)
      setStrengths('')
      setImprovements('')
      setCues('')
      setVideoUrl('')
      setShowDetails(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-medium text-white mb-3">
        Rate Technique: {exerciseName}
      </h4>

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-3">
        {([1, 2, 3, 4, 5] as TechniqueRating[]).map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className={`text-2xl transition-colors ${
              star <= rating ? 'text-yellow-400' : 'text-gray-600'
            } hover:text-yellow-300`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-400">
          {rating}/5
        </span>
      </div>

      {/* Rating description */}
      <div className="text-xs text-gray-400 mb-4 p-2 bg-gray-700 rounded">
        {TECHNIQUE_RATING_LABELS[rating]}
      </div>

      {/* Toggle details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm text-blue-400 hover:text-blue-300 mb-3"
      >
        {showDetails ? 'Hide' : 'Add'} notes
      </button>

      {showDetails && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Strengths (comma-separated)
            </label>
            <input
              type="text"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="e.g., depth, bracing"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Areas to improve (comma-separated)
            </label>
            <input
              type="text"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="e.g., knee tracking, bar path"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Cues to focus on (comma-separated)
            </label>
            <input
              type="text"
              value={cues}
              onChange={(e) => setCues(e.target.value)}
              placeholder="e.g., spread the floor, chest up"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Video URL (optional)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={`
          w-full py-2 px-4 rounded font-medium text-sm transition-colors
          ${submitting
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {submitting ? 'Saving...' : 'Save Assessment'}
      </button>
    </div>
  )
}
