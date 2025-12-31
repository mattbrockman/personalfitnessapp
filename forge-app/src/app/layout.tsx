import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forge - Unified Fitness Tracking',
  description: 'Track strength, cardio, nutrition, and recovery in one place.',
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
