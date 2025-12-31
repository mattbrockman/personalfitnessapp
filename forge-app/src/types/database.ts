// This file will be replaced by Supabase generated types
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          date_of_birth: string | null
          height_inches: number | null
          weight_unit: 'lbs' | 'kg'
          distance_unit: 'mi' | 'km'
          temperature_unit: 'f' | 'c'
          week_start_day: 'monday' | 'sunday'
          default_rest_seconds: number
          target_calories: number | null
          target_protein_g: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          ftp_watts: number | null
          lthr_bpm: number | null
          max_hr_bpm: number | null
          threshold_pace_per_mile: string | null
          active_program_id: string | null
          available_equipment: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          target_calories?: number | null
        }
      }
      integrations: {
        Row: {
          id: string
          user_id: string
          service: 'strava' | 'apple_health' | 'trainerroad' | 'zwift' | 'strong' | 'google_calendar' | 'whoop' | 'oura' | 'garmin' | 'wahoo'
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          external_user_id: string | null
          scopes: string[] | null
          last_sync_at: string | null
          sync_status: 'active' | 'paused' | 'error'
          sync_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          service: string
          access_token?: string | null
          refresh_token?: string | null
        }
        Update: {
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          last_sync_at?: string | null
        }
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          completed_at: string | null
          category: 'cardio' | 'strength' | 'other'
          workout_type: string
          name: string | null
          description: string | null
          primary_intensity: 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'hit' | 'mixed' | null
          planned_duration_minutes: number | null
          planned_distance_miles: number | null
          planned_tss: number | null
          actual_duration_minutes: number | null
          actual_distance_miles: number | null
          actual_tss: number | null
          actual_avg_hr: number | null
          actual_max_hr: number | null
          actual_avg_power: number | null
          actual_np: number | null
          actual_elevation_ft: number | null
          status: 'planned' | 'in_progress' | 'completed' | 'skipped'
          source: 'manual' | 'strava' | 'trainerroad' | 'zwift' | 'apple_health' | 'strong' | 'garmin' | 'wahoo' | 'peloton'
          external_id: string | null
          external_url: string | null
          notes: string | null
          perceived_exertion: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          category: 'cardio' | 'strength' | 'other'
          workout_type: string
        }
        Update: {
          scheduled_date?: string | null
          status?: 'planned' | 'in_progress' | 'completed' | 'skipped'
        }
      }
      workout_zones: {
        Row: {
          id: string
          workout_id: string
          zone_type: 'heart_rate' | 'power' | 'pace'
          zone_1_seconds: number
          zone_2_seconds: number
          zone_3_seconds: number
          zone_4_seconds: number
          zone_5_seconds: number
          zone_6_seconds: number
          zone_7_seconds: number
          zone_boundaries: Json | null
          created_at: string
        }
        Insert: {
          workout_id: string
          zone_type: 'heart_rate' | 'power' | 'pace'
        }
        Update: {
          zone_1_seconds?: number
          zone_2_seconds?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutZone = Database['public']['Tables']['workout_zones']['Row']
