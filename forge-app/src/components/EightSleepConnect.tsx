'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface EightSleepConnectProps {
  onConnect?: () => void
  onDisconnect?: () => void
  onSync?: (count: number) => void
  showSyncButton?: boolean
}

export default function EightSleepConnect({
  onConnect,
  onDisconnect,
  onSync,
  showSyncButton = true,
}: EightSleepConnectProps) {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Check connection status
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/eightsleep/auth')
      if (response.ok) {
        const data = await response.json()
        setIsConnected(data.connected)
        setNeedsRefresh(data.needs_refresh)
      }
    } catch (err) {
      console.error('Error checking Eight Sleep status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Handle connect
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your Eight Sleep email and password')
      return
    }

    try {
      setConnecting(true)
      setError(null)

      const response = await fetch('/api/eightsleep/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Connection failed')
      }

      setIsConnected(true)
      setShowForm(false)
      setEmail('')
      setPassword('')
      onConnect?.()

      // Auto-sync after connecting
      handleSync()
    } catch (err: any) {
      console.error('Error connecting:', err)
      setError(err.message || 'Failed to connect. Check your credentials.')
    } finally {
      setConnecting(false)
    }
  }

  // Handle sync
  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch('/api/eightsleep/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Sync failed')
      }

      const data = await response.json()
      onSync?.(data.synced)
    } catch (err: any) {
      console.error('Error syncing:', err)
      setError(err.message || 'Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      setError(null)

      const response = await fetch('/api/eightsleep/auth', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      setIsConnected(false)
      onDisconnect?.()
    } catch (err) {
      console.error('Error disconnecting:', err)
      setError('Failed to disconnect. Please try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 size={16} className="animate-spin text-white/40" />
        <span className="text-sm text-white/40">Loading...</span>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      {error && (
        <div className="mb-3 p-2 bg-red-500/10 rounded-lg flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <div>
                <p className="font-medium">Eight Sleep</p>
                <p className="text-xs text-white/40">
                  {needsRefresh ? 'Session expired - sync to refresh' : 'Connected'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-red-400"
              title="Disconnect"
            >
              {disconnecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Unlink size={16} />
              )}
            </button>
          </div>

          {showSyncButton && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Sync Data
                </>
              )}
            </button>
          )}
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-sm text-white/60 mb-1">Eight Sleep Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
              disabled={connecting}
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your Eight Sleep password"
                className="w-full px-3 py-2 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
                disabled={connecting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/60"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <p className="text-xs text-white/40">
            Your credentials are stored securely and only used to sync your sleep data.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              disabled={connecting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={connecting || !email || !password}
              className="flex-1 py-2 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white/60">
            <Link2 size={20} />
            <div>
              <p className="font-medium text-white">Eight Sleep</p>
              <p className="text-xs">Sync your sleep data automatically</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Link2 size={16} />
            Connect Eight Sleep
          </button>
        </div>
      )}
    </div>
  )
}
