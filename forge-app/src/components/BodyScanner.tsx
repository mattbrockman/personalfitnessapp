'use client'

import { useState, useRef } from 'react'
import {
  Camera,
  X,
  Check,
  AlertCircle,
  Sparkles,
  User,
  Scale,
  Ruler,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RotateCcw,
  Save,
  Info,
  Loader2,
} from 'lucide-react'

interface VisualAnalysis {
  body_type: string
  visible_muscle_definition: string
  estimated_body_fat_range: { min: number; max: number }
  waist_to_hip_ratio_estimate: string
  shoulder_to_waist_ratio: string
  confidence: number
  notes: string
}

interface ScanResult {
  body_fat_pct: number
  body_fat_range: { min: number; max: number }
  lean_mass_lbs: number
  fat_mass_lbs: number
  ffmi: number | null
  confidence: 'high' | 'medium' | 'low'
  confidence_factors: string[]
  visual_analysis: VisualAnalysis
  data_sources: string[]
  recommendation: string
}

type ScanStep = 'instructions' | 'capture' | 'analyzing' | 'results'

const POSE_INSTRUCTIONS = [
  'Stand with arms slightly away from body',
  'Wear minimal, form-fitting clothing',
  'Good lighting (natural light is best)',
  'Plain background if possible',
  'Include full body from head to feet',
  'Take front view (and optionally side view)',
]

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[confidence]}`}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
    </span>
  )
}

function DataSourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    photo_analysis: 'Photo Analysis',
    weight: 'Current Weight',
    height: 'Height',
    strength_data: 'Strength Data',
    dexa_calibration: 'DEXA Calibration',
  }

  return (
    <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
      {labels[source] || source}
    </span>
  )
}

export function BodyScanner() {
  const [step, setStep] = useState<ScanStep>('instructions')
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null)
  const [sidePhoto, setSidePhoto] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [sidePreview, setSidePreview] = useState<string | null>(null)
  const [sex, setSex] = useState<'male' | 'female' | null>(null)
  const [manualWeight, setManualWeight] = useState<string>('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const frontInputRef = useRef<HTMLInputElement>(null)
  const sideInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'front' | 'side'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      if (type === 'front') {
        setFrontPhoto(file)
        setFrontPreview(event.target?.result as string)
      } else {
        setSidePhoto(file)
        setSidePreview(event.target?.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    if (!frontPhoto) return

    setStep('analyzing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('front_photo', frontPhoto)
      if (sidePhoto) {
        formData.append('side_photo', sidePhoto)
      }
      if (sex) {
        formData.append('sex', sex)
      }
      if (manualWeight) {
        formData.append('weight_lbs', manualWeight)
      }

      const response = await fetch('/api/body-composition/scan', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze')
      }

      const data = await response.json()
      setResult(data.result)
      setStep('results')
    } catch (err: any) {
      setError(err.message || 'Failed to analyze photos')
      setStep('capture')
    }
  }

  const handleSave = async () => {
    if (!result) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: new Date().toISOString().split('T')[0],
          body_fat_pct: result.body_fat_pct,
          lean_mass_lbs: result.lean_mass_lbs,
          weight_lbs: result.lean_mass_lbs + result.fat_mass_lbs,
          ffmi: result.ffmi,
          source: 'photo_scan',
          notes: `AI scan - ${result.confidence} confidence. Range: ${result.body_fat_range.min}-${result.body_fat_range.max}%`,
        }),
      })

      if (response.ok) {
        setSaved(true)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const reset = () => {
    setStep('instructions')
    setFrontPhoto(null)
    setSidePhoto(null)
    setFrontPreview(null)
    setSidePreview(null)
    setResult(null)
    setError(null)
    setSaved(false)
  }

  return (
    <div className="p-4 lg:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Body Scan</h1>
          <p className="text-white/50">AI-powered body composition analysis</p>
        </div>
        {step !== 'instructions' && (
          <button
            onClick={reset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RotateCcw size={20} />
          </button>
        )}
      </div>

      {/* Instructions Step */}
      {step === 'instructions' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Camera size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="font-semibold">Photo Guidelines</h2>
                <p className="text-sm text-white/50">For best results</p>
              </div>
            </div>

            <ul className="space-y-3">
              {POSE_INSTRUCTIONS.map((instruction, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">{i + 1}</span>
                  </div>
                  <span className="text-white/80">{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Activity size={20} className="text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold">How It Works</h2>
                <p className="text-sm text-white/50">Multi-factor analysis</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-white/70">
              <p>
                Our AI analyzes your photos along with your profile data (height,
                weight, age) and recent strength numbers to estimate body composition.
              </p>
              <p>
                If you have a previous DEXA scan logged, the AI will use it to
                calibrate estimates for higher accuracy.
              </p>
              <p className="text-amber-400/80">
                Accuracy: ~3-5% (similar to consumer bioimpedance scales)
              </p>
            </div>
          </div>

          <button
            onClick={() => setStep('capture')}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Start Scan
          </button>
        </div>
      )}

      {/* Capture Step */}
      {step === 'capture' && (
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} className="text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Front Photo */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <User size={18} />
              Front View <span className="text-amber-400">*</span>
            </h3>

            {frontPreview ? (
              <div className="relative">
                <img
                  src={frontPreview}
                  alt="Front"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setFrontPhoto(null)
                    setFrontPreview(null)
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => frontInputRef.current?.click()}
                className="h-64 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/50 transition-colors"
              >
                <Camera size={40} className="text-white/30 mb-2" />
                <p className="text-white/50">Tap to capture front view</p>
              </div>
            )}

            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoSelect(e, 'front')}
              className="hidden"
            />
          </div>

          {/* Side Photo (Optional) */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <User size={18} className="rotate-90" />
              Side View <span className="text-white/40">(Optional)</span>
            </h3>

            {sidePreview ? (
              <div className="relative">
                <img
                  src={sidePreview}
                  alt="Side"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setSidePhoto(null)
                    setSidePreview(null)
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => sideInputRef.current?.click()}
                className="h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
              >
                <p className="text-white/40 text-sm">Add side view for better accuracy</p>
              </div>
            )}

            <input
              ref={sideInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoSelect(e, 'side')}
              className="hidden"
            />
          </div>

          {/* Additional Info */}
          <div className="glass rounded-xl p-4 space-y-4">
            <h3 className="font-medium">Additional Info (Optional)</h3>

            <div>
              <label className="text-sm text-white/60 block mb-2">Sex</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSex('male')}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    sex === 'male'
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  Male
                </button>
                <button
                  onClick={() => setSex('female')}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    sex === 'female'
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-white/60 block mb-2">
                Current Weight (lbs)
              </label>
              <input
                type="number"
                value={manualWeight}
                onChange={(e) => setManualWeight(e.target.value)}
                placeholder="Leave blank to use recent log"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!frontPhoto}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            Analyze Photos
          </button>
        </div>
      )}

      {/* Analyzing Step */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6 animate-pulse">
            <Sparkles size={40} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Analyzing...</h2>
          <p className="text-white/50 text-center max-w-sm">
            AI is evaluating body composition from your photos combined with your
            profile data
          </p>
        </div>
      )}

      {/* Results Step */}
      {step === 'results' && result && (
        <div className="space-y-6">
          {/* Main Result Card */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Body Composition Estimate</h2>
              <ConfidenceBadge confidence={result.confidence} />
            </div>

            {/* Body Fat */}
            <div className="text-center py-6">
              <p className="text-5xl font-bold text-amber-400">
                {result.body_fat_pct}%
              </p>
              <p className="text-white/50 mt-1">Body Fat</p>
              <p className="text-sm text-white/40 mt-2">
                Range: {result.body_fat_range.min}% - {result.body_fat_range.max}%
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-white/5 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {result.lean_mass_lbs}
                </p>
                <p className="text-sm text-white/50">Lean Mass (lbs)</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-400">
                  {result.fat_mass_lbs}
                </p>
                <p className="text-sm text-white/50">Fat Mass (lbs)</p>
              </div>
              {result.ffmi && (
                <div className="col-span-2 p-4 bg-white/5 rounded-lg text-center">
                  <p className="text-2xl font-bold text-violet-400">{result.ffmi}</p>
                  <p className="text-sm text-white/50">FFMI (Fat-Free Mass Index)</p>
                  <p className="text-xs text-white/30 mt-1">
                    {result.ffmi < 18
                      ? 'Below average'
                      : result.ffmi < 20
                      ? 'Average'
                      : result.ffmi < 22
                      ? 'Above average'
                      : result.ffmi < 25
                      ? 'Excellent'
                      : 'Elite (natural limit ~25)'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Data Sources */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Activity size={18} />
              Data Sources Used
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.data_sources.map((source) => (
                <DataSourceBadge key={source} source={source} />
              ))}
            </div>
          </div>

          {/* Confidence Factors */}
          {result.confidence_factors.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Info size={18} />
                Analysis Notes
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                {result.confidence_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Visual Analysis Details */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-medium mb-3">Visual Assessment</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-white/50">Body Type</p>
                <p className="font-medium capitalize">
                  {result.visual_analysis.body_type}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-white/50">Definition</p>
                <p className="font-medium capitalize">
                  {result.visual_analysis.visible_muscle_definition.replace('_', ' ')}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-white/50">Waist-Hip Ratio</p>
                <p className="font-medium capitalize">
                  {result.visual_analysis.waist_to_hip_ratio_estimate}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-white/50">V-Taper</p>
                <p className="font-medium capitalize">
                  {result.visual_analysis.shoulder_to_waist_ratio}
                </p>
              </div>
            </div>
            {result.visual_analysis.notes && (
              <p className="mt-3 text-sm text-white/50 italic">
                "{result.visual_analysis.notes}"
              </p>
            )}
          </div>

          {/* Recommendation */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-sm text-amber-400">{result.recommendation}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              New Scan
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || saved}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : saved ? (
                <Check size={18} />
              ) : (
                <Save size={18} />
              )}
              {saved ? 'Saved!' : 'Save Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
