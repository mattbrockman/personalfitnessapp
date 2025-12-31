'use client'

import { useSearchParams } from 'next/navigation'
import { LiftingTab } from '@/components/LiftingTab'

export default function LiftingPage() {
  const searchParams = useSearchParams()
  const workoutId = searchParams.get('workout_id')

  return <LiftingTab workoutId={workoutId} />
}
