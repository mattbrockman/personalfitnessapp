'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, MessageSquare } from 'lucide-react'

interface PlanPhilosophyViewProps {
  philosophy: string
  coachingNotes: string
}

export function PlanPhilosophyView({ philosophy, coachingNotes }: PlanPhilosophyViewProps) {
  const [philosophyExpanded, setPhilosophyExpanded] = useState(true)
  const [notesExpanded, setNotesExpanded] = useState(false)

  console.log('PlanPhilosophyView render:', {
    hasPhilosophy: !!philosophy,
    philosophyLength: philosophy?.length,
    hasCoachingNotes: !!coachingNotes,
    coachingNotesLength: coachingNotes?.length,
  })

  if (!philosophy && !coachingNotes) {
    return null
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Program Philosophy */}
      {philosophy && (
        <div className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => setPhilosophyExpanded(!philosophyExpanded)}
            className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Lightbulb size={16} className="text-violet-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-sm">Program Philosophy</h3>
                <p className="text-xs text-tertiary">Dr. Galpin&apos;s approach for your goals</p>
              </div>
            </div>
            {philosophyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {philosophyExpanded && (
            <div className="px-4 py-4 border-t border-white/5">
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {philosophy}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Coaching Notes */}
      {coachingNotes && (
        <div className="glass rounded-xl overflow-hidden">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-amber-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-sm">Coaching Notes</h3>
                <p className="text-xs text-tertiary">Key focus areas and things to watch</p>
              </div>
            </div>
            {notesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {notesExpanded && (
            <div className="px-4 py-4 border-t border-white/5">
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {coachingNotes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
