'use client'

import { useState, useEffect } from 'react'
import { ProgressionModel, StrengthPreferences } from '@/types/strength'
import { Settings, TrendingUp, Repeat, Target, Save, X } from 'lucide-react'

interface ProgressionModelSelectorProps {
  onClose?: () => void
  onSave?: (preferences: Partial<StrengthPreferences>) => void
}

export function ProgressionModelSelector({ onClose, onSave }: ProgressionModelSelectorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [preferences, setPreferences] = useState<Partial<StrengthPreferences>>({
    progression_model: 'double',
    linear_increment_lbs: 5.0,
    linear_increment_upper_lbs: 2.5,
    double_rep_target_low: 8,
    double_rep_target_high: 12,
    double_weight_increase_lbs: 5.0,
    rpe_target_low: 7.0,
    rpe_target_high: 9.0,
  })

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch('/api/strength/preferences')
        if (res.ok) {
          const data = await res.json()
          if (data.preferences) {
            setPreferences(data.preferences)
          }
        }
      } catch (err) {
        console.error('Error fetching preferences:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPreferences()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/strength/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      if (res.ok) {
        onSave?.(preferences)
        onClose?.()
      }
    } catch (err) {
      console.error('Error saving preferences:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const models: { value: ProgressionModel; label: string; description: string; icon: any }[] = [
    {
      value: 'linear',
      label: 'Linear Progression',
      description: 'Add weight each session. Best for beginners.',
      icon: TrendingUp,
    },
    {
      value: 'double',
      label: 'Double Progression',
      description: 'Add reps until hitting target, then add weight. Most versatile.',
      icon: Repeat,
    },
    {
      value: 'rpe_based',
      label: 'RPE-Based',
      description: 'Adjust based on how hard sets feel. Best for auto-regulation.',
      icon: Target,
    },
  ]

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-700 rounded w-1/3" />
          <div className="h-20 bg-dark-700 rounded" />
          <div className="h-20 bg-dark-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold">Progression Settings</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X size={18} className="text-tertiary" />
          </button>
        )}
      </div>

      {/* Model selection */}
      <div className="mb-6">
        <label className="text-sm text-tertiary mb-2 block">Progression Model</label>
        <div className="space-y-2">
          {models.map((model) => {
            const Icon = model.icon
            const isSelected = preferences.progression_model === model.value
            return (
              <button
                key={model.value}
                onClick={() => setPreferences(p => ({ ...p, progression_model: model.value }))}
                className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                  isSelected ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-dark-700/50 hover:bg-dark-700'
                }`}
              >
                <Icon size={20} className={isSelected ? 'text-blue-400' : 'text-muted'} />
                <div>
                  <div className={`font-medium ${isSelected ? 'text-blue-400' : 'text-white/80'}`}>
                    {model.label}
                  </div>
                  <div className="text-xs text-secondary mt-0.5">{model.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Model-specific settings */}
      {preferences.progression_model === 'linear' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-tertiary mb-1 block">Lower Body Increment (lbs)</label>
            <input
              type="number"
              value={preferences.linear_increment_lbs || 5}
              onChange={(e) => setPreferences(p => ({ ...p, linear_increment_lbs: parseFloat(e.target.value) }))}
              className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
              step="2.5"
              min="2.5"
            />
          </div>
          <div>
            <label className="text-sm text-tertiary mb-1 block">Upper Body Increment (lbs)</label>
            <input
              type="number"
              value={preferences.linear_increment_upper_lbs || 2.5}
              onChange={(e) => setPreferences(p => ({ ...p, linear_increment_upper_lbs: parseFloat(e.target.value) }))}
              className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
              step="2.5"
              min="2.5"
            />
          </div>
        </div>
      )}

      {preferences.progression_model === 'double' && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-tertiary mb-1 block">Rep Target (Low)</label>
              <input
                type="number"
                value={preferences.double_rep_target_low || 8}
                onChange={(e) => setPreferences(p => ({ ...p, double_rep_target_low: parseInt(e.target.value) }))}
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
                min="1"
                max="20"
              />
            </div>
            <div>
              <label className="text-sm text-tertiary mb-1 block">Rep Target (High)</label>
              <input
                type="number"
                value={preferences.double_rep_target_high || 12}
                onChange={(e) => setPreferences(p => ({ ...p, double_rep_target_high: parseInt(e.target.value) }))}
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
                min="1"
                max="30"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-tertiary mb-1 block">Weight Increase (lbs)</label>
            <input
              type="number"
              value={preferences.double_weight_increase_lbs || 5}
              onChange={(e) => setPreferences(p => ({ ...p, double_weight_increase_lbs: parseFloat(e.target.value) }))}
              className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
              step="2.5"
              min="2.5"
            />
            <p className="text-xs text-muted mt-1">
              Weight added when you hit {preferences.double_rep_target_high || 12} reps on all sets
            </p>
          </div>
        </div>
      )}

      {preferences.progression_model === 'rpe_based' && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-tertiary mb-1 block">Target RPE (Low)</label>
              <input
                type="number"
                value={preferences.rpe_target_low || 7}
                onChange={(e) => setPreferences(p => ({ ...p, rpe_target_low: parseFloat(e.target.value) }))}
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
                step="0.5"
                min="5"
                max="10"
              />
            </div>
            <div>
              <label className="text-sm text-tertiary mb-1 block">Target RPE (High)</label>
              <input
                type="number"
                value={preferences.rpe_target_high || 9}
                onChange={(e) => setPreferences(p => ({ ...p, rpe_target_high: parseFloat(e.target.value) }))}
                className="w-full bg-dark-700 rounded-lg px-3 py-2 text-sm"
                step="0.5"
                min="5"
                max="10"
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Increase weight if RPE &lt; {preferences.rpe_target_low}, decrease if RPE &gt; {preferences.rpe_target_high}
          </p>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
      >
        <Save size={16} />
        {isSaving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}
