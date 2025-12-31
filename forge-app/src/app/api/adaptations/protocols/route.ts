import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AdaptationProtocol, GalpinAdaptation, ExperienceLevel } from '@/types/galpin'
import { adjustProtocolForExperience, calculateTrainingAge } from '@/lib/galpin-calculations'

// GET /api/adaptations/protocols - Get evidence-based training protocols
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const adaptationType = searchParams.get('type') as GalpinAdaptation | null
    const adjustForExperience = searchParams.get('adjust') === 'true'

    // Fetch protocols
    let query = supabase
      .from('adaptation_protocols')
      .select('*')

    if (adaptationType) {
      query = query.eq('adaptation_type', adaptationType)
    }

    const { data: protocols, error } = await query as { data: AdaptationProtocol[] | null; error: any }

    if (error) {
      console.error('Error fetching protocols:', error)
      return NextResponse.json({ error: 'Failed to fetch protocols' }, { status: 500 })
    }

    let adjustedProtocols = protocols || []

    // Adjust for user's experience level if requested
    if (adjustForExperience && adjustedProtocols.length > 0) {
      // Fetch user's training start date
      const { data: profile } = await supabase
        .from('profiles')
        .select('training_start_date')
        .eq('id', user.id)
        .single() as { data: { training_start_date: string | null } | null; error: any }

      const trainingAge = calculateTrainingAge(profile?.training_start_date || null)

      adjustedProtocols = adjustedProtocols.map(protocol =>
        adjustProtocolForExperience(protocol, trainingAge.experienceLevel)
      )
    }

    // If single protocol requested, return it directly
    if (adaptationType && adjustedProtocols.length === 1) {
      return NextResponse.json({ protocol: adjustedProtocols[0] })
    }

    return NextResponse.json({ protocols: adjustedProtocols })
  } catch (error) {
    console.error('Error in protocols GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
