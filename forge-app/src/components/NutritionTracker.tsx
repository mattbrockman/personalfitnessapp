'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Camera,
  Plus,
  Search,
  X,
  ChevronRight,
  Utensils,
  Coffee,
  Sun,
  Moon,
  Sparkles,
  Upload,
  Trash2,
  Edit2,
  Check,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Apple,
  Clock,
  Loader2,
} from 'lucide-react'

// Types
interface FoodItem {
  id: string
  name: string
  brand?: string
  servings: number
  serving_unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sodium_mg?: number
  source: 'manual' | 'photo_ai' | 'barcode' | 'database' | 'favorite'
  confidence?: number
}

interface DetectedFood {
  food_name: string
  portion_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  confidence: number
}

interface Meal {
  id: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  time?: string
  name?: string
  foods: FoodItem[]
  photo_url?: string
  ai_estimation?: any
}

interface NutritionTargets {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

// Constants
const MEAL_ICONS = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
}

const MEAL_COLORS = {
  breakfast: 'bg-amber-500/20 text-amber-400',
  lunch: 'bg-emerald-500/20 text-emerald-400',
  dinner: 'bg-violet-500/20 text-violet-400',
  snack: 'bg-sky-500/20 text-sky-400',
}

// Mock favorites
const FAVORITE_FOODS: FoodItem[] = [
  { id: 'fav1', name: 'Chicken Breast', brand: 'Generic', servings: 1, serving_unit: '6oz', calories: 280, protein_g: 52, carbs_g: 0, fat_g: 6, source: 'favorite' },
  { id: 'fav2', name: 'Greek Yogurt', brand: 'Fage 0%', servings: 1, serving_unit: 'container', calories: 90, protein_g: 18, carbs_g: 5, fat_g: 0, source: 'favorite' },
  { id: 'fav3', name: 'Oatmeal', brand: 'Quaker', servings: 1, serving_unit: 'cup dry', calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3, fiber_g: 4, source: 'favorite' },
  { id: 'fav4', name: 'Eggs', brand: 'Generic', servings: 2, serving_unit: 'large', calories: 140, protein_g: 12, carbs_g: 0, fat_g: 10, source: 'favorite' },
  { id: 'fav5', name: 'Protein Shake', brand: 'Optimum Nutrition', servings: 1, serving_unit: 'scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, source: 'favorite' },
  { id: 'fav6', name: 'Rice', brand: 'Jasmine', servings: 1, serving_unit: 'cup cooked', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0, source: 'favorite' },
  { id: 'fav7', name: 'Salmon', brand: 'Wild Caught', servings: 1, serving_unit: '6oz', calories: 350, protein_g: 34, carbs_g: 0, fat_g: 22, source: 'favorite' },
  { id: 'fav8', name: 'Avocado', brand: 'Generic', servings: 1, serving_unit: 'medium', calories: 240, protein_g: 3, carbs_g: 12, fat_g: 22, fiber_g: 10, source: 'favorite' },
]

// Macro Ring Component
function MacroRing({ 
  current, 
  target, 
  color, 
  label 
}: { 
  current: number
  target: number
  color: string
  label: string 
}) {
  const percentage = Math.min((current / target) * 100, 100)
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{current}</span>
          <span className="text-xs text-secondary">/{target}g</span>
        </div>
      </div>
      <span className="mt-1 text-xs text-white/60">{label}</span>
    </div>
  )
}

// Photo Capture Modal with AI Analysis
function PhotoCaptureModal({
  mealType,
  onCapture,
  onClose,
}: {
  mealType: string
  onCapture: (foods: FoodItem[]) => void
  onClose: () => void
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedFoods, setDetectedFoods] = useState<DetectedFood[] | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsAnalyzing(true)

    // Show preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Send to API
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('meal_type', mealType)

      const response = await fetch('/api/nutrition/analyze-photo', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze photo')
      }

      const data = await response.json()
      setDetectedFoods(data.analysis.detected_foods)
    } catch (err: any) {
      setError(err.message || 'Failed to analyze photo. Please try again.')
      setPhotoPreview(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleConfirm = () => {
    if (!detectedFoods) return

    const foods: FoodItem[] = detectedFoods.map((food, index) => ({
      id: `food-${Date.now()}-${index}`,
      name: food.food_name,
      servings: 1,
      serving_unit: food.portion_size,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
      source: 'photo_ai' as const,
      confidence: food.confidence,
    }))

    onCapture(foods)
  }

  const handleRemoveFood = (index: number) => {
    if (!detectedFoods) return
    setDetectedFoods(detectedFoods.filter((_, i) => i !== index))
  }

  const totalCalories = detectedFoods?.reduce((sum, f) => sum + f.calories, 0) || 0
  const totalProtein = detectedFoods?.reduce((sum, f) => sum + f.protein_g, 0) || 0
  const totalCarbs = detectedFoods?.reduce((sum, f) => sum + f.carbs_g, 0) || 0
  const totalFat = detectedFoods?.reduce((sum, f) => sum + f.fat_g, 0) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">
            {detectedFoods ? 'Review Detected Foods' : 'Log Food with Photo'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Photo Preview */}
          {photoPreview && (
            <div className="mb-4">
              <img
                src={photoPreview}
                alt="Food"
                className="w-full h-40 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Analyzing State */}
          {isAnalyzing && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                <Sparkles size={32} className="text-amber-500" />
              </div>
              <p className="font-medium">Analyzing your food...</p>
              <p className="text-sm text-tertiary mt-1">AI is identifying ingredients and estimating nutrition</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-4">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  fileInputRef.current?.click()
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-medium"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Detected Foods Review */}
          {detectedFoods && detectedFoods.length > 0 && (
            <div className="space-y-3">
              {detectedFoods.map((food, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{food.food_name}</p>
                      <p className="text-sm text-tertiary">{food.portion_size}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFood(index)}
                      className="p-1 hover:bg-white/10 rounded text-secondary hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-3 text-sm">
                    <span className="text-amber-400">{food.calories} cal</span>
                    <span className="text-red-400">{food.protein_g}p</span>
                    <span className="text-green-400">{food.carbs_g}c</span>
                    <span className="text-yellow-400">{food.fat_g}f</span>
                  </div>
                  <div className="mt-1">
                    <div className="flex items-center gap-1 text-xs text-secondary">
                      <span>Confidence:</span>
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${food.confidence >= 80 ? 'bg-emerald-500' : food.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${food.confidence}%` }}
                        />
                      </div>
                      <span>{food.confidence}%</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <p className="text-sm font-medium text-amber-400 mb-1">Total</p>
                <div className="flex gap-4 text-sm">
                  <span>{totalCalories} cal</span>
                  <span>{Math.round(totalProtein)}p</span>
                  <span>{Math.round(totalCarbs)}c</span>
                  <span>{Math.round(totalFat)}f</span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirm}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Add {detectedFoods.length} Item{detectedFoods.length > 1 ? 's' : ''} to {mealType}
              </button>
            </div>
          )}

          {/* Empty Detected Foods */}
          {detectedFoods && detectedFoods.length === 0 && (
            <div className="text-center py-4">
              <p className="text-tertiary mb-4">No foods detected in the image</p>
              <button
                onClick={() => {
                  setDetectedFoods(null)
                  setPhotoPreview(null)
                  fileInputRef.current?.click()
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-medium"
              >
                Try Another Photo
              </button>
            </div>
          )}

          {/* Initial Upload State */}
          {!isAnalyzing && !error && !detectedFoods && !photoPreview && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
              >
                <Camera size={48} className="mx-auto text-secondary mb-4" />
                <p className="font-medium">Take or upload a photo</p>
                <p className="text-sm text-tertiary mt-1">AI will estimate nutrition from the image</p>
              </div>

              <div className="mt-4 p-3 bg-amber-500/10 rounded-lg">
                <p className="text-xs text-amber-400 flex items-center gap-2">
                  <Sparkles size={14} />
                  AI will identify foods and estimate calories, protein, carbs, and fat
                </p>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}

// Add Food Modal
function AddFoodModal({
  mealType,
  onAdd,
  onClose,
}: {
  mealType: string
  onAdd: (food: FoodItem) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'favorites' | 'search' | 'manual'>('favorites')
  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    servings: '1',
  })
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search effect
  useEffect(() => {
    if (tab !== 'search' || search.length < 2) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)

      try {
        const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(search)}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Search failed')
        }

        const data = await response.json()

        // Transform to FoodItem format
        const foods: FoodItem[] = data.results.map((r: any) => ({
          id: r.id,
          name: r.name,
          brand: r.brand,
          servings: 1,
          serving_unit: r.serving_size,
          calories: r.calories,
          protein_g: r.protein_g,
          carbs_g: r.carbs_g,
          fat_g: r.fat_g,
          fiber_g: r.fiber_g,
          source: 'database' as const,
        }))

        setSearchResults(foods)
      } catch (err: any) {
        console.error('Search error:', err)
        setSearchError(err.message || 'Failed to search. Please try again.')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search, tab])

  const filteredFavorites = FAVORITE_FOODS.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddFavorite = (food: FoodItem) => {
    onAdd({ ...food, id: `food-${Date.now()}` })
    onClose()
  }

  const handleAddManual = () => {
    if (!manualFood.name || !manualFood.calories) return
    
    const food: FoodItem = {
      id: `food-${Date.now()}`,
      name: manualFood.name,
      servings: parseFloat(manualFood.servings) || 1,
      serving_unit: 'serving',
      calories: parseInt(manualFood.calories) || 0,
      protein_g: parseFloat(manualFood.protein) || 0,
      carbs_g: parseFloat(manualFood.carbs) || 0,
      fat_g: parseFloat(manualFood.fat) || 0,
      source: 'manual',
    }
    onAdd(food)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold capitalize">Add to {mealType}</h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search foods..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {(['favorites', 'search', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                  tab === t ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4">
          {tab === 'favorites' && (
            <div className="space-y-2">
              {filteredFavorites.map(food => (
                <button
                  key={food.id}
                  onClick={() => handleAddFavorite(food)}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-3 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Utensils size={18} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{food.name}</p>
                    <p className="text-sm text-tertiary">
                      {food.calories} cal • {food.protein_g}g P • {food.carbs_g}g C • {food.fat_g}g F
                    </p>
                  </div>
                  <Plus size={18} className="text-secondary" />
                </button>
              ))}
            </div>
          )}

          {tab === 'search' && (
            <div className="space-y-2">
              {search.length < 2 && (
                <p className="text-center text-secondary py-8 text-sm">
                  Type at least 2 characters to search the USDA food database
                </p>
              )}

              {isSearching && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
                  <p className="text-sm text-tertiary mt-2">Searching...</p>
                </div>
              )}

              {searchError && (
                <p className="text-center text-red-400 py-4 text-sm">{searchError}</p>
              )}

              {!isSearching && search.length >= 2 && searchResults.length === 0 && !searchError && (
                <p className="text-center text-secondary py-8 text-sm">
                  No foods found for &quot;{search}&quot;
                </p>
              )}

              {searchResults.map(food => (
                <button
                  key={food.id}
                  onClick={() => {
                    onAdd({ ...food, id: `food-${Date.now()}` })
                    onClose()
                  }}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-3 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Search size={18} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{food.name}</p>
                    {food.brand && (
                      <p className="text-xs text-tertiary truncate">{food.brand}</p>
                    )}
                    <p className="text-sm text-tertiary">
                      {food.calories} cal • {food.protein_g}g P • {food.carbs_g}g C • {food.fat_g}g F
                    </p>
                  </div>
                  <Plus size={18} className="text-secondary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Food name</label>
                <input
                  type="text"
                  value={manualFood.name}
                  onChange={e => setManualFood(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Grilled chicken"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Calories</label>
                  <input
                    type="number"
                    value={manualFood.calories}
                    onChange={e => setManualFood(prev => ({ ...prev, calories: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Servings</label>
                  <input
                    type="number"
                    value={manualFood.servings}
                    onChange={e => setManualFood(prev => ({ ...prev, servings: e.target.value }))}
                    placeholder="1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={manualFood.protein}
                    onChange={e => setManualFood(prev => ({ ...prev, protein: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={manualFood.carbs}
                    onChange={e => setManualFood(prev => ({ ...prev, carbs: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    value={manualFood.fat}
                    onChange={e => setManualFood(prev => ({ ...prev, fat: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <button
                onClick={handleAddManual}
                disabled={!manualFood.name || !manualFood.calories}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Food
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Meal Card
function MealCard({
  meal,
  onAddFood,
  onRemoveFood,
  onPhotoCapture,
}: {
  meal: Meal
  onAddFood: (food: FoodItem) => void
  onRemoveFood: (foodId: string) => void
  onPhotoCapture: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const Icon = MEAL_ICONS[meal.type]
  const colorClass = MEAL_COLORS[meal.type]

  const mealCalories = meal.foods.reduce((sum, f) => sum + (f.calories * f.servings), 0)
  const mealProtein = meal.foods.reduce((sum, f) => sum + (f.protein_g * f.servings), 0)
  const mealCarbs = meal.foods.reduce((sum, f) => sum + (f.carbs_g * f.servings), 0)
  const mealFat = meal.foods.reduce((sum, f) => sum + (f.fat_g * f.servings), 0)

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        
        <div className="flex-1">
          <h3 className="font-medium capitalize">{meal.type}</h3>
          <p className="text-sm text-tertiary">
            {meal.foods.length} items • {mealCalories} cal
          </p>
        </div>

        <div className="text-right text-sm">
          <p>{mealProtein}g P • {mealCarbs}g C • {mealFat}g F</p>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Foods list */}
          {meal.foods.map(food => (
            <div 
              key={food.id}
              className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate">{food.name}</p>
                <p className="text-sm text-tertiary">
                  {food.servings} {food.serving_unit}
                </p>
              </div>
              <div className="text-right text-sm text-white/60">
                <p>{food.calories * food.servings} cal</p>
              </div>
              <button 
                onClick={() => onRemoveFood(food.id)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-secondary hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Empty state */}
          {meal.foods.length === 0 && (
            <p className="text-center text-muted py-4 text-sm">No foods logged</p>
          )}

          {/* Add buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onPhotoCapture}
              className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Camera size={16} /> Photo
            </button>
            <button
              onClick={onAddFood}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Food
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to transform API food items to component format
function transformApiFoods(apiFoods: any[]): FoodItem[] {
  return (apiFoods || []).map(f => ({
    id: f.id,
    name: f.food_name,
    brand: f.brand,
    servings: 1,
    serving_unit: f.serving_size || 'serving',
    calories: f.calories || 0,
    protein_g: f.protein_g || 0,
    carbs_g: f.carbs_g || 0,
    fat_g: f.fat_g || 0,
    fiber_g: f.fiber_g,
    source: f.source || 'manual',
  }))
}

// Main Nutrition Tracker
export function NutritionTracker() {
  const [meals, setMeals] = useState<Meal[]>([
    { id: 'breakfast', type: 'breakfast', foods: [] },
    { id: 'lunch', type: 'lunch', foods: [] },
    { id: 'dinner', type: 'dinner', foods: [] },
    { id: 'snack', type: 'snack', foods: [] },
  ])
  const [showAddFood, setShowAddFood] = useState<string | null>(null)
  const [showPhotoCapture, setShowPhotoCapture] = useState<string | null>(null)
  const [waterOz, setWaterOz] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [targets, setTargets] = useState<NutritionTargets>({
    calories: 2400,
    protein_g: 180,
    carbs_g: 250,
    fat_g: 80,
    fiber_g: 30,
  })

  // Load nutrition data on mount
  useEffect(() => {
    const loadNutritionData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const today = format(new Date(), 'yyyy-MM-dd')

        // Fetch today's nutrition log and targets in parallel
        const [nutritionResponse, targetsResponse] = await Promise.all([
          fetch(`/api/nutrition/log?date=${today}`),
          fetch('/api/nutrition/targets'),
        ])

        if (!nutritionResponse.ok) {
          throw new Error('Failed to load nutrition data')
        }

        const nutritionData = await nutritionResponse.json()

        // Transform API response to component state format
        const loadedMeals: Meal[] = [
          { id: 'breakfast', type: 'breakfast', foods: transformApiFoods(nutritionData.meals?.breakfast) },
          { id: 'lunch', type: 'lunch', foods: transformApiFoods(nutritionData.meals?.lunch) },
          { id: 'dinner', type: 'dinner', foods: transformApiFoods(nutritionData.meals?.dinner) },
          { id: 'snack', type: 'snack', foods: transformApiFoods(nutritionData.meals?.snack) },
        ]

        setMeals(loadedMeals)
        setWaterOz(nutritionData.water_oz || 0)

        // Load targets from profile
        if (targetsResponse.ok) {
          const targetsData = await targetsResponse.json()
          setTargets({
            calories: targetsData.calorie_target || 2400,
            protein_g: targetsData.protein_target_g || 180,
            carbs_g: targetsData.carb_target_g || 250,
            fat_g: targetsData.fat_target_g || 80,
            fiber_g: 30,
          })
        }
      } catch (err) {
        console.error('Failed to load nutrition data:', err)
        setError('Failed to load nutrition data')
      } finally {
        setIsLoading(false)
      }
    }

    loadNutritionData()
  }, [])

  // Calculate totals
  const totals = meals.reduce((acc, meal) => {
    meal.foods.forEach(food => {
      acc.calories += food.calories * food.servings
      acc.protein_g += food.protein_g * food.servings
      acc.carbs_g += food.carbs_g * food.servings
      acc.fat_g += food.fat_g * food.servings
      acc.fiber_g += (food.fiber_g || 0) * food.servings
    })
    return acc
  }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })

  const addFoodToMeal = async (mealId: string, food: FoodItem) => {
    // Optimistic update
    const tempId = food.id
    setMeals(prev => prev.map(meal =>
      meal.id === mealId
        ? { ...meal, foods: [...meal.foods, food] }
        : meal
    ))

    try {
      const response = await fetch('/api/nutrition/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealId,
          foods: [{
            food_name: food.name,
            serving_size: `${food.servings} ${food.serving_unit}`,
            calories: Math.round(food.calories * food.servings),
            protein_g: Math.round(food.protein_g * food.servings * 10) / 10,
            carbs_g: Math.round(food.carbs_g * food.servings * 10) / 10,
            fat_g: Math.round(food.fat_g * food.servings * 10) / 10,
            fiber_g: food.fiber_g ? Math.round(food.fiber_g * food.servings * 10) / 10 : null,
            source: food.source,
          }]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save food')
      }

      const data = await response.json()

      // Update with server-generated ID
      if (data.foods?.[0]?.id) {
        setMeals(prev => prev.map(meal =>
          meal.id === mealId
            ? {
                ...meal,
                foods: meal.foods.map(f =>
                  f.id === tempId ? { ...f, id: data.foods[0].id } : f
                )
              }
            : meal
        ))
      }
    } catch (err) {
      console.error('Failed to save food:', err)
      // Rollback on error
      setMeals(prev => prev.map(meal =>
        meal.id === mealId
          ? { ...meal, foods: meal.foods.filter(f => f.id !== tempId) }
          : meal
      ))
    }
  }

  const removeFoodFromMeal = async (mealId: string, foodId: string) => {
    // Store for potential rollback
    const originalMeals = meals

    // Optimistic update
    setMeals(prev => prev.map(meal =>
      meal.id === mealId
        ? { ...meal, foods: meal.foods.filter(f => f.id !== foodId) }
        : meal
    ))

    try {
      const response = await fetch(`/api/nutrition/log?food_id=${foodId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete food')
      }
    } catch (err) {
      console.error('Failed to delete food:', err)
      // Rollback on error
      setMeals(originalMeals)
    }
  }

  // Update water intake with debounce
  const updateWater = useCallback(async (newWaterOz: number) => {
    setWaterOz(newWaterOz)

    try {
      await fetch('/api/nutrition/water', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ water_oz: newWaterOz })
      })
    } catch (err) {
      console.error('Failed to update water:', err)
    }
  }, [])

  const handlePhotoCapture = (mealId: string, foods: FoodItem[]) => {
    // Add all detected foods to the meal
    foods.forEach(food => {
      addFoodToMeal(mealId, food)
    })
    setShowPhotoCapture(null)
  }

  const caloriesRemaining = targets.calories - totals.calories

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-amber-500 mb-4" />
          <p className="text-tertiary">Loading nutrition data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Nutrition</h1>
          <p className="text-tertiary">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Calorie summary card */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-3xl font-bold">{totals.calories}</p>
            <p className="text-tertiary">of {targets.calories} cal</p>
          </div>
          <div className={`text-right ${caloriesRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <p className="text-2xl font-bold">{Math.abs(caloriesRemaining)}</p>
            <p className="text-tertiary">{caloriesRemaining >= 0 ? 'remaining' : 'over'}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              totals.calories > targets.calories ? 'bg-red-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min((totals.calories / targets.calories) * 100, 100)}%` }}
          />
        </div>

        {/* Macro rings */}
        <div className="flex justify-around mt-6">
          <MacroRing current={Math.round(totals.protein_g)} target={targets.protein_g} color="#ef4444" label="Protein" />
          <MacroRing current={Math.round(totals.carbs_g)} target={targets.carbs_g} color="#22c55e" label="Carbs" />
          <MacroRing current={Math.round(totals.fat_g)} target={targets.fat_g} color="#eab308" label="Fat" />
        </div>
      </div>

      {/* Water tracker */}
      <div className="glass rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
          <Droplet size={20} className="text-sky-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Water</p>
          <p className="text-sm text-tertiary">{waterOz} / 100 oz</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateWater(Math.max(0, waterOz - 8))}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            -
          </button>
          <span className="w-12 text-center font-mono">{waterOz}</span>
          <button
            onClick={() => updateWater(waterOz + 8)}
            className="w-8 h-8 bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Meals */}
      <div className="space-y-4">
        {meals.map(meal => (
          <MealCard
            key={meal.id}
            meal={meal}
            onAddFood={() => setShowAddFood(meal.id)}
            onRemoveFood={(foodId) => removeFoodFromMeal(meal.id, foodId)}
            onPhotoCapture={() => setShowPhotoCapture(meal.id)}
          />
        ))}
      </div>

      {/* Add Food Modal */}
      {showAddFood && (
        <AddFoodModal
          mealType={showAddFood}
          onAdd={(food) => {
            addFoodToMeal(showAddFood, food)
            setShowAddFood(null)
          }}
          onClose={() => setShowAddFood(null)}
        />
      )}

      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <PhotoCaptureModal
          mealType={showPhotoCapture}
          onCapture={(foods) => handlePhotoCapture(showPhotoCapture, foods)}
          onClose={() => setShowPhotoCapture(null)}
        />
      )}
    </div>
  )
}
