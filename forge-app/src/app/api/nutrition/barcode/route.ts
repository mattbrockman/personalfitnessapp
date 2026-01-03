import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2'

interface OpenFoodFactsProduct {
  product_name?: string
  brands?: string
  serving_size?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    'energy-kcal_serving'?: number
    'proteins_100g'?: number
    'proteins_serving'?: number
    'carbohydrates_100g'?: number
    'carbohydrates_serving'?: number
    'fat_100g'?: number
    'fat_serving'?: number
    'fiber_100g'?: number
    'fiber_serving'?: number
    'sodium_100g'?: number
    'sodium_serving'?: number
  }
}

interface BarcodeResult {
  id: string
  name: string
  brand?: string
  serving_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  source: 'barcode'
}

// GET /api/nutrition/barcode?code=0123456789012
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('code')

    if (!barcode || barcode.length < 8) {
      return NextResponse.json(
        { error: 'Valid barcode required (at least 8 digits)' },
        { status: 400 }
      )
    }

    // Call Open Food Facts API
    const response = await fetch(
      `${OPEN_FOOD_FACTS_BASE_URL}/product/${barcode}?fields=product_name,brands,serving_size,nutriments`,
      {
        headers: {
          'User-Agent': 'ForgeApp/1.0 (fitness tracking app)',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { error: 'Product not found', found: false },
        { status: 404 }
      )
    }

    const product: OpenFoodFactsProduct = data.product
    const nutriments = product.nutriments || {}

    // Prefer per-serving values if available, otherwise use per-100g
    const hasServingData = nutriments['energy-kcal_serving'] !== undefined
    const servingSize = product.serving_size || '100g'

    const result: BarcodeResult = {
      id: `off-${barcode}`,
      name: product.product_name || 'Unknown Product',
      brand: product.brands,
      serving_size: servingSize,
      calories: Math.round(
        hasServingData
          ? (nutriments['energy-kcal_serving'] || 0)
          : (nutriments['energy-kcal_100g'] || 0)
      ),
      protein_g: Math.round(
        (hasServingData
          ? (nutriments['proteins_serving'] || 0)
          : (nutriments['proteins_100g'] || 0)) * 10
      ) / 10,
      carbs_g: Math.round(
        (hasServingData
          ? (nutriments['carbohydrates_serving'] || 0)
          : (nutriments['carbohydrates_100g'] || 0)) * 10
      ) / 10,
      fat_g: Math.round(
        (hasServingData
          ? (nutriments['fat_serving'] || 0)
          : (nutriments['fat_100g'] || 0)) * 10
      ) / 10,
      fiber_g: nutriments['fiber_100g']
        ? Math.round(
            (hasServingData
              ? (nutriments['fiber_serving'] || 0)
              : (nutriments['fiber_100g'] || 0)) * 10
          ) / 10
        : undefined,
      source: 'barcode' as const,
    }

    return NextResponse.json({
      found: true,
      product: result,
    })
  } catch (error) {
    console.error('Barcode lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup barcode' },
      { status: 500 }
    )
  }
}
