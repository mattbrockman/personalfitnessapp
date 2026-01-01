'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import {
  Link as LinkIcon,
  Check,
  X,
  RefreshCw,
  Loader2,
  LogOut,
  User as UserIcon,
  Activity,
  Dumbbell,
  MapPin,
  Navigation,
  Bot,
  Trash2,
  Calendar,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Integration } from '@/types/database'

interface SettingsViewProps {
  user: User
  profile: Profile | null
  integrations: Integration[]
}

const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Barbell & Rack' },
  { id: 'dumbbell', label: 'Dumbbells' },
  { id: 'cable', label: 'Cable Machine' },
  { id: 'machine', label: 'Weight Machines' },
  { id: 'bodyweight', label: 'Bodyweight / Pull-up Bar' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'bands', label: 'Resistance Bands' },
]

const DEFAULT_EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

const AI_MODEL_OPTIONS = [
  { id: 'claude-opus-4-20250514', label: 'Claude Opus', description: 'Most capable, detailed advice' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet', description: 'Balanced speed & quality' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku', description: 'Fast, concise responses' },
]

const AI_PERSONALITY_OPTIONS = [
  { id: 'coach', label: 'Coach', description: 'Direct & motivating' },
  { id: 'scientist', label: 'Scientist', description: 'Evidence-based & analytical' },
  { id: 'friend', label: 'Friend', description: 'Conversational & supportive' },
]

export function SettingsView({ user, profile, integrations }: SettingsViewProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [ftpWatts, setFtpWatts] = useState(profile?.ftp_watts?.toString() || '')
  const [lthrBpm, setLthrBpm] = useState(profile?.lthr_bpm?.toString() || '')
  const [maxHrBpm, setMaxHrBpm] = useState(profile?.max_hr_bpm?.toString() || '')
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(
    profile?.available_equipment || DEFAULT_EQUIPMENT
  )

  // Location state
  const [zipCode, setZipCode] = useState((profile as any)?.weather_zip_code || '')
  const [locationName, setLocationName] = useState((profile as any)?.weather_location_name || '')
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // AI Coach state
  const [aiModel, setAiModel] = useState((profile as any)?.ai_coach_model || 'claude-opus-4-20250514')
  const [aiPersonality, setAiPersonality] = useState((profile as any)?.ai_coach_personality || 'coach')
  const [isSavingAI, setIsSavingAI] = useState(false)
  const [isClearingChat, setIsClearingChat] = useState(false)

  // Calendar sync state
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarUrl, setCalendarUrl] = useState('')
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true)
  const [isTogglingCalendar, setIsTogglingCalendar] = useState(false)
  const [isRegeneratingUrl, setIsRegeneratingUrl] = useState(false)
  const [calendarCopied, setCalendarCopied] = useState(false)

  const supabase = createClient() as any
  const stravaIntegration = integrations.find(i => i.service === 'strava')

  // Load calendar settings on mount
  useEffect(() => {
    const loadCalendarSettings = async () => {
      try {
        const response = await fetch('/api/calendar/token')
        if (response.ok) {
          const data = await response.json()
          setCalendarEnabled(data.calendar_enabled)
          setCalendarUrl(data.calendar_url)
        }
      } catch (error) {
        console.error('Failed to load calendar settings:', error)
      } finally {
        setIsLoadingCalendar(false)
      }
    }
    loadCalendarSettings()
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({
          ftp_watts: ftpWatts ? parseInt(ftpWatts) : null,
          lthr_bpm: lthrBpm ? parseInt(lthrBpm) : null,
          max_hr_bpm: maxHrBpm ? parseInt(maxHrBpm) : null,
          available_equipment: availableEquipment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEquipment = (equipmentId: string) => {
    setAvailableEquipment(prev =>
      prev.includes(equipmentId)
        ? prev.filter(e => e !== equipmentId)
        : [...prev, equipmentId]
    )
  }

  // Location handlers
  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setIsGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch('/api/weather/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              locationName: 'Current Location',
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save location')
          }

          const data = await response.json()
          setLocationName(data.name)
          setZipCode('')
        } catch (error) {
          setLocationError('Failed to save location')
        } finally {
          setIsGettingLocation(false)
        }
      },
      (error) => {
        setLocationError('Unable to get your location. Please enter a zip code instead.')
        setIsGettingLocation(false)
      }
    )
  }

  const handleSaveZipCode = async () => {
    if (!zipCode || zipCode.length < 5) {
      setLocationError('Please enter a valid 5-digit zip code')
      return
    }

    setIsSavingLocation(true)
    setLocationError(null)

    try {
      const response = await fetch('/api/weather/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Invalid zip code')
      }

      const data = await response.json()
      setLocationName(data.name)
    } catch (error: any) {
      setLocationError(error.message || 'Failed to save location')
    } finally {
      setIsSavingLocation(false)
    }
  }

  // AI Coach handlers
  const handleSaveAISettings = async () => {
    setIsSavingAI(true)
    try {
      await supabase
        .from('profiles')
        .update({
          ai_coach_model: aiModel,
          ai_coach_personality: aiPersonality,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    } catch (error) {
      console.error('Save AI settings error:', error)
    } finally {
      setIsSavingAI(false)
    }
  }

  const handleClearChatHistory = async () => {
    if (!confirm('Clear all chat history with the AI coach? This cannot be undone.')) return

    setIsClearingChat(true)
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'DELETE',
      })
      if (response.ok) {
        alert('Chat history cleared')
      }
    } catch (error) {
      console.error('Clear chat error:', error)
    } finally {
      setIsClearingChat(false)
    }
  }

  // Calendar handlers
  const handleToggleCalendar = async () => {
    setIsTogglingCalendar(true)
    try {
      const response = await fetch('/api/calendar/token', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !calendarEnabled }),
      })
      if (response.ok) {
        setCalendarEnabled(!calendarEnabled)
      }
    } catch (error) {
      console.error('Toggle calendar error:', error)
    } finally {
      setIsTogglingCalendar(false)
    }
  }

  const handleRegenerateUrl = async () => {
    if (!confirm('Regenerate calendar URL? Your old URL will stop working immediately.')) return

    setIsRegeneratingUrl(true)
    try {
      const response = await fetch('/api/calendar/token', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setCalendarUrl(data.calendar_url)
      }
    } catch (error) {
      console.error('Regenerate URL error:', error)
    } finally {
      setIsRegeneratingUrl(false)
    }
  }

  const handleCopyCalendarUrl = async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl)
      setCalendarCopied(true)
      setTimeout(() => setCalendarCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const handleDisconnectStrava = async () => {
    if (!confirm('Disconnect Strava? Your synced workouts will remain.')) return

    await supabase
      .from('integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('service', 'strava')

    window.location.reload()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-semibold mb-6">Settings</h1>

      {/* Profile Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserIcon size={20} className="text-white/40" />
          Profile
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white/50"
            />
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-white/40" />
          Location
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Set your location to see weather forecasts in your calendar.
        </p>

        {locationError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            {locationError}
          </div>
        )}

        <button
          onClick={handleUseCurrentLocation}
          disabled={isGettingLocation}
          className="w-full mb-4 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGettingLocation ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <Navigation size={18} />
              Use Current Location
            </>
          )}
        </button>

        <div className="text-center text-sm text-white/40 mb-4">— or enter zip code —</div>

        <div className="flex gap-2">
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Enter zip code"
            maxLength={5}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
          />
          <button
            onClick={handleSaveZipCode}
            disabled={isSavingLocation || zipCode.length < 5}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingLocation ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Save'
            )}
          </button>
        </div>

        {locationName && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
            <Check size={16} className="text-emerald-400" />
            <span className="text-sm text-emerald-400">{locationName}</span>
          </div>
        )}
      </section>

      {/* AI Coach Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot size={20} className="text-white/40" />
          AI Coach
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Customize your AI training assistant's behavior and capabilities.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Model Selection */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Model</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500/50"
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-zinc-900">
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">
              {AI_MODEL_OPTIONS.find(o => o.id === aiModel)?.description}
            </p>
          </div>

          {/* Personality Selection */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Personality</label>
            <select
              value={aiPersonality}
              onChange={(e) => setAiPersonality(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500/50"
            >
              {AI_PERSONALITY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-zinc-900">
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">
              {AI_PERSONALITY_OPTIONS.find(o => o.id === aiPersonality)?.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAISettings}
            disabled={isSavingAI}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingAI && <Loader2 size={16} className="animate-spin" />}
            Save Settings
          </button>

          <button
            onClick={handleClearChatHistory}
            disabled={isClearingChat}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isClearingChat ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Clear Chat History
          </button>
        </div>
      </section>

      {/* Calendar Sync Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-white/40" />
          Calendar Sync
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Subscribe to your training calendar in Google Calendar, Apple Calendar, or any app that supports iCal feeds.
        </p>

        {isLoadingCalendar ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-white/40" />
          </div>
        ) : (
          <>
            {/* Enable/Disable Toggle */}
            <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg mb-4 cursor-pointer hover:bg-white/10 transition-colors">
              <div>
                <p className="font-medium">Enable calendar feed</p>
                <p className="text-sm text-white/50">Allow external apps to subscribe to your training calendar</p>
              </div>
              <button
                onClick={handleToggleCalendar}
                disabled={isTogglingCalendar}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  calendarEnabled ? 'bg-amber-500' : 'bg-white/20'
                }`}
              >
                {isTogglingCalendar ? (
                  <Loader2 size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                ) : (
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      calendarEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                )}
              </button>
            </label>

            {/* Calendar URL (only shown when enabled) */}
            {calendarEnabled && calendarUrl && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Calendar URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calendarUrl}
                      readOnly
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white/70 text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyCalendarUrl}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {calendarCopied ? (
                        <>
                          <Check size={16} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-white/40 mt-2">
                    Keep this URL private. Anyone with it can see your training calendar.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRegenerateUrl}
                    disabled={isRegeneratingUrl}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isRegeneratingUrl ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Regenerate URL
                  </button>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                  <h4 className="font-medium text-violet-400 mb-2 flex items-center gap-2">
                    <ExternalLink size={16} />
                    How to add to your calendar
                  </h4>
                  <ol className="text-sm text-white/60 space-y-1 list-decimal list-inside">
                    <li>Copy the URL above</li>
                    <li>In Google Calendar: Settings → Add calendar → From URL</li>
                    <li>Paste the URL and click "Add calendar"</li>
                    <li>Events will sync automatically (updates every few hours)</li>
                  </ol>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Training Zones Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={20} className="text-white/40" />
          Training Zones
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Set your threshold values for accurate TSS and zone calculations.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">FTP (watts)</label>
            <input
              type="number"
              value={ftpWatts}
              onChange={(e) => setFtpWatts(e.target.value)}
              placeholder="e.g., 250"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">Functional Threshold Power</p>
          </div>
          
          <div>
            <label className="block text-sm text-white/60 mb-2">LTHR (bpm)</label>
            <input
              type="number"
              value={lthrBpm}
              onChange={(e) => setLthrBpm(e.target.value)}
              placeholder="e.g., 165"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">Lactate Threshold HR</p>
          </div>
          
          <div>
            <label className="block text-sm text-white/60 mb-2">Max HR (bpm)</label>
            <input
              type="number"
              value={maxHrBpm}
              onChange={(e) => setMaxHrBpm(e.target.value)}
              placeholder="e.g., 185"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">Maximum Heart Rate</p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          Save Changes
        </button>
      </section>

      {/* Equipment & Space Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Dumbbell size={20} className="text-white/40" />
          Equipment & Space
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Select the equipment you have access to. This is used by the AI workout generator to create workouts tailored to your setup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <label
              key={eq.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                availableEquipment.includes(eq.id)
                  ? 'bg-amber-500/20 border border-amber-500/50'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              <input
                type="checkbox"
                checked={availableEquipment.includes(eq.id)}
                onChange={() => toggleEquipment(eq.id)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  availableEquipment.includes(eq.id)
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-white/30'
                }`}
              >
                {availableEquipment.includes(eq.id) && (
                  <Check size={14} className="text-black" />
                )}
              </div>
              <span className={availableEquipment.includes(eq.id) ? 'text-white' : 'text-white/70'}>
                {eq.label}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" />}
          Save Changes
        </button>
      </section>

      {/* Integrations Section */}
      <section className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <LinkIcon size={20} className="text-white/40" />
          Integrations
        </h2>

        {/* Strava */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Strava</p>
              {stravaIntegration ? (
                <p className="text-sm text-emerald-400 flex items-center gap-1">
                  <Check size={14} />
                  Connected
                </p>
              ) : (
                <p className="text-sm text-white/50">Not connected</p>
              )}
            </div>
          </div>

          {stravaIntegration ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">
                Last sync: {stravaIntegration.last_sync_at 
                  ? new Date(stravaIntegration.last_sync_at).toLocaleDateString()
                  : 'Never'}
              </span>
              <button
                onClick={handleDisconnectStrava}
                className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/strava"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm transition-colors"
            >
              Connect
            </a>
          )}
        </div>

        {/* Future integrations */}
        <div className="mt-4 p-4 border border-dashed border-white/10 rounded-lg">
          <p className="text-sm text-white/40 text-center">
            More integrations coming soon: TrainerRoad, Zwift, Apple Health, WHOOP
          </p>
        </div>
      </section>

      {/* Sign Out */}
      <section className="glass rounded-xl p-6">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </section>
    </div>
  )
}
