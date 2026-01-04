// ZWO File Generator
// Converts Forge cardio_structure to Zwift Workout (ZWO) XML format
// Reference: https://github.com/h4l/zwift-workout-file-reference

import { CardioStructure, PrimaryIntensity, SuggestedWorkout } from '@/types/training-plan'

// ============================================================================
// Zone to FTP% Mapping
// ============================================================================

/**
 * Map intensity zones to FTP percentage (as decimal)
 * Based on standard 5-zone power model
 */
export const ZONE_TO_FTP: Record<PrimaryIntensity, number> = {
  z1: 0.50,   // Recovery: 0-55% FTP
  z2: 0.65,   // Endurance: 56-75% FTP
  z3: 0.82,   // Tempo: 76-87% FTP
  z4: 0.92,   // Threshold: 88-95% FTP
  z5: 1.00,   // VO2max: 96-105% FTP
  hit: 1.20,  // Anaerobic: 106-150% FTP
  mixed: 0.75, // Mixed intensity - use mid-range
}

/**
 * Zone power range for display purposes
 */
export const ZONE_POWER_RANGES: Record<PrimaryIntensity, { low: number; high: number }> = {
  z1: { low: 0.40, high: 0.55 },
  z2: { low: 0.56, high: 0.75 },
  z3: { low: 0.76, high: 0.87 },
  z4: { low: 0.88, high: 0.95 },
  z5: { low: 0.96, high: 1.05 },
  hit: { low: 1.06, high: 1.50 },
  mixed: { low: 0.60, high: 0.90 },
}

// ============================================================================
// XML Helpers
// ============================================================================

/**
 * Escape special characters for XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format duration in seconds to ZWO duration format
 * ZWO uses seconds as integers
 */
function formatDuration(minutes: number): number {
  return Math.round(minutes * 60)
}

// ============================================================================
// ZWO Segment Generators
// ============================================================================

interface ZwoSegment {
  type: 'Warmup' | 'Cooldown' | 'SteadyState' | 'IntervalsT' | 'Ramp' | 'FreeRide'
  xml: string
}

/**
 * Generate warmup segment (ramping from low to target power)
 */
function generateWarmup(durationMinutes: number, targetZone: PrimaryIntensity = 'z2'): ZwoSegment {
  const duration = formatDuration(durationMinutes)
  const targetPower = ZONE_TO_FTP[targetZone]

  return {
    type: 'Warmup',
    xml: `    <Warmup Duration="${duration}" PowerLow="0.40" PowerHigh="${targetPower.toFixed(2)}"/>`,
  }
}

/**
 * Generate cooldown segment (ramping from power down to recovery)
 */
function generateCooldown(durationMinutes: number, startZone: PrimaryIntensity = 'z2'): ZwoSegment {
  const duration = formatDuration(durationMinutes)
  const startPower = ZONE_TO_FTP[startZone]

  return {
    type: 'Cooldown',
    xml: `    <Cooldown Duration="${duration}" PowerLow="${startPower.toFixed(2)}" PowerHigh="0.40"/>`,
  }
}

/**
 * Generate steady-state effort at fixed power
 */
function generateSteadyState(durationMinutes: number, zone: PrimaryIntensity): ZwoSegment {
  const duration = formatDuration(durationMinutes)
  const power = ZONE_TO_FTP[zone]

  return {
    type: 'SteadyState',
    xml: `    <SteadyState Duration="${duration}" Power="${power.toFixed(2)}"/>`,
  }
}

/**
 * Generate interval set with work/rest periods
 */
function generateIntervals(
  repeats: number,
  onDurationMinutes: number,
  onZone: PrimaryIntensity,
  offDurationMinutes: number = 1,
  offZone: PrimaryIntensity = 'z1'
): ZwoSegment {
  const onDuration = formatDuration(onDurationMinutes)
  const offDuration = formatDuration(offDurationMinutes)
  const onPower = ZONE_TO_FTP[onZone]
  const offPower = ZONE_TO_FTP[offZone]

  return {
    type: 'IntervalsT',
    xml: `    <IntervalsT Repeat="${repeats}" OnDuration="${onDuration}" OnPower="${onPower.toFixed(2)}" OffDuration="${offDuration}" OffPower="${offPower.toFixed(2)}"/>`,
  }
}

/**
 * Generate ramp (progressive increase/decrease in power)
 */
function generateRamp(
  durationMinutes: number,
  startZone: PrimaryIntensity,
  endZone: PrimaryIntensity
): ZwoSegment {
  const duration = formatDuration(durationMinutes)
  const startPower = ZONE_TO_FTP[startZone]
  const endPower = ZONE_TO_FTP[endZone]

  return {
    type: 'Ramp',
    xml: `    <Ramp Duration="${duration}" PowerLow="${startPower.toFixed(2)}" PowerHigh="${endPower.toFixed(2)}"/>`,
  }
}

/**
 * Generate free ride segment (unstructured, ride at will)
 */
function generateFreeRide(durationMinutes: number): ZwoSegment {
  const duration = formatDuration(durationMinutes)

  return {
    type: 'FreeRide',
    xml: `    <FreeRide Duration="${duration}"/>`,
  }
}

// ============================================================================
// Main Generator Functions
// ============================================================================

/**
 * Convert CardioStructure to ZWO segments
 */
function convertCardioStructureToSegments(structure: CardioStructure): ZwoSegment[] {
  const segments: ZwoSegment[] = []

  // Warmup
  if (structure.warmup_minutes > 0) {
    // Determine target zone from first main set interval
    const firstInterval = structure.main_set[0]
    const targetZone = firstInterval?.intensity || 'z2'
    segments.push(generateWarmup(structure.warmup_minutes, targetZone))
  }

  // Main set
  for (const interval of structure.main_set) {
    const repeats = interval.repeats || 1

    if (repeats > 1) {
      // Interval set with rest periods
      // Estimate rest duration based on intensity
      const restMinutes = interval.intensity === 'hit'
        ? interval.duration_minutes * 2  // Longer rest for VO2max+ efforts
        : interval.intensity === 'z5'
          ? interval.duration_minutes * 1.5
          : interval.duration_minutes * 0.5  // Shorter rest for tempo/threshold

      segments.push(generateIntervals(
        repeats,
        interval.duration_minutes,
        interval.intensity,
        Math.max(0.5, Math.min(5, restMinutes)),  // Clamp rest to 30s - 5min
        'z1'
      ))
    } else {
      // Single effort
      if (interval.intensity === 'mixed') {
        // For mixed intensity, use a ramp or steady state at mid power
        segments.push(generateSteadyState(interval.duration_minutes, 'mixed'))
      } else {
        segments.push(generateSteadyState(interval.duration_minutes, interval.intensity))
      }
    }
  }

  // Cooldown
  if (structure.cooldown_minutes > 0) {
    // Determine starting zone from last main set interval
    const lastInterval = structure.main_set[structure.main_set.length - 1]
    const startZone = lastInterval?.intensity || 'z2'
    segments.push(generateCooldown(structure.cooldown_minutes, startZone))
  }

  return segments
}

/**
 * Generate complete ZWO XML from segments
 */
function generateZwoXml(
  name: string,
  description: string,
  segments: ZwoSegment[],
  sportType: 'bike' | 'run' = 'bike'
): string {
  const segmentXml = segments.map(s => s.xml).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>Forge Training</author>
  <name>${escapeXml(name)}</name>
  <description>${escapeXml(description || '')}</description>
  <sportType>${sportType}</sportType>
  <tags/>
  <workout>
${segmentXml}
  </workout>
</workout_file>`
}

// ============================================================================
// Public API
// ============================================================================

export interface ZwoGeneratorResult {
  xml: string
  filename: string
  totalDurationMinutes: number
  segments: number
}

/**
 * Generate ZWO workout file from a suggested workout
 */
export function generateZwoFromWorkout(workout: SuggestedWorkout): ZwoGeneratorResult {
  if (!workout.cardio_structure) {
    throw new Error('Workout has no cardio structure')
  }

  const structure = workout.cardio_structure as CardioStructure
  const segments = convertCardioStructureToSegments(structure)

  // Calculate total duration
  const totalDuration = structure.warmup_minutes +
    structure.main_set.reduce((sum, interval) => {
      const repeats = interval.repeats || 1
      const restPerInterval = repeats > 1 ? Math.min(5, interval.duration_minutes * 0.5) : 0
      return sum + (interval.duration_minutes * repeats) + (restPerInterval * (repeats - 1))
    }, 0) +
    structure.cooldown_minutes

  const description = workout.description ||
    `${workout.name} - ${structure.type} workout`

  const xml = generateZwoXml(
    workout.name,
    description,
    segments,
    workout.workout_type === 'run' ? 'run' : 'bike'
  )

  // Clean filename
  const cleanName = workout.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  return {
    xml,
    filename: `forge_${workout.id}_${cleanName}.zwo`,
    totalDurationMinutes: Math.round(totalDuration),
    segments: segments.length,
  }
}

/**
 * Generate ZWO from raw CardioStructure (for previews/testing)
 */
export function generateZwoFromStructure(
  name: string,
  description: string,
  structure: CardioStructure,
  sportType: 'bike' | 'run' = 'bike'
): string {
  const segments = convertCardioStructureToSegments(structure)
  return generateZwoXml(name, description, segments, sportType)
}

/**
 * Convert ZWO XML to base64 for Intervals.icu upload
 */
export function zwoToBase64(zwoXml: string): string {
  // Use Buffer in Node.js, btoa in browser
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(zwoXml, 'utf-8').toString('base64')
  }
  return btoa(encodeURIComponent(zwoXml).replace(/%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16))))
}

/**
 * Validate that a workout has valid cardio structure for ZWO generation
 */
export function canGenerateZwo(workout: SuggestedWorkout): boolean {
  if (!workout.cardio_structure) return false

  const structure = workout.cardio_structure as CardioStructure

  // Must have at least one main set interval
  if (!structure.main_set || structure.main_set.length === 0) return false

  // Validate each interval has required fields
  for (const interval of structure.main_set) {
    if (!interval.duration_minutes || interval.duration_minutes <= 0) return false
    if (!interval.intensity) return false
  }

  return true
}
