// Web Push Notification utilities
// Uses VAPID (Voluntary Application Server Identification) for push notifications

import webpush from 'web-push'

// ============================================================================
// Configuration
// ============================================================================

// Get VAPID keys from environment
export function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:support@forge.app'

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured. Push notifications will not work.')
    return null
  }

  return { publicKey, privateKey, email }
}

// Configure webpush with VAPID keys
export function configureWebPush() {
  const keys = getVapidKeys()
  if (!keys) return false

  webpush.setVapidDetails(keys.email, keys.publicKey, keys.privateKey)
  return true
}

// ============================================================================
// Types
// ============================================================================

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export interface RPENotificationData {
  type: 'rpe_prompt'
  workout_id: string
  workout_name: string
  url: string
}

// ============================================================================
// Notification Sending
// ============================================================================

/**
 * Send a push notification to a subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  const keys = getVapidKeys()
  if (!keys) {
    return { success: false, error: 'VAPID keys not configured' }
  }

  try {
    configureWebPush()

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'normal',
      }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Push notification failed:', error)

    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, error: 'subscription_expired' }
    }

    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Send RPE prompt notification
 */
export async function sendRPEPromptNotification(
  subscription: PushSubscription,
  workoutId: string,
  workoutName: string,
  platform?: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://forge.app'

  const payload: NotificationPayload = {
    title: 'How was your workout?',
    body: `Rate your ${workoutName}${platform ? ` from ${platform}` : ''}`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `rpe-${workoutId}`,
    data: {
      type: 'rpe_prompt' as const,
      workout_id: workoutId,
      workout_name: workoutName,
      url: `${baseUrl}/calendar?rpe=${workoutId}`,
    },
    actions: [
      { action: 'rate', title: 'Rate Now' },
      { action: 'dismiss', title: 'Later' },
    ],
  }

  return sendPushNotification(subscription, payload)
}

/**
 * Send notification to all subscriptions for a user
 */
export async function sendToAllSubscriptions(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{
  sent: number
  failed: number
  expired: string[]
}> {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  )

  let sent = 0
  let failed = 0
  const expired: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      sent++
    } else {
      failed++
      if (result.status === 'fulfilled' && result.value.error === 'subscription_expired') {
        expired.push(subscriptions[index].endpoint)
      }
    }
  })

  return { sent, failed, expired }
}

// ============================================================================
// Client-side helpers (for browser)
// ============================================================================

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined') return null
  return Notification.permission
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported')
  }

  return Notification.requestPermission()
}

/**
 * Get VAPID public key for client-side subscription
 * This should be called from an API endpoint to get the public key
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
