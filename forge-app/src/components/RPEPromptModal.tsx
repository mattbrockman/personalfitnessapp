'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Dumbbell, Bike, Heart, Clock } from 'lucide-react'

interface RPEPrompt {
  id: string
  workout_id: string
  workout_name: string
  workout_category?: string
  workout_type?: string
  workout_date?: string
  completed_at?: string
  duration_minutes?: number
  tss?: number
  source_platform?: string
}

interface RPEPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: () => void
}

const RPE_SCALE = [
  { value: 1, label: 'Very Light', description: 'Barely any effort', color: 'bg-blue-400' },
  { value: 2, label: 'Light', description: 'Easy conversation', color: 'bg-blue-500' },
  { value: 3, label: 'Moderate', description: 'Comfortable', color: 'bg-green-400' },
  { value: 4, label: 'Somewhat Hard', description: 'Starting to breathe harder', color: 'bg-green-500' },
  { value: 5, label: 'Hard', description: 'Challenging but sustainable', color: 'bg-yellow-400' },
  { value: 6, label: 'Harder', description: 'Conversation difficult', color: 'bg-yellow-500' },
  { value: 7, label: 'Very Hard', description: 'Pushing limits', color: 'bg-orange-400' },
  { value: 8, label: 'Extremely Hard', description: 'Can barely talk', color: 'bg-orange-500' },
  { value: 9, label: 'Near Max', description: 'Almost all-out', color: 'bg-red-400' },
  { value: 10, label: 'Maximal', description: 'Absolute limit', color: 'bg-red-600' },
]

export function RPEPromptModal({ isOpen, onClose, onSubmit }: RPEPromptModalProps) {
  const [prompts, setPrompts] = useState<RPEPrompt[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedRPE, setSelectedRPE] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch pending prompts
  useEffect(() => {
    if (isOpen) {
      fetchPrompts()
    }
  }, [isOpen])

  const fetchPrompts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/rpe/prompt')
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.pending || [])
        setCurrentIndex(0)
        setSelectedRPE(null)
        setNotes('')
      }
    } catch (error) {
      console.error('Failed to fetch RPE prompts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (selectedRPE === null || !prompts[currentIndex]) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/rpe/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout_id: prompts[currentIndex].workout_id,
          rpe_value: selectedRPE,
          notes: notes || undefined,
        }),
      })

      if (response.ok) {
        // Move to next prompt or close
        if (currentIndex < prompts.length - 1) {
          setCurrentIndex(currentIndex + 1)
          setSelectedRPE(null)
          setNotes('')
        } else {
          onSubmit?.()
          onClose()
        }
      }
    } catch (error) {
      console.error('Failed to submit RPE:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    if (!prompts[currentIndex]) return

    try {
      await fetch(`/api/rpe/prompt?workout_id=${prompts[currentIndex].workout_id}`, {
        method: 'DELETE',
      })

      // Move to next prompt or close
      if (currentIndex < prompts.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setSelectedRPE(null)
        setNotes('')
      } else {
        onClose()
      }
    } catch (error) {
      console.error('Failed to dismiss prompt:', error)
    }
  }

  const currentPrompt = prompts[currentIndex]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold">How was your workout?</h2>
            {prompts.length > 1 && (
              <p className="text-sm text-secondary">
                {currentIndex + 1} of {prompts.length} workouts
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-secondary mb-2" />
              <p className="text-sm text-secondary">Loading...</p>
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-12">
              <Heart size={48} className="mx-auto text-secondary mb-4" />
              <p className="text-secondary">No pending workouts to rate!</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          ) : currentPrompt ? (
            <>
              {/* Workout Info */}
              <div className="p-4 bg-white/5 rounded-xl mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    currentPrompt.workout_category === 'cardio'
                      ? 'bg-blue-500/20'
                      : 'bg-amber-500/20'
                  }`}>
                    {currentPrompt.workout_category === 'cardio' ? (
                      <Bike size={20} className="text-blue-400" />
                    ) : (
                      <Dumbbell size={20} className="text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{currentPrompt.workout_name}</p>
                    <p className="text-sm text-secondary">
                      {currentPrompt.workout_date && new Date(currentPrompt.workout_date).toLocaleDateString()}
                      {currentPrompt.source_platform && ` • via ${currentPrompt.source_platform}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-secondary">
                  {currentPrompt.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {currentPrompt.duration_minutes} min
                    </span>
                  )}
                  {currentPrompt.tss && (
                    <span>TSS: {Math.round(currentPrompt.tss)}</span>
                  )}
                </div>
              </div>

              {/* RPE Scale */}
              <div className="mb-4">
                <label className="block text-sm text-secondary mb-2">
                  Rate your perceived exertion (1-10)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {RPE_SCALE.map(({ value, label, color }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedRPE(value)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all ${
                        selectedRPE === value
                          ? `${color} text-white ring-2 ring-white ring-offset-2 ring-offset-zinc-900`
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <span className="text-xl font-bold">{value}</span>
                      <span className="text-[10px] leading-tight text-center px-1">
                        {label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedRPE && (
                  <div className="mt-3 p-3 bg-white/5 rounded-lg">
                    <p className="font-medium">{RPE_SCALE[selectedRPE - 1].label}</p>
                    <p className="text-sm text-secondary">
                      {RPE_SCALE[selectedRPE - 1].description}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm text-secondary mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did you feel? Any issues?"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-secondary"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selectedRPE === null || isSubmitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// Hook to check for pending RPE prompts
export function usePendingRPEPrompts() {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchCount = async () => {
    try {
      const response = await fetch('/api/rpe/prompt')
      if (response.ok) {
        const data = await response.json()
        setCount(data.count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch RPE count:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCount()
    // Poll every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return { count, isLoading, refetch: fetchCount }
}
