// Personal Record Detection System
// Detects PRs for weight, reps, volume, and estimated 1RM

import { calculate1RM } from './strength-calculations'

export type PRType = 'weight' | 'reps' | 'volume' | 'e1rm'

export interface PRResult {
  type: PRType
  exerciseId: string
  exerciseName: string
  previousValue: number
  newValue: number
  improvementPercent: number
  weight?: number
  reps?: number
}

export interface ExerciseBests {
  maxWeight: number | null
  maxReps: number | null
  maxVolume: number | null
  best1RM: number | null
  // Track max reps at each weight for rep PRs
  maxRepsAtWeight: Record<number, number>
}

/**
 * Detect all PR types for a completed set
 */
export function detectPRs(
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number,
  previousBests: ExerciseBests
): PRResult[] {
  const prs: PRResult[] = []

  if (weight <= 0 || reps <= 0) return prs

  // Calculate current values
  const volume = weight * reps
  const { estimated1RM } = calculate1RM(weight, reps)

  // 1. Weight PR - highest weight ever used (with at least 1 rep)
  if (previousBests.maxWeight !== null && weight > previousBests.maxWeight) {
    prs.push({
      type: 'weight',
      exerciseId,
      exerciseName,
      previousValue: previousBests.maxWeight,
      newValue: weight,
      improvementPercent: ((weight - previousBests.maxWeight) / previousBests.maxWeight) * 100,
      weight,
      reps,
    })
  } else if (previousBests.maxWeight === null && weight > 0) {
    // First time doing this exercise - still a PR!
    prs.push({
      type: 'weight',
      exerciseId,
      exerciseName,
      previousValue: 0,
      newValue: weight,
      improvementPercent: 100,
      weight,
      reps,
    })
  }

  // 2. Rep PR at this weight - most reps ever done at this specific weight
  const roundedWeight = Math.round(weight / 2.5) * 2.5 // Round to nearest 2.5
  const previousRepsAtWeight = previousBests.maxRepsAtWeight[roundedWeight]
  if (previousRepsAtWeight !== undefined && reps > previousRepsAtWeight) {
    prs.push({
      type: 'reps',
      exerciseId,
      exerciseName,
      previousValue: previousRepsAtWeight,
      newValue: reps,
      improvementPercent: ((reps - previousRepsAtWeight) / previousRepsAtWeight) * 100,
      weight,
      reps,
    })
  }

  // 3. Volume PR - highest single-set volume (weight × reps)
  if (previousBests.maxVolume !== null && volume > previousBests.maxVolume) {
    prs.push({
      type: 'volume',
      exerciseId,
      exerciseName,
      previousValue: previousBests.maxVolume,
      newValue: volume,
      improvementPercent: ((volume - previousBests.maxVolume) / previousBests.maxVolume) * 100,
      weight,
      reps,
    })
  }

  // 4. Estimated 1RM PR - highest calculated 1RM
  if (previousBests.best1RM !== null && estimated1RM > previousBests.best1RM) {
    prs.push({
      type: 'e1rm',
      exerciseId,
      exerciseName,
      previousValue: previousBests.best1RM,
      newValue: estimated1RM,
      improvementPercent: ((estimated1RM - previousBests.best1RM) / previousBests.best1RM) * 100,
      weight,
      reps,
    })
  } else if (previousBests.best1RM === null && estimated1RM > 0) {
    // First estimated 1RM
    prs.push({
      type: 'e1rm',
      exerciseId,
      exerciseName,
      previousValue: 0,
      newValue: estimated1RM,
      improvementPercent: 100,
      weight,
      reps,
    })
  }

  return prs
}

/**
 * Get the most significant PR from a list (prioritize 1RM > weight > reps > volume)
 */
export function getMostSignificantPR(prs: PRResult[]): PRResult | null {
  if (prs.length === 0) return null

  // Priority order: e1rm > weight > reps > volume
  const priority: PRType[] = ['e1rm', 'weight', 'reps', 'volume']

  for (const type of priority) {
    const pr = prs.find(p => p.type === type)
    if (pr) return pr
  }

  return prs[0]
}

/**
 * Format PR for display
 */
export function formatPRMessage(pr: PRResult): string {
  const improvement = pr.improvementPercent > 0
    ? ` (+${pr.improvementPercent.toFixed(1)}%)`
    : ''

  switch (pr.type) {
    case 'weight':
      return `Weight PR! ${pr.newValue} lbs${improvement}`
    case 'reps':
      return `Rep PR! ${pr.newValue} reps @ ${pr.weight} lbs${improvement}`
    case 'volume':
      return `Volume PR! ${pr.newValue.toLocaleString()} lbs${improvement}`
    case 'e1rm':
      return `New Estimated 1RM! ${pr.newValue.toFixed(1)} lbs${improvement}`
    default:
      return `Personal Record!${improvement}`
  }
}

/**
 * Get PR type display name
 */
export function getPRTypeName(type: PRType): string {
  switch (type) {
    case 'weight': return 'Weight PR'
    case 'reps': return 'Rep PR'
    case 'volume': return 'Volume PR'
    case 'e1rm': return '1RM PR'
    default: return 'PR'
  }
}

/**
 * Parse exercise history to build bests map
 */
export function buildExerciseBests(history: {
  sets: Array<{
    actual_weight_lbs?: number | null
    actual_reps?: number | null
    completed?: boolean
  }>
}[]): ExerciseBests {
  const bests: ExerciseBests = {
    maxWeight: null,
    maxReps: null,
    maxVolume: null,
    best1RM: null,
    maxRepsAtWeight: {},
  }

  for (const session of history) {
    for (const set of session.sets) {
      if (!set.completed) continue

      const weight = set.actual_weight_lbs ?? 0
      const reps = set.actual_reps ?? 0

      if (weight <= 0 || reps <= 0) continue

      // Update max weight
      if (bests.maxWeight === null || weight > bests.maxWeight) {
        bests.maxWeight = weight
      }

      // Update max reps (overall)
      if (bests.maxReps === null || reps > bests.maxReps) {
        bests.maxReps = reps
      }

      // Update max volume
      const volume = weight * reps
      if (bests.maxVolume === null || volume > bests.maxVolume) {
        bests.maxVolume = volume
      }

      // Update best 1RM
      const { estimated1RM } = calculate1RM(weight, reps)
      if (bests.best1RM === null || estimated1RM > bests.best1RM) {
        bests.best1RM = estimated1RM
      }

      // Update max reps at this weight
      const roundedWeight = Math.round(weight / 2.5) * 2.5
      const currentMax = bests.maxRepsAtWeight[roundedWeight] ?? 0
      if (reps > currentMax) {
        bests.maxRepsAtWeight[roundedWeight] = reps
      }
    }
  }

  return bests
}
