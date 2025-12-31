'use client'

import { useState, useEffect } from 'react'
import { Tempo, GalpinAdaptation, DEFAULT_TEMPOS } from '@/types/galpin'
import { parseTempo, formatTempo, calculateTUT } from '@/lib/galpin-calculations'

interface TempoInputProps {
  value: string | null
  onChange: (tempo: string) => void
  reps?: number
  adaptation?: GalpinAdaptation
  compact?: boolean
  className?: string
}

export function TempoInput({
  value,
  onChange,
  reps = 10,
  adaptation,
  compact = false,
  className = '',
}: TempoInputProps) {
  const parsed = parseTempo(value)
  const [eccentric, setEccentric] = useState(parsed?.eccentric ?? 2)
  const [pauseBottom, setPauseBottom] = useState(parsed?.pauseBottom ?? 0)
  const [concentric, setConcentric] = useState(parsed?.concentric ?? 1)
  const [pauseTop, setPauseTop] = useState(parsed?.pauseTop ?? 0)
  const [isExplosive, setIsExplosive] = useState(parsed?.concentric === 0.5)

  useEffect(() => {
    const newTempo = formatTempo({
      eccentric,
      pauseBottom,
      concentric: isExplosive ? 0.5 : concentric,
      pauseTop,
    })
    onChange(newTempo)
  }, [eccentric, pauseBottom, concentric, pauseTop, isExplosive, onChange])

  const tut = calculateTUT(value, reps)

  const setRecommendedTempo = () => {
    if (adaptation) {
      const recommended = DEFAULT_TEMPOS[adaptation]
      const parsed = parseTempo(recommended)
      if (parsed) {
        setEccentric(parsed.eccentric)
        setPauseBottom(parsed.pauseBottom)
        setIsExplosive(parsed.concentric === 0.5)
        setConcentric(parsed.concentric === 0.5 ? 1 : parsed.concentric)
        setPauseTop(parsed.pauseTop)
      }
    }
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          type="text"
          value={value || '2-0-1-0'}
          onChange={(e) => onChange(e.target.value)}
          placeholder="2-0-1-0"
          className="w-24 bg-gray-700 rounded px-2 py-1 text-sm text-white text-center"
        />
        <span className="text-xs text-gray-400">{tut.perSet}s TUT</span>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-white">Tempo</h4>
        <span className="text-sm text-gray-400">
          {value || '2-0-1-0'} ({tut.perRep}s/rep)
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <label className="block text-xs text-gray-400 mb-1">Down</label>
          <input
            type="number"
            min="0"
            max="10"
            value={eccentric}
            onChange={(e) => setEccentric(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-700 rounded px-2 py-1 text-white text-center"
          />
        </div>
        <div className="text-center">
          <label className="block text-xs text-gray-400 mb-1">Pause</label>
          <input
            type="number"
            min="0"
            max="5"
            value={pauseBottom}
            onChange={(e) => setPauseBottom(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-700 rounded px-2 py-1 text-white text-center"
          />
        </div>
        <div className="text-center">
          <label className="block text-xs text-gray-400 mb-1">Up</label>
          {isExplosive ? (
            <div className="w-full bg-blue-600 rounded px-2 py-1 text-white text-center text-sm">
              X
            </div>
          ) : (
            <input
              type="number"
              min="1"
              max="10"
              value={concentric}
              onChange={(e) => setConcentric(parseInt(e.target.value) || 1)}
              className="w-full bg-gray-700 rounded px-2 py-1 text-white text-center"
            />
          )}
        </div>
        <div className="text-center">
          <label className="block text-xs text-gray-400 mb-1">Pause</label>
          <input
            type="number"
            min="0"
            max="5"
            value={pauseTop}
            onChange={(e) => setPauseTop(parseInt(e.target.value) || 0)}
            className="w-full bg-gray-700 rounded px-2 py-1 text-white text-center"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={isExplosive}
            onChange={(e) => setIsExplosive(e.target.checked)}
            className="rounded bg-gray-700"
          />
          Explosive concentric
        </label>

        {adaptation && (
          <button
            onClick={setRecommendedTempo}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Use recommended
          </button>
        )}
      </div>

      <div className="mt-3 p-2 bg-gray-700 rounded">
        <div className="text-xs text-gray-400">
          Time Under Tension: <span className="text-white">{tut.perSet}s per set</span>
          {reps && <span className="text-gray-500"> ({reps} reps)</span>}
        </div>
      </div>
    </div>
  )
}
