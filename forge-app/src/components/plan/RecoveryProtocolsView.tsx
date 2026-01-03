'use client'

import { useState } from 'react'
import { RecoveryProtocols, PainManagementProtocol } from '@/types/training-plan'
import { Moon, Utensils, Activity, AlertTriangle, Check } from 'lucide-react'

interface RecoveryProtocolsViewProps {
  protocols: RecoveryProtocols | null
  className?: string
}

type TabType = 'sleep' | 'nutrition' | 'mobility' | 'pain'

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  hasContent
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  hasContent: boolean
}) {
  if (!hasContent) return null

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-amber-500/20 text-amber-400'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function RecommendationList({ recommendations }: { recommendations: string[] }) {
  return (
    <ul className="space-y-2">
      {recommendations.map((rec, idx) => (
        <li key={idx} className="flex items-start gap-2">
          <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-white/80">{rec}</span>
        </li>
      ))}
    </ul>
  )
}

function SleepTab({ sleep }: { sleep: RecoveryProtocols['sleep'] }) {
  if (!sleep) return null

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white/60">Target Sleep</span>
          <span className="text-2xl font-bold text-amber-400">{sleep.target_hours}h</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
            style={{ width: `${(sleep.target_hours / 10) * 100}%` }}
          />
        </div>
      </div>

      {sleep.recommendations && sleep.recommendations.length > 0 && (
        <div>
          <p className="text-xs text-secondary mb-3">Sleep Optimization Tips</p>
          <RecommendationList recommendations={sleep.recommendations} />
        </div>
      )}
    </div>
  )
}

function NutritionTab({ nutrition }: { nutrition: RecoveryProtocols['nutrition'] }) {
  if (!nutrition) return null

  return (
    <div className="space-y-4">
      {nutrition.protein_g_per_lb && (
        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Protein Target</span>
            <span className="text-xl font-bold text-amber-400">
              {nutrition.protein_g_per_lb}g/lb
            </span>
          </div>
          <p className="text-xs text-secondary">bodyweight daily</p>
        </div>
      )}

      {nutrition.carb_timing && (
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-secondary mb-1">Carb Timing</p>
          <p className="text-sm text-white/80">{nutrition.carb_timing}</p>
        </div>
      )}

      {nutrition.recommendations && nutrition.recommendations.length > 0 && (
        <div>
          <p className="text-xs text-secondary mb-3">Nutrition Guidelines</p>
          <RecommendationList recommendations={nutrition.recommendations} />
        </div>
      )}
    </div>
  )
}

function MobilityTab({ mobility }: { mobility: RecoveryProtocols['mobility'] }) {
  if (!mobility) return null

  return (
    <div className="space-y-4">
      {mobility.daily_minutes && (
        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Daily Mobility</span>
            <span className="text-xl font-bold text-amber-400">
              {mobility.daily_minutes} min
            </span>
          </div>
        </div>
      )}

      {mobility.focus_areas && mobility.focus_areas.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-secondary mb-2">Focus Areas</p>
          <div className="flex flex-wrap gap-2">
            {mobility.focus_areas.map((area, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {mobility.recommendations && mobility.recommendations.length > 0 && (
        <div>
          <p className="text-xs text-secondary mb-3">Mobility Recommendations</p>
          <RecommendationList recommendations={mobility.recommendations} />
        </div>
      )}
    </div>
  )
}

function PainManagementTab({ painManagement }: { painManagement: Record<string, PainManagementProtocol> | undefined }) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)

  if (!painManagement || Object.keys(painManagement).length === 0) return null

  const areas = Object.keys(painManagement)

  // Auto-select first area if none selected
  const currentArea = selectedArea || areas[0]
  const protocol = painManagement[currentArea]

  return (
    <div className="space-y-4">
      {/* Area selector */}
      <div className="flex flex-wrap gap-2">
        {areas.map(area => (
          <button
            key={area}
            onClick={() => setSelectedArea(area)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              currentArea === area
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {area.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {protocol && (
        <div className="space-y-4">
          {protocol.morning_routine && protocol.morning_routine.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-secondary mb-2">Morning Routine</p>
              <ul className="space-y-1">
                {protocol.morning_routine.map((item, idx) => (
                  <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-green-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {protocol.pre_workout && protocol.pre_workout.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-secondary mb-2">Pre-Workout</p>
              <ul className="space-y-1">
                {protocol.pre_workout.map((item, idx) => (
                  <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {protocol.avoid && protocol.avoid.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Avoid
              </p>
              <ul className="space-y-1">
                {protocol.avoid.map((item, idx) => (
                  <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-red-400">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {protocol.modifications && protocol.modifications.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-secondary mb-2">Modifications</p>
              <ul className="space-y-1">
                {protocol.modifications.map((item, idx) => (
                  <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-blue-400">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function RecoveryProtocolsView({ protocols, className = '' }: RecoveryProtocolsViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('sleep')

  if (!protocols) return null

  const hasSleep = !!protocols.sleep
  const hasNutrition = !!protocols.nutrition
  const hasMobility = !!protocols.mobility
  const hasPain = !!(protocols.pain_management && Object.keys(protocols.pain_management).length > 0)

  if (!hasSleep && !hasNutrition && !hasMobility && !hasPain) return null

  // Auto-select first available tab
  const effectiveTab = (
    (activeTab === 'sleep' && !hasSleep) ||
    (activeTab === 'nutrition' && !hasNutrition) ||
    (activeTab === 'mobility' && !hasMobility) ||
    (activeTab === 'pain' && !hasPain)
  ) ? (hasSleep ? 'sleep' : hasNutrition ? 'nutrition' : hasMobility ? 'mobility' : 'pain') : activeTab

  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/5">
        <h3 className="font-semibold">Recovery Protocols</h3>
        <p className="text-xs text-tertiary mt-1">Personalized recovery guidance for optimal adaptation</p>
      </div>

      {/* Tabs */}
      <div className="p-2 flex gap-1 border-b border-white/5 overflow-x-auto">
        <TabButton
          active={effectiveTab === 'sleep'}
          onClick={() => setActiveTab('sleep')}
          icon={Moon}
          label="Sleep"
          hasContent={hasSleep}
        />
        <TabButton
          active={effectiveTab === 'nutrition'}
          onClick={() => setActiveTab('nutrition')}
          icon={Utensils}
          label="Nutrition"
          hasContent={hasNutrition}
        />
        <TabButton
          active={effectiveTab === 'mobility'}
          onClick={() => setActiveTab('mobility')}
          icon={Activity}
          label="Mobility"
          hasContent={hasMobility}
        />
        <TabButton
          active={effectiveTab === 'pain'}
          onClick={() => setActiveTab('pain')}
          icon={AlertTriangle}
          label="Pain Management"
          hasContent={hasPain}
        />
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {effectiveTab === 'sleep' && <SleepTab sleep={protocols.sleep} />}
        {effectiveTab === 'nutrition' && <NutritionTab nutrition={protocols.nutrition} />}
        {effectiveTab === 'mobility' && <MobilityTab mobility={protocols.mobility} />}
        {effectiveTab === 'pain' && <PainManagementTab painManagement={protocols.pain_management} />}
      </div>
    </div>
  )
}
