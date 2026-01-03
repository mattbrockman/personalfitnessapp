'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  RefreshCw,
  Calendar,
  Flag,
  ArrowRightLeft,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  Repeat,
  Clock,
  Zap,
} from 'lucide-react'

type PlanMode = 'rolling' | 'goal_based'

interface PlanModeConfig {
  plan_id: string
  plan_mode: PlanMode
  rolling_cycle?: {
    sequence: string[]
    repeat: boolean
  }
  rolling_phase_durations?: Record<string, number>
  auto_generate_weeks?: number
  regenerate_threshold?: number
  target_event_id?: string | null
  target_event_date?: string | null
  peak_readiness_target?: number
  taper_weeks?: number
  taper_volume_reduction?: number
  converted_from?: PlanMode | null
  converted_at?: string | null
}

interface PlanEvent {
  id: string
  name: string
  event_date: string
  event_type: string
}

interface PlanModeSettingsProps {
  planId: string
  onClose?: () => void
  onModeChanged?: () => void
}

export function PlanModeSettings({ planId, onClose, onModeChanged }: PlanModeSettingsProps) {
  const [config, setConfig] = useState<PlanModeConfig | null>(null)
  const [currentMode, setCurrentMode] = useState<PlanMode>('rolling')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [events, setEvents] = useState<PlanEvent[]>([])

  // Conversion modal state
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertTarget, setConvertTarget] = useState<PlanMode>('goal_based')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [customEventDate, setCustomEventDate] = useState<string>('')
  const [conversionReason, setConversionReason] = useState<string>('')

  // Fetch mode config
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/training-plans/${planId}/mode`)
      if (!res.ok) {
        throw new Error('Failed to fetch plan mode')
      }

      const data = await res.json()
      setCurrentMode(data.plan_mode)
      setConfig(data.config)
    } catch (err) {
      console.error('Error fetching plan mode:', err)
      setError(err instanceof Error ? err.message : 'Failed to load plan mode')
    } finally {
      setLoading(false)
    }
  }, [planId])

  // Fetch events for conversion
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/training-plans/${planId}/events`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Error fetching events:', err)
    }
  }, [planId])

  useEffect(() => {
    fetchConfig()
    fetchEvents()
  }, [fetchConfig, fetchEvents])

  // Update config
  const updateConfig = async (updates: Partial<PlanModeConfig>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/training-plans/${planId}/mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        throw new Error('Failed to update settings')
      }

      const data = await res.json()
      setConfig(data.config)
    } catch (err) {
      console.error('Error updating config:', err)
    } finally {
      setSaving(false)
    }
  }

  // Convert plan mode
  const convertMode = async () => {
    setConverting(true)
    try {
      const body: Record<string, unknown> = {
        target_mode: convertTarget,
        reason: conversionReason,
      }

      if (convertTarget === 'goal_based') {
        if (selectedEventId) {
          body.event_id = selectedEventId
        } else if (customEventDate) {
          body.event_date = customEventDate
        } else {
          throw new Error('Please select an event or enter a target date')
        }
      }

      const res = await fetch(`/api/training-plans/${planId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to convert plan mode')
      }

      // Refresh config
      await fetchConfig()
      setShowConvertModal(false)

      if (onModeChanged) {
        onModeChanged()
      }
    } catch (err) {
      console.error('Error converting mode:', err)
      setError(err instanceof Error ? err.message : 'Failed to convert plan mode')
    } finally {
      setConverting(false)
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="animate-spin text-white/60" />
          <span className="ml-2 text-sm text-white/60">Loading plan mode...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchConfig}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    )
  }

  // Content component
  const content = (
    <div className={`glass rounded-xl overflow-hidden ${onClose ? 'max-w-lg w-full' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-white/60" />
            <h3 className="font-semibold">Plan Mode Settings</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {expanded ? (
                <ChevronUp size={16} className="text-white/60" />
              ) : (
                <ChevronDown size={16} className="text-white/60" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

        {/* Mode indicator */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${
                currentMode === 'rolling'
                  ? 'bg-blue-500/20'
                  : 'bg-purple-500/20'
              }`}>
                {currentMode === 'rolling' ? (
                  <Repeat size={20} className="text-blue-400" />
                ) : (
                  <Target size={20} className="text-purple-400" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {currentMode === 'rolling' ? 'Rolling Mode' : 'Goal-Based Mode'}
                </p>
                <p className="text-xs text-tertiary">
                  {currentMode === 'rolling'
                    ? 'Continuous training without fixed end date'
                    : config?.target_event_date
                      ? `Targeting ${formatDate(config.target_event_date)}`
                      : 'Fixed timeline with target event'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setConvertTarget(currentMode === 'rolling' ? 'goal_based' : 'rolling')
                setShowConvertModal(true)
              }}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft size={14} />
              Convert
            </button>
          </div>

          {/* Conversion history */}
          {config?.converted_from && config.converted_at && (
            <div className="mt-3 p-2 bg-white/5 rounded-lg text-xs text-tertiary">
              <span>Converted from {config.converted_from} mode on {formatDate(config.converted_at)}</span>
            </div>
          )}
        </div>

        {/* Expanded settings */}
        {expanded && (
          <div className="p-4 border-t border-white/5 space-y-4">
            {currentMode === 'rolling' ? (
              <>
                {/* Rolling mode settings */}
                <div>
                  <label className="text-xs text-tertiary uppercase tracking-wide block mb-2">
                    Phase Cycle
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(config?.rolling_cycle?.sequence || ['base', 'build', 'recovery']).map((phase, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-white/10 rounded capitalize"
                      >
                        {phase}
                      </span>
                    ))}
                    {config?.rolling_cycle?.repeat && (
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
                        <Repeat size={10} />
                        Repeat
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-tertiary block mb-1">Auto-generate weeks</label>
                    <select
                      value={config?.auto_generate_weeks || 4}
                      onChange={(e) => updateConfig({ auto_generate_weeks: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                      disabled={saving}
                    >
                      <option value={2}>2 weeks ahead</option>
                      <option value={4}>4 weeks ahead</option>
                      <option value={6}>6 weeks ahead</option>
                      <option value={8}>8 weeks ahead</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-tertiary block mb-1">Regenerate at</label>
                    <select
                      value={config?.regenerate_threshold || 2}
                      onChange={(e) => updateConfig({ regenerate_threshold: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                      disabled={saving}
                    >
                      <option value={1}>1 week remaining</option>
                      <option value={2}>2 weeks remaining</option>
                      <option value={3}>3 weeks remaining</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Goal mode settings */}
                <div>
                  <label className="text-xs text-tertiary uppercase tracking-wide block mb-2">
                    Target Event
                  </label>
                  {config?.target_event_date ? (
                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                      <Flag size={16} className="text-purple-400" />
                      <div>
                        <p className="text-sm font-medium">{formatDate(config.target_event_date)}</p>
                        <p className="text-xs text-tertiary">
                          {Math.ceil((new Date(config.target_event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days away
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No target event set</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-tertiary block mb-1">Taper weeks</label>
                    <select
                      value={config?.taper_weeks || 2}
                      onChange={(e) => updateConfig({ taper_weeks: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                      disabled={saving}
                    >
                      <option value={1}>1 week</option>
                      <option value={2}>2 weeks</option>
                      <option value={3}>3 weeks</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-tertiary block mb-1">Taper volume reduction</label>
                    <select
                      value={config?.taper_volume_reduction || 40}
                      onChange={(e) => updateConfig({ taper_volume_reduction: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                      disabled={saving}
                    >
                      <option value={30}>30%</option>
                      <option value={40}>40%</option>
                      <option value={50}>50%</option>
                      <option value={60}>60%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-tertiary block mb-1">Target peak readiness</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={70}
                      max={100}
                      value={config?.peak_readiness_target || 85}
                      onChange={(e) => updateConfig({ peak_readiness_target: parseInt(e.target.value) })}
                      className="flex-1"
                      disabled={saving}
                    />
                    <span className="text-sm font-medium w-12 text-right">
                      {config?.peak_readiness_target || 85}%
                    </span>
                  </div>
                </div>
              </>
            )}

            {saving && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </div>
            )}
          </div>
        )}
      </div>
  )

  // Render as modal if onClose is provided, otherwise render inline
  return (
    <>
      {onClose ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          {content}
        </div>
      ) : (
        content
      )}

      {/* Conversion Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowRightLeft size={20} />
              Convert to {convertTarget === 'rolling' ? 'Rolling' : 'Goal-Based'} Mode
            </h3>

            {convertTarget === 'goal_based' ? (
              <div className="space-y-4">
                <p className="text-sm text-white/60">
                  Goal-based mode requires a target date. Select an existing event or enter a custom date.
                </p>

                {events.length > 0 && (
                  <div>
                    <label className="text-xs text-tertiary block mb-2">Select Event</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => {
                        setSelectedEventId(e.target.value)
                        if (e.target.value) setCustomEventDate('')
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                    >
                      <option value="">Choose an event...</option>
                      {events.map(event => (
                        <option key={event.id} value={event.id}>
                          {event.name} - {formatDate(event.event_date)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-tertiary block mb-2">
                    {events.length > 0 ? 'Or enter custom date' : 'Target Date'}
                  </label>
                  <input
                    type="date"
                    value={customEventDate}
                    onChange={(e) => {
                      setCustomEventDate(e.target.value)
                      if (e.target.value) setSelectedEventId('')
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/60">
                  Converting to rolling mode will remove the end date and set up a continuous training cycle.
                </p>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-400 mt-0.5" />
                    <p className="text-sm text-amber-400">
                      Any target events will remain but won't affect the plan structure.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs text-tertiary block mb-2">Reason (optional)</label>
              <input
                type="text"
                value={conversionReason}
                onChange={(e) => setConversionReason(e.target.value)}
                placeholder="Why are you converting?"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
              />
            </div>

            {error && (
              <div className="mt-4 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConvertModal(false)
                  setError(null)
                }}
                className="flex-1 py-2.5 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                disabled={converting}
              >
                Cancel
              </button>
              <button
                onClick={convertMode}
                disabled={converting || (convertTarget === 'goal_based' && !selectedEventId && !customEventDate)}
                className="flex-1 py-2.5 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {converting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Convert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
