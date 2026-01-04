// Forge Training Service Worker
// Handles push notifications for RPE prompts and other notifications

const CACHE_NAME = 'forge-v1'

// ============================================================================
// Install Event
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  // Skip waiting to activate immediately
  self.skipWaiting()
})

// ============================================================================
// Activate Event
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated')
  // Claim all clients immediately
  event.waitUntil(clients.claim())
})

// ============================================================================
// Push Event - Handle incoming push notifications
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  let payload = {
    title: 'Forge Training',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {},
  }

  // Parse the push message payload
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch (e) {
      console.error('[SW] Failed to parse push data:', e)
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag || 'forge-notification',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    actions: payload.actions || [],
    requireInteraction: true, // Keep notification visible until user interacts
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

// ============================================================================
// Notification Click Event
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)

  const notification = event.notification
  const data = notification.data || {}

  // Close the notification
  notification.close()

  // Handle action buttons
  if (event.action === 'dismiss' || event.action === 'later') {
    // Just close, do nothing
    return
  }

  // Determine URL to open
  let url = '/'

  if (data.type === 'rpe_prompt' && data.url) {
    url = data.url
  } else if (data.url) {
    url = data.url
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if the app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to the URL and focus
            client.navigate(url)
            return client.focus()
          }
        }

        // If not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

// ============================================================================
// Notification Close Event
// ============================================================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed without action')
})

// ============================================================================
// Background Sync (for future use)
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)

  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts())
  }
})

async function syncWorkouts() {
  try {
    const response = await fetch('/api/intervals/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'full' }),
    })

    if (!response.ok) {
      throw new Error('Sync failed')
    }

    console.log('[SW] Workouts synced successfully')
  } catch (error) {
    console.error('[SW] Workout sync failed:', error)
    throw error // Retry sync
  }
}

// ============================================================================
// Message Handler (for communication with main app)
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
