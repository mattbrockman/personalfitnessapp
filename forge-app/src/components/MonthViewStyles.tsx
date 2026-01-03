'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns'
import {
  Bike,
  Dumbbell,
  Activity,
  Footprints,
  Waves,
  CheckCircle,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { Workout } from '@/types/database'
import { WeatherDay } from '@/lib/weather'
import { WeatherBadgeCompact } from './WeatherBadge'

interface MonthViewStylesProps {
  currentDate: Date
  workouts: Workout[]
  workoutsByDate: Record<string, Workout[]>
  onSelectWorkout: (workout: Workout) => void
  onSelectDate: (date: Date) => void
  weatherByDate?: Record<string, WeatherDay>
  onWeatherClick?: (weather: WeatherDay) => void
  onWorkoutMove?: (workoutId: string, newDate: string) => Promise<void>
}

const workoutIcons: Record<string, any> = {
  bike: Bike,
  cycling: Bike,
  run: Footprints,
  running: Footprints,
  swim: Waves,
  swimming: Waves,
  strength: Dumbbell,
  default: Activity,
}

const categoryColors: Record<string, string> = {
  cardio: 'bg-sky-500',
  strength: 'bg-violet-500',
  other: 'bg-amber-500',
}

export function MonthViewStyles({
  currentDate,
  workouts,
  workoutsByDate,
  onSelectWorkout,
  onSelectDate,
  weatherByDate = {},
  onWeatherClick,
  onWorkoutMove,
}: MonthViewStylesProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [draggedWorkout, setDraggedWorkout] = useState<string | null>(null)
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getWorkoutIcon = (type: string) => {
    return workoutIcons[type] || workoutIcons.default
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, workoutId: string) => {
    setDraggedWorkout(workoutId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', workoutId)
  }

  const handleDragEnd = () => {
    setDraggedWorkout(null)
    setDropTargetDate(null)
  }

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetDate(dateKey)
  }

  const handleDragLeave = () => {
    setDropTargetDate(null)
  }

  const handleDrop = async (e: React.DragEvent, newDate: string) => {
    e.preventDefault()
    const workoutId = e.dataTransfer.getData('text/plain')

    if (!workoutId || !onWorkoutMove) {
      setDraggedWorkout(null)
      setDropTargetDate(null)
      return
    }

    const workout = workouts.find(w => w.id === workoutId)
    if (!workout || workout.scheduled_date === newDate || workout.status === 'completed') {
      setDraggedWorkout(null)
      setDropTargetDate(null)
      return
    }

    await onWorkoutMove(workoutId, newDate)
    setDraggedWorkout(null)
    setDropTargetDate(null)
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-white/5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
          <div key={i} className="p-2 text-center text-xs text-secondary font-medium border-b border-white/5">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayWorkouts = workoutsByDate[dateKey] || []
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isCurrentDay = isToday(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const dayWeather = weatherByDate[dateKey]
          const showWeather = dayWeather && (isToday(day) || day > new Date())
          const isDropTarget = dropTargetDate === dateKey

          return (
            <div
              key={idx}
              onClick={() => setSelectedDay(day)}
              onDragOver={(e) => handleDragOver(e, dateKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dateKey)}
              className={`min-h-[80px] p-1.5 border-b border-r border-white/5 cursor-pointer transition-colors ${
                !isCurrentMonth ? 'opacity-30' : ''
              } ${isSelected ? 'bg-amber-500/10' : 'hover:bg-white/5'} ${
                isDropTarget ? 'bg-amber-500/20 ring-2 ring-inset ring-amber-500/40' : ''
              }`}
            >
              {/* Date */}
              <div className={`text-xs font-medium mb-1 ${
                isCurrentDay
                  ? 'w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center'
                  : 'text-white/60'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {/* Weather pill - compact */}
                {showWeather && dayWeather && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex justify-center"
                  >
                    <WeatherBadgeCompact
                      weather={dayWeather}
                      onClick={() => onWeatherClick?.(dayWeather)}
                    />
                  </div>
                )}
                {dayWorkouts.slice(0, 3).map(workout => {
                  const color = categoryColors[workout.category] || categoryColors.other
                  const canDrag = workout.status === 'planned'
                  const isDragging = draggedWorkout === workout.id
                  return (
                    <div
                      key={workout.id}
                      draggable={canDrag}
                      onDragStart={(e) => {
                        e.stopPropagation()
                        canDrag && handleDragStart(e, workout.id)
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectWorkout(workout)
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate ${color} ${
                        workout.status === 'completed' ? '' : 'opacity-60'
                      } ${isDragging ? 'opacity-30 scale-95' : ''} ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                    >
                      {workout.name || workout.workout_type}
                    </div>
                  )
                })}
                {dayWorkouts.length > 3 && (
                  <div className="text-[9px] text-secondary px-1">+{dayWorkouts.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="p-3 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">{format(selectedDay, 'EEEE, MMMM d')}</div>
            {weatherByDate[format(selectedDay, 'yyyy-MM-dd')] && (
              <WeatherBadgeCompact
                weather={weatherByDate[format(selectedDay, 'yyyy-MM-dd')]}
                onClick={() => onWeatherClick?.(weatherByDate[format(selectedDay, 'yyyy-MM-dd')])}
              />
            )}
          </div>
          {(workoutsByDate[format(selectedDay, 'yyyy-MM-dd')] || []).length === 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">No workouts scheduled</span>
              <button
                onClick={() => onSelectDate(selectedDay)}
                className="text-xs text-amber-400/70 hover:text-amber-400"
              >
                + Add workout
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(workoutsByDate[format(selectedDay, 'yyyy-MM-dd')] || []).map(workout => {
                const Icon = getWorkoutIcon(workout.workout_type)
                return (
                  <button
                    key={workout.id}
                    onClick={() => onSelectWorkout(workout)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left"
                  >
                    <Icon size={16} className="text-white/60" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{workout.name || workout.workout_type}</span>
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        {(workout.actual_duration_minutes || workout.planned_duration_minutes) && (
                          <span className="flex items-center gap-0.5">
                            <Clock size={10} />
                            {workout.actual_duration_minutes || workout.planned_duration_minutes}m
                          </span>
                        )}
                        {workout.status === 'planned' && <span className="text-amber-400/60">Planned</span>}
                      </div>
                    </div>
                    {workout.status === 'completed' && <CheckCircle size={14} className="text-emerald-400" />}
                    <ChevronRight size={14} className="text-muted" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
