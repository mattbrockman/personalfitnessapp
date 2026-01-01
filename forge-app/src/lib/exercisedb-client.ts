/**
 * ExerciseDB API Client
 *
 * Provides interface to fetch exercises from ExerciseDB API (RapidAPI)
 * https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb
 */

export interface ExerciseDBExercise {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  secondaryMuscles: string[]
  gifUrl: string
  instructions: string[]
}

export interface ExerciseDBConfig {
  apiKey: string
  apiHost?: string
  rateLimitMs?: number
}

// Equipment we want to include (common gym equipment)
export const INCLUDED_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'body weight',
  'leverage machine',
  'smith machine',
  'kettlebell',
  'ez barbell',
  'olympic barbell',
  'trap bar',
  'resistance band',
  'medicine ball',
  'stability ball',
  'bosu ball',
  'weighted',
  'assisted',
  'band',
  'rope',
  'wheel roller',
]

// Body parts from ExerciseDB
export const BODY_PARTS = [
  'back',
  'cardio',
  'chest',
  'lower arms',
  'lower legs',
  'neck',
  'shoulders',
  'upper arms',
  'upper legs',
  'waist',
]

// Muscle name normalization map (ExerciseDB -> FORGE)
export const MUSCLE_MAP: Record<string, string> = {
  // Upper body
  'pectorals': 'chest',
  'lats': 'lats',
  'traps': 'traps',
  'upper back': 'upper_back',
  'spine': 'lower_back',
  'levator scapulae': 'traps',

  // Shoulders
  'delts': 'front_delts',
  'anterior deltoid': 'front_delts',
  'lateral deltoid': 'side_delts',
  'posterior deltoid': 'rear_delts',
  'serratus anterior': 'serratus',

  // Arms
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearms': 'forearms',
  'brachialis': 'brachialis',

  // Core
  'abs': 'core',
  'abdominals': 'core',
  'obliques': 'obliques',

  // Lower body
  'quads': 'quads',
  'quadriceps': 'quads',
  'hamstrings': 'hamstrings',
  'glutes': 'glutes',
  'calves': 'calves',
  'adductors': 'adductors',
  'abductors': 'abductors',
  'hip flexors': 'hip_flexors',

  // Default - keep as-is if not mapped
}

// Equipment normalization map
export const EQUIPMENT_MAP: Record<string, string> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbells',
  'cable': 'cable',
  'body weight': 'bodyweight',
  'leverage machine': 'machine',
  'smith machine': 'smith_machine',
  'kettlebell': 'kettlebell',
  'ez barbell': 'ez_bar',
  'olympic barbell': 'barbell',
  'trap bar': 'trap_bar',
  'resistance band': 'bands',
  'band': 'bands',
  'medicine ball': 'medicine_ball',
  'stability ball': 'stability_ball',
  'bosu ball': 'bosu_ball',
  'weighted': 'weighted',
  'assisted': 'assisted',
  'rope': 'cable',
  'wheel roller': 'ab_wheel',
}

export class ExerciseDBClient {
  private apiKey: string
  private apiHost: string
  private rateLimitMs: number
  private lastRequestTime: number = 0

  constructor(config: ExerciseDBConfig) {
    this.apiKey = config.apiKey
    this.apiHost = config.apiHost || 'exercisedb.p.rapidapi.com'
    this.rateLimitMs = config.rateLimitMs || 100
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitMs - timeSinceLastRequest))
    }
    this.lastRequestTime = Date.now()
  }

  private async fetch(endpoint: string): Promise<any> {
    await this.rateLimit()

    const response = await fetch(`https://${this.apiHost}${endpoint}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost,
      },
    })

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Fetch all exercises (paginated)
   */
  async getAllExercises(limit: number = 1500, offset: number = 0): Promise<ExerciseDBExercise[]> {
    return this.fetch(`/exercises?limit=${limit}&offset=${offset}`)
  }

  /**
   * Fetch exercises by body part
   */
  async getByBodyPart(bodyPart: string, limit: number = 200): Promise<ExerciseDBExercise[]> {
    return this.fetch(`/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}`)
  }

  /**
   * Fetch exercises by equipment
   */
  async getByEquipment(equipment: string, limit: number = 200): Promise<ExerciseDBExercise[]> {
    return this.fetch(`/exercises/equipment/${encodeURIComponent(equipment)}?limit=${limit}`)
  }

  /**
   * Fetch exercises by target muscle
   */
  async getByTarget(target: string, limit: number = 200): Promise<ExerciseDBExercise[]> {
    return this.fetch(`/exercises/target/${encodeURIComponent(target)}?limit=${limit}`)
  }

  /**
   * Get list of all body parts
   */
  async getBodyPartList(): Promise<string[]> {
    return this.fetch('/exercises/bodyPartList')
  }

  /**
   * Get list of all equipment types
   */
  async getEquipmentList(): Promise<string[]> {
    return this.fetch('/exercises/equipmentList')
  }

  /**
   * Get list of all target muscles
   */
  async getTargetList(): Promise<string[]> {
    return this.fetch('/exercises/targetList')
  }

  /**
   * Search exercises by name
   */
  async searchByName(name: string, limit: number = 100): Promise<ExerciseDBExercise[]> {
    return this.fetch(`/exercises/name/${encodeURIComponent(name)}?limit=${limit}`)
  }
}

/**
 * Normalize muscle name from ExerciseDB to FORGE format
 */
export function normalizeMuscle(muscle: string): string {
  const normalized = muscle.toLowerCase().trim()
  return MUSCLE_MAP[normalized] || normalized.replace(/\s+/g, '_')
}

/**
 * Normalize equipment name from ExerciseDB to FORGE format
 */
export function normalizeEquipment(equipment: string): string {
  const normalized = equipment.toLowerCase().trim()
  return EQUIPMENT_MAP[normalized] || normalized.replace(/\s+/g, '_')
}

/**
 * Check if exercise uses included equipment
 */
export function isEquipmentIncluded(equipment: string): boolean {
  const normalized = equipment.toLowerCase().trim()
  return INCLUDED_EQUIPMENT.some(e => normalized.includes(e) || e.includes(normalized))
}

/**
 * Transform ExerciseDB exercise to FORGE format
 */
export function transformExercise(exercise: ExerciseDBExercise): {
  external_id: string
  external_source: string
  name: string
  description: string | null
  instructions: string
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string
  body_part: string
  video_url: string
  thumbnail_url: string
} {
  return {
    external_id: exercise.id,
    external_source: 'exercisedb',
    name: titleCase(exercise.name),
    description: null, // Will be enhanced by AI
    instructions: exercise.instructions.join(' '),
    primary_muscle: normalizeMuscle(exercise.target),
    secondary_muscles: exercise.secondaryMuscles.map(m => normalizeMuscle(m)),
    equipment: normalizeEquipment(exercise.equipment),
    body_part: exercise.bodyPart,
    video_url: exercise.gifUrl,
    thumbnail_url: exercise.gifUrl, // Same as GIF for now
  }
}

/**
 * Convert string to title case
 */
function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
