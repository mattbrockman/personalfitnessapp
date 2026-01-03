import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

// Type for food item to log
interface FoodItem {
  food_name: string
  brand?: string
  serving_size?: string | number  // Can be text description or number
  servings?: number  // Number of servings
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  source?: 'manual' | 'photo_ai' | 'barcode' | 'database' | 'favorite'
  photo_url?: string
}

// Helper to parse numeric serving size from potentially text value
function parseServingSize(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  if (!value) return 1
  // Try to extract a number from the beginning of the string
  const match = value.toString().match(/^[\d.]+/)
  if (match) return parseFloat(match[0])
  return 1  // Default to 1 serving
}

// POST /api/nutrition/log - Log food items to nutrition log
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      log_date,
      meal_type,
      foods,
      photo_url,
    }: {
      log_date?: string
      meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      foods: FoodItem[]
      photo_url?: string
    } = body

    if (!meal_type || !foods || !Array.isArray(foods) || foods.length === 0) {
      return NextResponse.json(
        { error: 'meal_type and foods array are required' },
        { status: 400 }
      )
    }

    const targetDate = log_date || format(new Date(), 'yyyy-MM-dd')

    // Get or create nutrition log for this date
    let { data: nutritionLog } = await (adminClient as any)
      .from('nutrition_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('log_date', targetDate)
      .single()

    if (!nutritionLog) {
      const { data: newLog, error: createError } = await (adminClient as any)
        .from('nutrition_logs')
        .insert({
          user_id: user.id,
          log_date: targetDate,
          total_calories: 0,
          total_protein_g: 0,
          total_carbs_g: 0,
          total_fat_g: 0,
        })
        .select('id')
        .single()

      if (createError) {
        throw createError
      }
      nutritionLog = newLog
    }

    // Insert all food items
    const foodsToInsert = foods.map(food => ({
      nutrition_log_id: nutritionLog.id,
      meal_type,
      food_name: food.food_name,
      brand: food.brand || null,
      serving_size: parseServingSize(food.serving_size),
      calories: food.calories || null,
      protein_g: food.protein_g || null,
      carbs_g: food.carbs_g || null,
      fat_g: food.fat_g || null,
      fiber_g: food.fiber_g || null,
      source: food.source || 'manual',
      photo_url: photo_url || food.photo_url || null,
    }))

    const { data: insertedFoods, error: insertError } = await (adminClient as any)
      .from('nutrition_foods')
      .insert(foodsToInsert)
      .select()

    if (insertError) {
      throw insertError
    }

    // The database trigger will automatically update the totals in nutrition_logs

    // Get updated totals
    const { data: updatedLog } = await (adminClient as any)
      .from('nutrition_logs')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('id', nutritionLog.id)
      .single()

    return NextResponse.json({
      success: true,
      message: `Logged ${foods.length} food item(s) for ${meal_type}`,
      foods: insertedFoods,
      daily_totals: updatedLog,
    })
  } catch (error) {
    console.error('Nutrition log error:', error)
    return NextResponse.json(
      { error: 'Failed to log nutrition data' },
      { status: 500 }
    )
  }
}

// GET /api/nutrition/log - Get nutrition log for a date
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')

    // Get nutrition log with foods
    const { data: nutritionLog } = await (adminClient as any)
      .from('nutrition_logs')
      .select(`
        *,
        nutrition_foods (
          id,
          meal_type,
          food_name,
          serving_size,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          source,
          photo_url,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('log_date', date)
      .single()

    if (!nutritionLog) {
      return NextResponse.json({
        log_date: date,
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
        foods: [],
        meals: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        },
      })
    }

    // Group foods by meal type
    const foods = nutritionLog.nutrition_foods || []
    const meals = {
      breakfast: foods.filter((f: any) => f.meal_type === 'breakfast'),
      lunch: foods.filter((f: any) => f.meal_type === 'lunch'),
      dinner: foods.filter((f: any) => f.meal_type === 'dinner'),
      snack: foods.filter((f: any) => f.meal_type === 'snack'),
    }

    return NextResponse.json({
      id: nutritionLog.id,
      log_date: nutritionLog.log_date,
      total_calories: nutritionLog.total_calories,
      total_protein_g: nutritionLog.total_protein_g,
      total_carbs_g: nutritionLog.total_carbs_g,
      total_fat_g: nutritionLog.total_fat_g,
      total_fiber_g: nutritionLog.total_fiber_g,
      water_oz: nutritionLog.water_oz,
      foods,
      meals,
    })
  } catch (error) {
    console.error('Get nutrition log error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nutrition data' },
      { status: 500 }
    )
  }
}

// DELETE /api/nutrition/log - Delete a food item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const foodId = searchParams.get('food_id')

    if (!foodId) {
      return NextResponse.json(
        { error: 'food_id is required' },
        { status: 400 }
      )
    }

    // Verify ownership via nutrition_log -> user_id
    const { data: food } = await (adminClient as any)
      .from('nutrition_foods')
      .select('id, nutrition_log_id, nutrition_logs!inner(user_id)')
      .eq('id', foodId)
      .single()

    if (!food || (food as any).nutrition_logs?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Food item not found' },
        { status: 404 }
      )
    }

    // Delete the food item (trigger will update totals)
    await (adminClient as any)
      .from('nutrition_foods')
      .delete()
      .eq('id', foodId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete food error:', error)
    return NextResponse.json(
      { error: 'Failed to delete food item' },
      { status: 500 }
    )
  }
}

// PATCH /api/nutrition/log - Edit a food item
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      food_id,
      servings,
      serving_size,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
    } = body

    if (!food_id) {
      return NextResponse.json(
        { error: 'food_id is required' },
        { status: 400 }
      )
    }

    // Verify ownership via nutrition_log -> user_id
    const { data: food } = await (adminClient as any)
      .from('nutrition_foods')
      .select('id, nutrition_log_id, nutrition_logs!inner(user_id)')
      .eq('id', food_id)
      .single()

    if (!food || (food as any).nutrition_logs?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Food item not found' },
        { status: 404 }
      )
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (servings !== undefined) updates.serving_size = parseServingSize(servings)
    if (serving_size !== undefined) updates.serving_size = parseServingSize(serving_size)
    if (calories !== undefined) updates.calories = calories
    if (protein_g !== undefined) updates.protein_g = protein_g
    if (carbs_g !== undefined) updates.carbs_g = carbs_g
    if (fat_g !== undefined) updates.fat_g = fat_g
    if (fiber_g !== undefined) updates.fiber_g = fiber_g

    // Update the food item
    const { data: updatedFood, error: updateError } = await (adminClient as any)
      .from('nutrition_foods')
      .update(updates)
      .eq('id', food_id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Get updated totals (trigger should have updated them)
    const { data: updatedLog } = await (adminClient as any)
      .from('nutrition_logs')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('id', food.nutrition_log_id)
      .single()

    return NextResponse.json({
      success: true,
      food: updatedFood,
      daily_totals: updatedLog,
    })
  } catch (error) {
    console.error('Edit food error:', error)
    return NextResponse.json(
      { error: 'Failed to edit food item' },
      { status: 500 }
    )
  }
}
