'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X, Loader2, Check } from 'lucide-react'

interface PushNotificationPromptProps {
  /** Show as inline banner instead of modal */
  inline?: boolean
  /** Called when user enables or dismisses */
  onComplete?: (enabled: boolean) => void
}

export function PushNotificationPrompt({ inline, onComplete }: PushNotificationPromptProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check support and current state on mount
  useEffect(() => {
    checkSupport()
  }, [])

  const checkSupport = async () => {
    // Check if push is supported
    if (typeof window === 'undefined') return

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)

      // Check if already subscribed
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          setIsSubscribed(!!sub)
        } catch (e) {
          console.error('Failed to check subscription:', e)
        }
      }
    }
  }

  const handleEnable = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Request permission
      const newPermission = await Notification.requestPermission()
      setPermission(newPermission)

      if (newPermission !== 'granted') {
        setError('Permission denied. You can enable notifications in your browser settings.')
        return
      }

      // Get VAPID public key
      const keyResponse = await fetch('/api/push-notifications/subscribe')
      if (!keyResponse.ok) {
        throw new Error('Push notifications not configured on server')
      }
      const { publicKey } = await keyResponse.json()

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - publicKey.length % 4) % 4)
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = atob(base64)
      const vapidKey = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        vapidKey[i] = rawData.charCodeAt(i)
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      // Send subscription to server
      const subResponse = await fetch('/api/push-notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      })

      if (!subResponse.ok) {
        throw new Error('Failed to save subscription')
      }

      setIsSubscribed(true)
      onComplete?.(true)

    } catch (err: any) {
      console.error('Push subscription error:', err)
      setError(err.message || 'Failed to enable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable = async () => {
    setIsLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe()

        // Remove from server
        await fetch('/api/push-notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      setIsSubscribed(false)
      onComplete?.(false)

    } catch (err: any) {
      console.error('Push unsubscribe error:', err)
      setError(err.message || 'Failed to disable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onComplete?.(false)
  }

  // Don't render if not supported, dismissed, or already handled
  if (!isSupported || isDismissed) {
    return null
  }

  // If already subscribed, show status
  if (isSubscribed) {
    if (inline) {
      return (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-emerald-400">Notifications Enabled</p>
              <p className="text-sm text-secondary">You&apos;ll receive RPE prompts after workouts</p>
            </div>
          </div>
          <button
            onClick={handleDisable}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Disable'}
          </button>
        </div>
      )
    }
    return null
  }

  // If permission denied, show message
  if (permission === 'denied') {
    if (inline) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <BellOff size={20} className="text-red-400" />
            <div>
              <p className="font-medium text-red-400">Notifications Blocked</p>
              <p className="text-sm text-secondary">
                Enable notifications in your browser settings to receive RPE prompts.
              </p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Inline banner style
  if (inline) {
    return (
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        {error && (
          <div className="mb-3 p-2 bg-red-500/10 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Enable Push Notifications</p>
            <p className="text-sm text-secondary mb-3">
              Get reminded to rate your workouts after completing them on Zwift or Wahoo.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell size={16} />
                    Enable
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-secondary hover:text-white text-sm transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Modal style (floating banner at bottom)
  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
      <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 text-secondary hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="font-medium">Stay on top of your training</p>
            <p className="text-sm text-secondary mb-3">
              Enable notifications to get RPE prompts after completing workouts.
            </p>
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell size={16} />
                  Enable Notifications
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to check notification status
export function useNotificationStatus() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    const check = async () => {
      if (typeof window === 'undefined') return

      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window

      setIsSupported(supported)

      if (supported && 'Notification' in window) {
        setPermission(Notification.permission)

        if (Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()
            setIsSubscribed(!!sub)
          } catch (e) {
            console.error('Failed to check subscription:', e)
          }
        }
      }
    }

    check()
  }, [])

  return { isSupported, isSubscribed, permission }
}
