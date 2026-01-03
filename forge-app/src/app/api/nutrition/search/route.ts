import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USDA_API_KEY = process.env.USDA_API_KEY
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

// USDA Nutrient IDs
const NUTRIENT_IDS = {
  ENERGY: 1008,      // Calories (kcal)
  PROTEIN: 1003,     // Protein (g)
  FAT: 1004,         // Total fat (g)
  CARBS: 1005,       // Carbohydrates (g)
  FIBER: 1079,       // Fiber (g)
  SUGAR: 2000,       // Total sugars (g)
  SODIUM: 1093,      // Sodium (mg)
}

interface USDAFoodNutrient {
  nutrientId: number
  nutrientName: string
  value: number
  unitName: string
}

interface USDAFood {
  fdcId: number
  description: string
  brandName?: string
  brandOwner?: string
  dataType: string
  foodNutrients: USDAFoodNutrient[]
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
}

interface SearchResult {
  id: string
  name: string
  brand?: string
  serving_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  source: 'database'
}

function extractNutrient(nutrients: USDAFoodNutrient[], nutrientId: number): number {
  const nutrient = nutrients.find(n => n.nutrientId === nutrientId)
  return nutrient?.value || 0
}

function transformUSDAFood(food: USDAFood): SearchResult {
  // Determine serving size text
  let servingSize = '100g'
  if (food.householdServingFullText) {
    servingSize = food.householdServingFullText
  } else if (food.servingSize && food.servingSizeUnit) {
    servingSize = `${food.servingSize} ${food.servingSizeUnit}`
  }

  return {
    id: `usda-${food.fdcId}`,
    name: food.description,
    brand: food.brandName || food.brandOwner,
    serving_size: servingSize,
    calories: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_IDS.ENERGY)),
    protein_g: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_IDS.PROTEIN) * 10) / 10,
    carbs_g: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_IDS.CARBS) * 10) / 10,
    fat_g: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_IDS.FAT) * 10) / 10,
    fiber_g: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_IDS.FIBER) * 10) / 10 || undefined,
    source: 'database' as const,
  }
}

// GET /api/nutrition/search?q=chicken&pageSize=25
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!USDA_API_KEY) {
      return NextResponse.json(
        { error: 'Food search not configured. Please add USDA_API_KEY to environment.' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Call USDA FoodData Central API
    const response = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        dataType: ['Foundation', 'SR Legacy', 'Branded'],
        pageSize,
        pageNumber: 1,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
        requireAllWords: false,
      }),
    })

    if (!response.ok) {
      console.error('USDA API error:', response.status, await response.text())
      throw new Error(`USDA API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform and filter results
    const results: SearchResult[] = (data.foods || [])
      .map((food: USDAFood) => transformUSDAFood(food))
      .filter((food: SearchResult) => food.calories > 0) // Filter out items with no calorie data

    return NextResponse.json({
      results,
      totalHits: data.totalHits,
      currentPage: data.currentPage,
    })
  } catch (error) {
    console.error('Food search error:', error)
    return NextResponse.json(
      { error: 'Failed to search foods' },
      { status: 500 }
    )
  }
}
