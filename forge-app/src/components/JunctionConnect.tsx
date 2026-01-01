'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface Provider {
  name: string
  slug: string
  status: string
  created_on: string
}

interface JunctionConnectProps {
  provider?: string // If specified, only show this provider
  providerName?: string // Display name for the provider
  onConnect?: () => void
  onDisconnect?: () => void
  onSync?: (count: number) => void
  showSyncButton?: boolean
  compact?: boolean
}

export default function JunctionConnect({
  provider,
  providerName,
  onConnect,
  onDisconnect,
  onSync,
  showSyncButton = true,
  compact = false,
}: JunctionConnectProps) {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectedProviders, setConnectedProviders] = useState<Provider[]>([])
  const [error, setError] = useState<string | null>(null)

  const isConnected = provider
    ? connectedProviders.some(p => p.slug === provider)
    : connectedProviders.length > 0

  const connectedProvider = provider
    ? connectedProviders.find(p => p.slug === provider)
    : null

  // Fetch connected providers
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/junction/providers')
      if (response.ok) {
        const data = await response.json()
        setConnectedProviders(data.providers || [])
      }
    } catch (err) {
      console.error('Error fetching providers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  // Handle connect button click
  const handleConnect = async () => {
    try {
      setConnecting(true)
      setError(null)

      // Get link token
      const response = await fetch('/api/junction/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: provider ? [provider] : undefined }),
      })

      if (!response.ok) {
        throw new Error('Failed to get connection link')
      }

      const { link_token } = await response.json()

      // Open Junction Link in new window
      const linkUrl = `https://link.tryvital.io/?token=${link_token}`
      const popup = window.open(linkUrl, 'junction_link', 'width=500,height=700')

      // Poll for popup close and refresh providers
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          fetchProviders()
          onConnect?.()
          setConnecting(false)
        }
      }, 500)

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed)
        setConnecting(false)
      }, 300000)

    } catch (err) {
      console.error('Error connecting:', err)
      setError('Failed to start connection. Please try again.')
      setConnecting(false)
    }
  }

  // Handle sync button click
  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch('/api/junction/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
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
    if (!provider) return

    try {
      setDisconnecting(true)
      setError(null)

      const response = await fetch('/api/junction/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      await fetchProviders()
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
      <div className={`flex items-center gap-2 ${compact ? '' : 'p-4'}`}>
        <Loader2 size={16} className="animate-spin text-white/40" />
        <span className="text-sm text-white/40">Loading...</span>
      </div>
    )
  }

  // Compact mode - single line
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="text-sm text-emerald-400">
              {providerName || connectedProvider?.name || 'Connected'}
            </span>
            {showSyncButton && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                title="Sync data"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
          >
            {connecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Link2 size={14} />
            )}
            Connect {providerName}
          </button>
        )}
      </div>
    )
  }

  // Full mode - card style
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
                <p className="font-medium">{providerName || connectedProvider?.name}</p>
                <p className="text-xs text-white/40">Connected</p>
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
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white/60">
            <Link2 size={20} />
            <div>
              <p className="font-medium text-white">{providerName || 'Connect Device'}</p>
              <p className="text-xs">Sync your health data automatically</p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 size={16} />
                Connect {providerName}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
