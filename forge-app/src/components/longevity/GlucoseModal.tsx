'use client'

import { useState, useRef } from 'react'
import {
  X,
  Activity,
  Loader2,
  Upload,
  Plus,
  Info,
} from 'lucide-react'
import { CGMReading, MealContext, CGMSource } from '@/types/longevity'
import { format, parseISO, subDays } from 'date-fns'

interface GlucoseModalProps {
  recentReadings?: CGMReading[]
  onClose: () => void
  onSave: () => void
}

const MEAL_CONTEXTS: { value: MealContext; label: string }[] = [
  { value: 'fasting', label: 'Fasting (8+ hours)' },
  { value: 'pre_meal', label: 'Pre-meal' },
  { value: 'post_meal_1hr', label: 'Post-meal (1 hr)' },
  { value: 'post_meal_2hr', label: 'Post-meal (2 hr)' },
  { value: 'exercise', label: 'During/after exercise' },
  { value: 'sleep', label: 'Sleep/overnight' },
]

export function GlucoseModal({
  recentReadings = [],
  onClose,
  onSave,
}: GlucoseModalProps) {
  const [activeTab, setActiveTab] = useState<'readings' | 'log' | 'import'>('readings')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual entry state
  const [glucose, setGlucose] = useState('')
  const [mealContext, setMealContext] = useState<MealContext>('fasting')
  const [notes, setNotes] = useState('')

  // Import state
  const [importSource, setImportSource] = useState<CGMSource>('levels')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState<string>('')

  // Calculate stats
  const last7Days = recentReadings.filter(
    r => parseISO(r.reading_time) >= subDays(new Date(), 7)
  )
  const avgGlucose = last7Days.length > 0
    ? Math.round(last7Days.reduce((sum, r) => sum + r.glucose_mg_dl, 0) / last7Days.length)
    : null

  const handleManualSubmit = async () => {
    if (!glucose) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/cgm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reading_time: new Date().toISOString(),
          glucose_mg_dl: parseInt(glucose),
          source: 'manual',
          meal_context: mealContext,
          notes: notes || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to save')

      onSave()
    } catch (error) {
      console.error('Error saving glucose reading:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
    }
  }

  const handleImport = async () => {
    if (!importFile) return

    setIsSubmitting(true)
    setImportStatus('Reading file...')

    try {
      const text = await importFile.text()
      const lines = text.split('\n')
      const readings: Partial<CGMReading>[] = []

      // Parse based on source format
      // Levels Health CSV format: timestamp, glucose, ...
      // Dexcom CSV format: similar
      // Libre CSV: similar

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(',')
        if (parts.length >= 2) {
          const timestamp = parts[0]?.trim()
          const glucoseVal = parseInt(parts[1]?.trim() || '')

          if (timestamp && !isNaN(glucoseVal) && glucoseVal > 0 && glucoseVal < 500) {
            readings.push({
              reading_time: new Date(timestamp).toISOString(),
              glucose_mg_dl: glucoseVal,
              source: importSource,
            })
          }
        }
      }

      if (readings.length === 0) {
        setImportStatus('No valid readings found in file')
        return
      }

      setImportStatus(`Importing ${readings.length} readings...`)

      // Batch import
      const response = await fetch('/api/cgm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readings),
      })

      if (!response.ok) throw new Error('Import failed')

      const result = await response.json()
      setImportStatus(`Successfully imported ${result.count} readings!`)

      setTimeout(() => onSave(), 1500)
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus('Import failed. Check file format.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getGlucoseColor = (value: number) => {
    if (value < 70) return 'text-amber-400'
    if (value <= 99) return 'text-green-400'
    if (value <= 140) return 'text-blue-400'
    if (value <= 180) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Activity size={20} className="text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold">Glucose Tracking</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'readings', label: 'Readings' },
            { id: 'log', label: 'Log' },
            { id: 'import', label: 'Import CGM' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'readings' | 'log' | 'import')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-tertiary hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'readings' && (
            <div className="space-y-4">
              {/* Stats summary */}
              {avgGlucose && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <h4 className="text-sm font-medium text-white/60 mb-3">7-Day Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="text-secondary text-xs">Average</span>
                      <p className={`text-xl font-bold ${getGlucoseColor(avgGlucose)}`}>{avgGlucose}</p>
                    </div>
                    <div>
                      <span className="text-secondary text-xs">Readings</span>
                      <p className="text-xl font-bold">{last7Days.length}</p>
                    </div>
                    <div>
                      <span className="text-secondary text-xs">In Range</span>
                      <p className="text-xl font-bold text-green-400">
                        {Math.round((last7Days.filter(r => r.glucose_mg_dl >= 70 && r.glucose_mg_dl <= 140).length / last7Days.length) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference ranges */}
              <div className="p-3 bg-white/5 rounded-lg text-xs">
                <h4 className="font-medium mb-2">Target Ranges</h4>
                <div className="grid grid-cols-2 gap-2 text-white/60">
                  <div><span className="text-green-400">Fasting:</span> 70-99 mg/dL</div>
                  <div><span className="text-blue-400">Post-meal:</span> &lt;140 mg/dL</div>
                  <div><span className="text-green-400">Optimal avg:</span> 70-90 mg/dL</div>
                  <div><span className="text-amber-400">Pre-diabetic:</span> 100-125</div>
                </div>
              </div>

              {/* Recent readings */}
              {recentReadings.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Recent Readings</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {recentReadings.slice(0, 20).map((reading, i) => (
                      <div
                        key={reading.id || i}
                        className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${getGlucoseColor(reading.glucose_mg_dl)}`}>
                            {reading.glucose_mg_dl}
                          </span>
                          <div className="text-xs text-secondary">
                            <p>{format(parseISO(reading.reading_time), 'MMM d, h:mm a')}</p>
                            {reading.meal_context && (
                              <p className="text-muted">{reading.meal_context.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted">{reading.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-secondary">
                  <Activity size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No glucose readings yet</p>
                  <p className="text-sm">Log manually or import from CGM</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                <Info size={14} className="inline mr-1 text-blue-400" />
                Log single glucose readings from a glucometer or CGM.
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                  placeholder="e.g., 95"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Context</label>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_CONTEXTS.map(ctx => (
                    <button
                      key={ctx.value}
                      onClick={() => setMealContext(ctx.value)}
                      className={`p-2 rounded-lg text-left text-sm transition-colors ${
                        mealContext === ctx.value
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      {ctx.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What you ate, how you feel, etc."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {glucose && (
                <div className={`p-3 rounded-lg ${
                  parseInt(glucose) >= 70 && parseInt(glucose) <= 99
                    ? 'bg-green-500/10 text-green-400'
                    : parseInt(glucose) >= 100 && parseInt(glucose) <= 140
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {parseInt(glucose) < 70 ? 'Low - consider eating something' :
                   parseInt(glucose) <= 99 ? 'Excellent - optimal range!' :
                   parseInt(glucose) <= 140 ? 'Normal range' :
                   parseInt(glucose) <= 180 ? 'Elevated - monitor closely' :
                   'High - consult your doctor'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-white/70">
                <Info size={14} className="inline mr-1 text-blue-400" />
                Import CGM data from Levels, Dexcom, or Libre. Export as CSV from your app.
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">CGM Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['levels', 'dexcom', 'libre'] as CGMSource[]).map(src => (
                    <button
                      key={src}
                      onClick={() => setImportSource(src)}
                      className={`p-2 rounded-lg text-sm capitalize transition-colors ${
                        importSource === src
                          ? 'bg-amber-500/20 border border-amber-500/30'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">CSV File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-white/20 rounded-lg hover:border-amber-500/50 transition-colors"
                >
                  <Upload size={24} className="mx-auto mb-2 text-secondary" />
                  <p className="text-sm text-white/60">
                    {importFile ? importFile.name : 'Click to select CSV file'}
                  </p>
                </button>
              </div>

              {importStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  importStatus.includes('Success') ? 'bg-green-500/10 text-green-400' :
                  importStatus.includes('failed') ? 'bg-red-500/10 text-red-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  {importStatus}
                </div>
              )}

              <div className="p-3 bg-white/5 rounded-lg text-xs text-tertiary">
                <p className="font-medium mb-1">Expected CSV format:</p>
                <p>timestamp, glucose_mg_dl, ...</p>
                <p className="mt-1">Example: 2024-01-15T08:30:00, 95</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(activeTab === 'log' || activeTab === 'import') && (
          <div className="p-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={activeTab === 'log' ? handleManualSubmit : handleImport}
              disabled={(activeTab === 'log' && !glucose) || (activeTab === 'import' && !importFile) || isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {activeTab === 'import' ? 'Importing...' : 'Saving...'}
                </>
              ) : (
                <>
                  {activeTab === 'import' ? <Upload size={16} /> : <Plus size={16} />}
                  {activeTab === 'import' ? 'Import Data' : 'Save Reading'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
