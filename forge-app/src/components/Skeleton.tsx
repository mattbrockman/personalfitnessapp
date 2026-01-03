'use client'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className}`}
      aria-hidden="true"
    />
  )
}

// Pre-built skeleton patterns for common UI elements

export function SkeletonCard() {
  return (
    <div className="border border-white/10 rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonWorkoutCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <div className="p-4 bg-zinc-800/50 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonCalendarDay() {
  return (
    <div className="min-h-[140px] p-2 border-b border-r border-white/5">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>
      <div className="space-y-1.5">
        <SkeletonWorkoutCard />
      </div>
    </div>
  )
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-4 border border-white/10 rounded-xl">
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="w-5 h-5 rounded" />
    </div>
  )
}

export function SkeletonCalendarGrid() {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-white/5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="p-3 text-center text-sm text-secondary font-medium border-b border-white/5">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar skeleton */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <SkeletonCalendarDay key={i} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonListView() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <span className="sr-only">Loading content...</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-white/5">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
          <div className="p-3">
            <SkeletonWorkoutCard />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonChat() {
  return (
    <div className="space-y-4 p-4">
      {/* Assistant message */}
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
      </div>
      {/* User message */}
      <div className="flex gap-3 flex-row-reverse">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <Skeleton className="h-10 w-1/2 rounded-2xl" />
      </div>
      {/* Assistant message */}
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <Skeleton className="h-24 w-4/5 rounded-2xl" />
      </div>
    </div>
  )
}
