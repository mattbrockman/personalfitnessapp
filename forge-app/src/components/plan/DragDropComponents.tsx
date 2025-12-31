'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SuggestedWorkout } from '@/types/training-plan'
import { SuggestedWorkoutCard } from './SuggestedWorkoutCard'

interface DraggableWorkoutCardProps {
  id: string
  workout: SuggestedWorkout
  onEdit?: (workout: SuggestedWorkout) => void
  onSchedule?: (workout: SuggestedWorkout) => void
  onSkip?: (workout: SuggestedWorkout) => void
}

export function DraggableWorkoutCard({
  id,
  workout,
  onEdit,
  onSchedule,
  onSkip,
}: DraggableWorkoutCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: { workout },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="touch-none"
    >
      <SuggestedWorkoutCard
        workout={workout}
        onEdit={onEdit}
        onSchedule={onSchedule}
        onSkip={onSkip}
        compact
      />
    </div>
  )
}

interface DroppableDayColumnProps {
  id: string
  children: React.ReactNode
  isOver?: boolean
}

export function DroppableDayColumn({
  id,
  children,
  isOver: parentIsOver,
}: DroppableDayColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  const showDropIndicator = isOver || parentIsOver

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all duration-200 ${
        isOver ? 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-[#1a1a2e]' : ''
      }`}
    >
      {children}
      {/* Drop indicator overlay */}
      {isOver && (
        <div className="absolute inset-0 bg-amber-500/10 rounded-xl pointer-events-none z-10" />
      )}
    </div>
  )
}
