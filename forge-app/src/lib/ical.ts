// iCal generation utilities for calendar feed

export interface CalendarEvent {
  uid: string
  title: string
  start: Date
  end?: Date
  allDay?: boolean
  description?: string
  location?: string
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

// Emoji prefixes by workout/event type
export const WORKOUT_EMOJI: Record<string, string> = {
  bike: '🚴',
  ride: '🚴',
  cycling: '🚴',
  run: '🏃',
  running: '🏃',
  swim: '🏊',
  swimming: '🏊',
  strength: '🏋️',
  upper: '🏋️',
  lower: '🏋️',
  full_body: '🏋️',
  lifting: '🏋️',
  yoga: '🧘',
  class: '🏃',
  other: '💪',
}

export const EVENT_EMOJI: Record<string, string> = {
  race: '🏁',
  competition: '🏆',
  vacation: '✈️',
  travel: '✈️',
  deload: '😴',
  test: '📊',
  milestone: '🎯',
}

/**
 * Format a date for iCal (all-day event)
 * Format: YYYYMMDD
 */
export function formatICalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Format a datetime for iCal
 * Format: YYYYMMDDTHHMMSS (local time)
 */
export function formatICalDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

/**
 * Escape text for iCal format
 * - Escape backslashes, semicolons, commas
 * - Convert newlines to \n
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Fold long lines per iCal spec (max 75 chars per line)
 */
function foldLine(line: string): string {
  const maxLength = 75
  if (line.length <= maxLength) return line

  const result: string[] = []
  let remaining = line

  // First line can be full length
  result.push(remaining.slice(0, maxLength))
  remaining = remaining.slice(maxLength)

  // Continuation lines start with a space
  while (remaining.length > 0) {
    result.push(' ' + remaining.slice(0, maxLength - 1))
    remaining = remaining.slice(maxLength - 1)
  }

  return result.join('\r\n')
}

/**
 * Generate a VEVENT block
 */
export function generateVEvent(event: CalendarEvent): string {
  const lines: string[] = []

  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${event.uid}`)

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(event.start)}`)
    if (event.end) {
      // All-day events: end date is exclusive, add 1 day
      const endDate = new Date(event.end)
      endDate.setDate(endDate.getDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${formatICalDate(endDate)}`)
    }
  } else {
    lines.push(`DTSTART:${formatICalDateTime(event.start)}`)
    if (event.end) {
      lines.push(`DTEND:${formatICalDateTime(event.end)}`)
    }
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`)

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`)
  }

  // Always show as "free" (transparent)
  lines.push('TRANSP:TRANSPARENT')

  lines.push(`STATUS:${event.status || 'CONFIRMED'}`)

  // Add timestamp
  lines.push(`DTSTAMP:${formatICalDateTime(new Date())}`)

  lines.push('END:VEVENT')

  return lines.map(foldLine).join('\r\n')
}

/**
 * Generate a complete VCALENDAR
 */
export function generateVCalendar(
  events: CalendarEvent[],
  calendarName: string = 'FORGE Training'
): string {
  const lines: string[] = []

  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//FORGE//Training Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${escapeICalText(calendarName)}`)

  // Add all events
  for (const event of events) {
    lines.push(generateVEvent(event))
  }

  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Get emoji prefix for a workout type
 */
export function getWorkoutEmoji(workoutType: string): string {
  const type = workoutType.toLowerCase()
  return WORKOUT_EMOJI[type] || '💪'
}

/**
 * Get emoji prefix for an event type
 */
export function getEventEmoji(eventType: string): string {
  const type = eventType.toLowerCase()
  return EVENT_EMOJI[type] || '📅'
}

/**
 * Parse a time string (HH:MM:SS or HH:MM) and apply to a date
 */
export function applyTimeToDate(date: Date, timeStr: string | null): Date {
  const result = new Date(date)

  if (timeStr) {
    const parts = timeStr.split(':')
    const hours = parseInt(parts[0], 10) || 0
    const minutes = parseInt(parts[1], 10) || 0
    result.setHours(hours, minutes, 0, 0)
  } else {
    // Default to 7:00 AM if no time specified
    result.setHours(7, 0, 0, 0)
  }

  return result
}

/**
 * Calculate end time based on start and duration in minutes
 */
export function calculateEndTime(start: Date, durationMinutes: number): Date {
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + durationMinutes)
  return end
}
