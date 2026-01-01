import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forge - Unified Fitness Tracking',
  description: 'Track strength, cardio, nutrition, and recovery in one place.',
  // PWA meta tags for iOS home screen app
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Forge',
  },
  // Additional meta for Android/Chrome
  manifest: '/manifest.json',
  themeColor: '#0c0c0e',
  applicationName: 'Forge',
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // For iPhone notch
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
