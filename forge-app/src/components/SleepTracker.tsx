'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Moon,
  Sun,
  Upload,
  Camera,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Activity,
  Wind,
  Zap,
  Clock,
  Sparkles,
  Plus,
  X,
  Calendar,
  Loader2,
} from 'lucide-react'
import { format, subDays, addDays, isToday, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import JunctionConnect from './JunctionConnect'

// Types
interface SleepLog {
  id: string
  log_date: string
  bedtime?: string
  wake_time?: string
  total_sleep_minutes?: number
  time_in_bed_minutes?: number
  deep_sleep_minutes?: number
  rem_sleep_minutes?: number
  light_sleep_minutes?: number
  awake_minutes?: number
  sleep_score?: number
  hrv_avg?: number
  resting_hr?: number
  respiratory_rate?: number
  recovery_score?: number
  source: 'manual' | 'eight_sleep_screenshot' | 'apple_health' | 'whoop' | 'oura'
  screenshot_url?: string
  ai_parsed_data?: any
  notes?: string
}

// Helper functions
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

function getTrend(current: number, previous: number): 'up' | 'down' | 'same' {
  const diff = current - previous
  if (Math.abs(diff) < 2) return 'same'
  return diff > 0 ? 'up' : 'down'
}

// Sleep Score Ring
function SleepScoreRing({ score, size = 'large' }: { score: number; size?: 'small' | 'large' }) {
  const percentage = score
  const circumference = 2 * Math.PI * (size === 'large' ? 54 : 28)
  const offset = circumference - (percentage / 100) * circumference
  const isLarge = size === 'large'

  return (
    <div className={`relative ${isLarge ? 'w-32 h-32' : 'w-16 h-16'}`}>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={isLarge ? 64 : 32}
          cy={isLarge ? 64 : 32}
          r={isLarge ? 54 : 28}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={isLarge ? 8 : 4}
        />
        <circle
          cx={isLarge ? 64 : 32}
          cy={isLarge ? 64 : 32}
          r={isLarge ? 54 : 28}
          fill="none"
          stroke={score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'}
          strokeWidth={isLarge ? 8 : 4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${isLarge ? 'text-3xl' : 'text-lg'} font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        {isLarge && <span className="text-xs text-white/40">Sleep Score</span>}
      </div>
    </div>
  )
}

// Sleep Stage Bar
function SleepStageBar({ log }: { log: SleepLog }) {
  const total = (log.deep_sleep_minutes || 0) + (log.rem_sleep_minutes || 0) + 
                (log.light_sleep_minutes || 0) + (log.awake_minutes || 0)
  
  if (total === 0) return null

  const deep = ((log.deep_sleep_minutes || 0) / total) * 100
  const rem = ((log.rem_sleep_minutes || 0) / total) * 100
  const light = ((log.light_sleep_minutes || 0) / total) * 100
  const awake = ((log.awake_minutes || 0) / total) * 100

  return (
    <div className="space-y-2">
      <div className="h-4 rounded-full overflow-hidden flex">
        <div className="bg-violet-500" style={{ width: `${deep}%` }} />
        <div className="bg-sky-500" style={{ width: `${rem}%` }} />
        <div className="bg-emerald-500" style={{ width: `${light}%` }} />
        <div className="bg-white/20" style={{ width: `${awake}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-white/60">Deep {formatMinutesToTime(log.deep_sleep_minutes || 0)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-sky-500" />
          <span className="text-white/60">REM {formatMinutesToTime(log.rem_sleep_minutes || 0)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-white/60">Light {formatMinutesToTime(log.light_sleep_minutes || 0)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <span className="text-white/60">Awake {log.awake_minutes}m</span>
        </div>
      </div>
    </div>
  )
}

// Parsed sleep data with status
interface ParsedSleepItem {
  file: File
  status: 'pending' | 'parsing' | 'success' | 'error'
  data?: Partial<SleepLog>
  error?: string
  extraction_quality?: string
}

// Screenshot Upload Modal - supports batch upload
function ScreenshotUploadModal({
  onUpload,
  onClose,
}: {
  onUpload: (data: Partial<SleepLog>[]) => void
  onClose: () => void
}) {
  const [files, setFiles] = useState<ParsedSleepItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dateOverride, setDateOverride] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    // Add all files to state as pending
    const newFiles: ParsedSleepItem[] = Array.from(selectedFiles).map(file => ({
      file,
      status: 'pending' as const,
    }))

    setFiles(newFiles)
  }

  const processFiles = async () => {
    if (files.length === 0) return

    setIsProcessing(true)

    const updatedFiles = [...files]

    for (let i = 0; i < updatedFiles.length; i++) {
      setCurrentIndex(i)
      updatedFiles[i].status = 'parsing'
      setFiles([...updatedFiles])

      try {
        const formData = new FormData()
        formData.append('file', updatedFiles[i].file)
        if (dateOverride) {
          formData.append('date', dateOverride)
        }

        const response = await fetch('/api/sleep/parse-screenshot', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          updatedFiles[i].status = 'success'
          updatedFiles[i].data = result.parsed
          // Apply date override if parsed data is missing date
          if (dateOverride && !updatedFiles[i].data?.log_date) {
            updatedFiles[i].data = { ...updatedFiles[i].data, log_date: dateOverride }
          }
          updatedFiles[i].extraction_quality = result.extraction_quality
        } else {
          const errorData = await response.json()
          updatedFiles[i].status = 'error'
          updatedFiles[i].error = errorData.error || 'Failed to parse'
        }
      } catch (error) {
        updatedFiles[i].status = 'error'
        updatedFiles[i].error = 'Network error'
      }

      setFiles([...updatedFiles])
    }

    setIsProcessing(false)
  }

  const handleSaveAll = () => {
    const successfulData = files
      .filter(f => f.status === 'success' && f.data?.log_date)
      .map(f => f.data as Partial<SleepLog>)

    if (successfulData.length > 0) {
      onUpload(successfulData)
    }
    onClose()
  }

  const successCount = files.filter(f => f.status === 'success' && f.data?.log_date).length
  const errorCount = files.filter(f => f.status === 'error').length
  const allDone = files.length > 0 && files.every(f => f.status === 'success' || f.status === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 animate-slide-up max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">Upload Sleep Screenshots</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {files.length === 0 ? (
            <>
              {/* Upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500/50 transition-colors"
              >
                <Upload size={48} className="mx-auto text-white/40 mb-4" />
                <p className="font-medium">Select Eight Sleep screenshots</p>
                <p className="text-sm text-white/50 mt-1">Select multiple images at once</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="mt-4 p-3 bg-violet-500/10 rounded-lg">
                <p className="text-xs text-violet-400 flex items-center gap-2">
                  <Sparkles size={14} />
                  AI will extract: sleep score, stages, HRV, heart rate, date, and more
                </p>
              </div>

              <div className="mt-4">
                <label className="text-sm text-white/60 block mb-2">
                  Date override (optional - use if screenshots don&apos;t show date)
                </label>
                <input
                  type="date"
                  value={dateOverride}
                  onChange={(e) => setDateOverride(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
            </>
          ) : (
            <>
              {/* File list with status */}
              <div className="space-y-2 mb-4">
                {files.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg flex items-center gap-3 ${
                      item.status === 'success' ? 'bg-emerald-500/10' :
                      item.status === 'error' ? 'bg-red-500/10' :
                      item.status === 'parsing' ? 'bg-violet-500/10' :
                      'bg-white/5'
                    }`}
                  >
                    {item.status === 'pending' && <Clock size={16} className="text-white/40" />}
                    {item.status === 'parsing' && <Loader2 size={16} className="text-violet-400 animate-spin" />}
                    {item.status === 'success' && <Sparkles size={16} className="text-emerald-400" />}
                    {item.status === 'error' && <X size={16} className="text-red-400" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.file.name}</p>
                      {item.status === 'success' && item.data?.log_date && (
                        <div className="text-xs">
                          <p className="text-emerald-400">
                            {item.data.log_date} • Score: {item.data.sleep_score || 'N/A'}
                            {item.data.total_sleep_minutes && ` • ${Math.floor(item.data.total_sleep_minutes / 60)}h ${item.data.total_sleep_minutes % 60}m`}
                          </p>
                          {item.extraction_quality && (
                            <p className="text-white/40">{item.extraction_quality}</p>
                          )}
                        </div>
                      )}
                      {item.status === 'success' && !item.data?.log_date && (
                        <p className="text-xs text-amber-400">No date found in image</p>
                      )}
                      {item.status === 'error' && (
                        <p className="text-xs text-red-400">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress indicator */}
              {isProcessing && (
                <div className="mb-4">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / files.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/50 mt-1 text-center">
                    Processing {currentIndex + 1} of {files.length}...
                  </p>
                </div>
              )}

              {/* Summary */}
              {allDone && (
                <div className="p-3 bg-white/5 rounded-lg mb-4">
                  {(() => {
                    const withDates = files.filter(f => f.status === 'success' && f.data?.log_date).length
                    const noDates = files.filter(f => f.status === 'success' && !f.data?.log_date).length
                    return (
                      <div className="text-sm space-y-1">
                        <p className="text-emerald-400">{withDates} ready to save</p>
                        {noDates > 0 && <p className="text-amber-400">{noDates} missing date (won&apos;t be saved)</p>}
                        {errorCount > 0 && <p className="text-red-400">{errorCount} failed to parse</p>}
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          {files.length === 0 ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Cancel
            </button>
          ) : !allDone ? (
            <>
              <button
                onClick={() => setFiles([])}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={processFiles}
                disabled={isProcessing}
                className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Analyze {files.length} Screenshots
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFiles([])}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Upload More
              </button>
              <button
                onClick={handleSaveAll}
                disabled={successCount === 0}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Save {successCount} Entries
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Manual Entry Modal
function ManualEntryModal({
  onSave,
  onClose,
  date,
}: {
  onSave: (data: Partial<SleepLog>) => void
  onClose: () => void
  date: string
}) {
  const [formData, setFormData] = useState({
    bedtime: '22:30',
    wake_time: '06:30',
    sleep_score: '',
    hrv_avg: '',
    resting_hr: '',
    notes: '',
  })

  const handleSave = () => {
    // Calculate total sleep from times
    const [bedH, bedM] = formData.bedtime.split(':').map(Number)
    const [wakeH, wakeM] = formData.wake_time.split(':').map(Number)
    
    let totalMinutes = (wakeH * 60 + wakeM) - (bedH * 60 + bedM)
    if (totalMinutes < 0) totalMinutes += 24 * 60 // Handle overnight

    const sleepLog: Partial<SleepLog> = {
      log_date: date,
      bedtime: formData.bedtime,
      wake_time: formData.wake_time,
      total_sleep_minutes: totalMinutes - 30, // Assume ~30min to fall asleep/awake time
      time_in_bed_minutes: totalMinutes,
      sleep_score: formData.sleep_score ? parseInt(formData.sleep_score) : undefined,
      hrv_avg: formData.hrv_avg ? parseInt(formData.hrv_avg) : undefined,
      resting_hr: formData.resting_hr ? parseInt(formData.resting_hr) : undefined,
      notes: formData.notes || undefined,
      source: 'manual',
    }

    onSave(sleepLog)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">Log Sleep</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Bedtime</label>
              <input
                type="time"
                value={formData.bedtime}
                onChange={e => setFormData(prev => ({ ...prev, bedtime: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Wake Time</label>
              <input
                type="time"
                value={formData.wake_time}
                onChange={e => setFormData(prev => ({ ...prev, wake_time: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-white/60 mb-2">Sleep Score</label>
              <input
                type="number"
                value={formData.sleep_score}
                onChange={e => setFormData(prev => ({ ...prev, sleep_score: e.target.value }))}
                placeholder="0-100"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">HRV</label>
              <input
                type="number"
                value={formData.hrv_avg}
                onChange={e => setFormData(prev => ({ ...prev, hrv_avg: e.target.value }))}
                placeholder="ms"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Resting HR</label>
              <input
                type="number"
                value={formData.resting_hr}
                onChange={e => setFormData(prev => ({ ...prev, resting_hr: e.target.value }))}
                placeholder="bpm"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="How did you sleep?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// Main Sleep Tracker
export function SleepTracker() {
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Fetch sleep logs
  const fetchSleepLogs = async () => {
    try {
      const response = await fetch('/api/sleep?limit=60')
      if (response.ok) {
        const data = await response.json()
        setSleepLogs(data.sleepLogs || [])
      }
    } catch (error) {
      console.error('Error fetching sleep logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch sleep logs on mount
  useEffect(() => {
    fetchSleepLogs()
  }, [])

  // Handle sync completion
  const handleSyncComplete = (count: number) => {
    setSyncMessage(`Synced ${count} sleep records`)
    fetchSleepLogs()
    setTimeout(() => setSyncMessage(null), 3000)
  }

  // Get current week
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  // Get log for selected date
  const selectedLog = sleepLogs.find(log =>
    log.log_date === format(selectedDate, 'yyyy-MM-dd')
  )

  // Get previous log for comparison
  const previousLog = sleepLogs.find(log =>
    log.log_date === format(subDays(selectedDate, 1), 'yyyy-MM-dd')
  )

  // Calculate weekly averages
  const weeklyLogs = sleepLogs.filter(log => {
    const logDate = new Date(log.log_date)
    return logDate >= weekStart && logDate <= addDays(weekStart, 6)
  })

  const weeklyAvgScore = weeklyLogs.length > 0
    ? Math.round(weeklyLogs.reduce((sum, log) => sum + (log.sleep_score || 0), 0) / weeklyLogs.length)
    : 0

  const weeklyAvgDuration = weeklyLogs.length > 0
    ? Math.round(weeklyLogs.reduce((sum, log) => sum + (log.total_sleep_minutes || 0), 0) / weeklyLogs.length)
    : 0

  // Handle single sleep log (from manual entry)
  const handleAddSleepLog = async (data: Partial<SleepLog>) => {
    const logDate = data.log_date || format(selectedDate, 'yyyy-MM-dd')

    try {
      const response = await fetch('/api/sleep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          log_date: logDate,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const newLog = result.sleepLog

        setSleepLogs(prev => {
          // Replace if exists for this date
          const filtered = prev.filter(log => log.log_date !== newLog.log_date)
          return [...filtered, newLog].sort((a, b) =>
            new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
          )
        })
      } else {
        console.error('Failed to save sleep log')
      }
    } catch (error) {
      console.error('Error saving sleep log:', error)
    }
  }

  // Handle batch sleep logs (from screenshot upload)
  const handleBatchUpload = async (logs: Partial<SleepLog>[]) => {
    if (logs.length === 0) return

    try {
      const response = await fetch('/api/sleep/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleepLogs: logs }),
      })

      if (response.ok) {
        const result = await response.json()
        const savedLogs = result.sleepLogs || []

        setSleepLogs(prev => {
          // Merge new logs with existing, replacing duplicates by date
          const existingDates = new Set(savedLogs.map((l: SleepLog) => l.log_date))
          const filtered = prev.filter(log => !existingDates.has(log.log_date))
          return [...filtered, ...savedLogs].sort((a, b) =>
            new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
          )
        })
      } else {
        console.error('Failed to save batch sleep logs')
      }
    } catch (error) {
      console.error('Error saving batch sleep logs:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-amber-500 mb-2" />
          <p className="text-white/50">Loading sleep data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Sleep</h1>
          <p className="text-white/50">Track your recovery</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Upload size={18} />
            Screenshot
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Manual
          </button>
        </div>
      </div>

      {/* Eight Sleep Connection */}
      <div className="mb-6">
        <JunctionConnect
          provider="eight_sleep"
          providerName="Eight Sleep"
          onSync={handleSyncComplete}
          showSyncButton={true}
        />
        {syncMessage && (
          <div className="mt-2 p-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm text-center">
            {syncMessage}
          </div>
        )}
      </div>

      {/* Week selector */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 7))}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayLog = sleepLogs.find(log => log.log_date === format(day, 'yyyy-MM-dd'))
            const isSelected = isSameDay(day, selectedDate)

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`p-2 rounded-lg text-center transition-colors ${
                  isSelected 
                    ? 'bg-amber-500 text-black' 
                    : 'hover:bg-white/10'
                }`}
              >
                <p className="text-xs text-white/40 mb-1">
                  {format(day, 'EEE')}
                </p>
                <p className={`text-lg font-medium ${isSelected ? '' : isToday(day) ? 'text-amber-400' : ''}`}>
                  {format(day, 'd')}
                </p>
                {dayLog?.sleep_score && (
                  <div className={`mt-1 text-xs ${isSelected ? 'text-black/70' : getScoreColor(dayLog.sleep_score)}`}>
                    {dayLog.sleep_score}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedLog ? (
        <div className="space-y-4">
          {/* Main stats card */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-6">
              <SleepScoreRing score={selectedLog.sleep_score || 0} />
              
              <div className="flex-1 space-y-3">
                {/* Duration */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-white/40" />
                    <span className="text-white/60">Total Sleep</span>
                  </div>
                  <span className="font-medium">
                    {formatMinutesToTime(selectedLog.total_sleep_minutes || 0)}
                  </span>
                </div>

                {/* Bedtime/Wake */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon size={16} className="text-violet-400" />
                    <span className="text-white/60">Bedtime</span>
                  </div>
                  <span className="font-medium">{selectedLog.bedtime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun size={16} className="text-amber-400" />
                    <span className="text-white/60">Wake</span>
                  </div>
                  <span className="font-medium">{selectedLog.wake_time}</span>
                </div>
              </div>
            </div>

            {/* Sleep stages */}
            {(selectedLog.deep_sleep_minutes || selectedLog.rem_sleep_minutes) && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="text-sm text-white/60 mb-3">Sleep Stages</h4>
                <SleepStageBar log={selectedLog} />
              </div>
            )}
          </div>

          {/* Vitals card */}
          <div className="grid grid-cols-3 gap-4">
            {/* HRV */}
            {selectedLog.hrv_avg && (
              <div className="glass rounded-xl p-4 text-center">
                <Activity size={20} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-2xl font-bold">{selectedLog.hrv_avg}</p>
                <p className="text-xs text-white/40">HRV (ms)</p>
                {previousLog?.hrv_avg && (
                  <div className={`mt-1 text-xs flex items-center justify-center gap-1 ${
                    getTrend(selectedLog.hrv_avg, previousLog.hrv_avg) === 'up' ? 'text-emerald-400' :
                    getTrend(selectedLog.hrv_avg, previousLog.hrv_avg) === 'down' ? 'text-red-400' :
                    'text-white/40'
                  }`}>
                    {getTrend(selectedLog.hrv_avg, previousLog.hrv_avg) === 'up' && <TrendingUp size={12} />}
                    {getTrend(selectedLog.hrv_avg, previousLog.hrv_avg) === 'down' && <TrendingDown size={12} />}
                    {getTrend(selectedLog.hrv_avg, previousLog.hrv_avg) === 'same' && <Minus size={12} />}
                    vs yesterday
                  </div>
                )}
              </div>
            )}

            {/* Resting HR */}
            {selectedLog.resting_hr && (
              <div className="glass rounded-xl p-4 text-center">
                <Heart size={20} className="mx-auto text-red-400 mb-2" />
                <p className="text-2xl font-bold">{selectedLog.resting_hr}</p>
                <p className="text-xs text-white/40">Resting HR</p>
                {previousLog?.resting_hr && (
                  <div className={`mt-1 text-xs flex items-center justify-center gap-1 ${
                    getTrend(previousLog.resting_hr, selectedLog.resting_hr) === 'up' ? 'text-emerald-400' :
                    getTrend(previousLog.resting_hr, selectedLog.resting_hr) === 'down' ? 'text-red-400' :
                    'text-white/40'
                  }`}>
                    {/* Lower HR is better */}
                    {getTrend(previousLog.resting_hr, selectedLog.resting_hr) === 'up' && <TrendingDown size={12} />}
                    {getTrend(previousLog.resting_hr, selectedLog.resting_hr) === 'down' && <TrendingUp size={12} />}
                    {getTrend(previousLog.resting_hr, selectedLog.resting_hr) === 'same' && <Minus size={12} />}
                    vs yesterday
                  </div>
                )}
              </div>
            )}

            {/* Recovery */}
            {selectedLog.recovery_score && (
              <div className="glass rounded-xl p-4 text-center">
                <Zap size={20} className="mx-auto text-amber-400 mb-2" />
                <p className={`text-2xl font-bold ${getScoreColor(selectedLog.recovery_score)}`}>
                  {selectedLog.recovery_score}%
                </p>
                <p className="text-xs text-white/40">Recovery</p>
              </div>
            )}
          </div>

          {/* Source badge */}
          <div className="text-center">
            <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-white/40">
              Source: {selectedLog.source.replace('_', ' ')}
            </span>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-8 text-center">
          <Moon size={48} className="mx-auto text-white/20 mb-4" />
          <p className="text-white/40">No sleep data for this date</p>
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              <Upload size={16} />
              Upload Screenshot
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              <Plus size={16} />
              Log Manually
            </button>
          </div>
        </div>
      )}

      {/* Weekly summary */}
      <div className="glass rounded-xl p-4 mt-6">
        <h3 className="font-medium mb-3">Weekly Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{weeklyAvgScore}</p>
            <p className="text-xs text-white/40">Avg Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatMinutesToTime(weeklyAvgDuration)}</p>
            <p className="text-xs text-white/40">Avg Duration</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{weeklyLogs.length}/7</p>
            <p className="text-xs text-white/40">Nights Logged</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <ScreenshotUploadModal
          onUpload={handleBatchUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {showManualModal && (
        <ManualEntryModal
          date={format(selectedDate, 'yyyy-MM-dd')}
          onSave={handleAddSleepLog}
          onClose={() => setShowManualModal(false)}
        />
      )}
    </div>
  )
}
