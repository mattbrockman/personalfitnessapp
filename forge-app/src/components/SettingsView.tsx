'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Integration } from '@/types/database'

interface SettingsViewProps {
  user: User
  profile: Profile | null
  integrations: Integration[]
}

export function SettingsView({ user, profile, integrations }: SettingsViewProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [ftpWatts, setFtpWatts] = useState(profile?.ftp_watts?.toString() || '')
  const [lthrBpm, setLthrBpm] = useState(profile?.lthr_bpm?.toString() || '')
  const [maxHrBpm, setMaxHrBpm] = useState(profile?.max_hr_bpm?.toString() || '')
  
  const supabase = createClient() as any
  const stravaIntegration = integrations.find(i => i.service === 'strava')

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({
          ftp_watts: ftpWatts ? parseInt(ftpWatts) : null,
          lthr_bpm: lthrBpm ? parseInt(lthrBpm) : null,
          max_hr_bpm: maxHrBpm ? parseInt(maxHrBpm) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
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
