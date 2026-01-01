import {
  Dumbbell,
  Circle,
  Waves,
  CircleDot,
  Disc,
  Settings,
  type LucideIcon,
} from 'lucide-react'

/**
 * Equipment type to icon mapping
 * Extended set: barbell, dumbbell, bodyweight, cable, kettlebell, bands, medicine_ball, machine
 */
const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  // Barbell variants
  barbell: Dumbbell,
  olympic_barbell: Dumbbell,
  ez_bar: Dumbbell,
  trap_bar: Dumbbell,
  smith_machine: Dumbbell,

  // Dumbbell variants
  dumbbell: Dumbbell,
  dumbbells: Dumbbell,

  // Bodyweight
  bodyweight: Circle,
  body_weight: Circle,
  assisted: Circle,

  // Cable variants
  cable: Waves,
  rope: Waves,

  // Kettlebell
  kettlebell: CircleDot,

  // Resistance bands
  bands: Waves,
  resistance_band: Waves,
  band: Waves,

  // Medicine ball
  medicine_ball: Disc,
  stability_ball: Disc,
  bosu_ball: Disc,

  // Machine variants
  machine: Settings,
  leverage_machine: Settings,
  weighted: Settings,

  // Fallback
  default: Dumbbell,
}

/**
 * Equipment type to color class mapping
 * Each equipment type has a distinct color for visual differentiation
 */
const EQUIPMENT_COLORS: Record<string, string> = {
  // Barbell - amber (gold/strong)
  barbell: 'text-amber-400',
  olympic_barbell: 'text-amber-400',
  ez_bar: 'text-amber-400',
  trap_bar: 'text-amber-400',
  smith_machine: 'text-amber-400',

  // Dumbbell - violet (standard)
  dumbbell: 'text-violet-400',
  dumbbells: 'text-violet-400',

  // Bodyweight - emerald (natural)
  bodyweight: 'text-emerald-400',
  body_weight: 'text-emerald-400',
  assisted: 'text-emerald-400',

  // Cable - blue (fluid motion)
  cable: 'text-blue-400',
  rope: 'text-blue-400',

  // Kettlebell - orange (distinctive)
  kettlebell: 'text-orange-400',

  // Bands - pink (stretchy)
  bands: 'text-pink-400',
  resistance_band: 'text-pink-400',
  band: 'text-pink-400',

  // Medicine ball - red (power)
  medicine_ball: 'text-red-400',
  stability_ball: 'text-red-400',
  bosu_ball: 'text-red-400',

  // Machine - slate (mechanical)
  machine: 'text-slate-400',
  leverage_machine: 'text-slate-400',
  weighted: 'text-slate-400',

  // Fallback
  default: 'text-violet-400',
}

/**
 * Normalize equipment string to match our lookup keys
 */
function normalizeEquipment(equipment: string | undefined | null): string {
  if (!equipment) return 'default'
  return equipment.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

/**
 * Get the appropriate icon for an equipment type
 */
export function getEquipmentIcon(equipment: string | undefined | null): LucideIcon {
  const normalized = normalizeEquipment(equipment)
  return EQUIPMENT_ICONS[normalized] || EQUIPMENT_ICONS.default
}

/**
 * Get the color class for an equipment type
 */
export function getEquipmentColor(equipment: string | undefined | null): string {
  const normalized = normalizeEquipment(equipment)
  return EQUIPMENT_COLORS[normalized] || EQUIPMENT_COLORS.default
}

/**
 * Combined component for rendering equipment icon with appropriate color
 */
export function EquipmentIcon({
  equipment,
  size = 18,
  className = '',
}: {
  equipment: string | undefined | null
  size?: number
  className?: string
}) {
  const Icon = getEquipmentIcon(equipment)
  const color = getEquipmentColor(equipment)
  return <Icon size={size} className={`${color} ${className}`} />
}
