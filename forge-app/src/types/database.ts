export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_balance_rules: {
        Row: {
          affected_activity: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          modifier: number | null
          plan_id: string
          rule_type: string
          trigger_activity: string
          trigger_phase: string | null
        }
        Insert: {
          affected_activity: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          modifier?: number | null
          plan_id: string
          rule_type: string
          trigger_activity: string
          trigger_phase?: string | null
        }
        Update: {
          affected_activity?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          modifier?: number | null
          plan_id?: string
          rule_type?: string
          trigger_activity?: string
          trigger_phase?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_balance_rules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptation_evaluations: {
        Row: {
          created_at: string | null
          error_message: string | null
          evaluation_date: string | null
          evaluation_trigger: string | null
          evaluation_type: string
          id: string
          metrics_snapshot: Json
          no_action_reason: string | null
          plan_id: string
          processing_ms: number | null
          recommendation_ids: string[] | null
          recommendations_generated: number | null
          scopes_evaluated: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          evaluation_date?: string | null
          evaluation_trigger?: string | null
          evaluation_type: string
          id?: string
          metrics_snapshot: Json
          no_action_reason?: string | null
          plan_id: string
          processing_ms?: number | null
          recommendation_ids?: string[] | null
          recommendations_generated?: number | null
          scopes_evaluated?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          evaluation_date?: string | null
          evaluation_trigger?: string | null
          evaluation_type?: string
          id?: string
          metrics_snapshot?: Json
          no_action_reason?: string | null
          plan_id?: string
          processing_ms?: number | null
          recommendation_ids?: string[] | null
          recommendations_generated?: number | null
          scopes_evaluated?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptation_evaluations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptation_evaluations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptation_protocols: {
        Row: {
          adaptation_type: string
          created_at: string | null
          default_tempo: string | null
          exercise_selection_notes: string | null
          intensity_max: number | null
          intensity_min: number | null
          intensity_unit: string
          rep_max: number
          rep_min: number
          rest_max: number
          rest_min: number
          sessions_per_week_max: number
          sessions_per_week_min: number
          sets_max: number
          sets_min: number
        }
        Insert: {
          adaptation_type: string
          created_at?: string | null
          default_tempo?: string | null
          exercise_selection_notes?: string | null
          intensity_max?: number | null
          intensity_min?: number | null
          intensity_unit?: string
          rep_max: number
          rep_min: number
          rest_max: number
          rest_min: number
          sessions_per_week_max: number
          sessions_per_week_min: number
          sets_max: number
          sets_min: number
        }
        Update: {
          adaptation_type?: string
          created_at?: string | null
          default_tempo?: string | null
          exercise_selection_notes?: string | null
          intensity_max?: number | null
          intensity_min?: number | null
          intensity_unit?: string
          rep_max?: number
          rep_min?: number
          rest_max?: number
          rest_min?: number
          sessions_per_week_max?: number
          sessions_per_week_min?: number
          sets_max?: number
          sets_min?: number
        }
        Relationships: []
      }
      adaptation_settings: {
        Row: {
          auto_apply_workout_adjustments: boolean | null
          auto_evaluate: boolean | null
          compliance_alert_threshold: number | null
          compliance_consecutive_weeks: number | null
          created_at: string | null
          day_of_adjustment_enabled: boolean | null
          day_of_readiness_threshold: number | null
          max_pending_recommendations: number | null
          mid_phase_evaluate: boolean | null
          notify_pending_recommendations: boolean | null
          notify_urgent_only: boolean | null
          phase_end_evaluate: boolean | null
          plateau_exercise_count: number | null
          plateau_weeks_threshold: number | null
          progress_ahead_threshold: number | null
          progress_behind_threshold: number | null
          readiness_alert_threshold: number | null
          tsb_alert_threshold: number | null
          updated_at: string | null
          user_id: string
          weekly_review_day: string | null
          weekly_review_enabled: boolean | null
        }
        Insert: {
          auto_apply_workout_adjustments?: boolean | null
          auto_evaluate?: boolean | null
          compliance_alert_threshold?: number | null
          compliance_consecutive_weeks?: number | null
          created_at?: string | null
          day_of_adjustment_enabled?: boolean | null
          day_of_readiness_threshold?: number | null
          max_pending_recommendations?: number | null
          mid_phase_evaluate?: boolean | null
          notify_pending_recommendations?: boolean | null
          notify_urgent_only?: boolean | null
          phase_end_evaluate?: boolean | null
          plateau_exercise_count?: number | null
          plateau_weeks_threshold?: number | null
          progress_ahead_threshold?: number | null
          progress_behind_threshold?: number | null
          readiness_alert_threshold?: number | null
          tsb_alert_threshold?: number | null
          updated_at?: string | null
          user_id: string
          weekly_review_day?: string | null
          weekly_review_enabled?: boolean | null
        }
        Update: {
          auto_apply_workout_adjustments?: boolean | null
          auto_evaluate?: boolean | null
          compliance_alert_threshold?: number | null
          compliance_consecutive_weeks?: number | null
          created_at?: string | null
          day_of_adjustment_enabled?: boolean | null
          day_of_readiness_threshold?: number | null
          max_pending_recommendations?: number | null
          mid_phase_evaluate?: boolean | null
          notify_pending_recommendations?: boolean | null
          notify_urgent_only?: boolean | null
          phase_end_evaluate?: boolean | null
          plateau_exercise_count?: number | null
          plateau_weeks_threshold?: number | null
          progress_ahead_threshold?: number | null
          progress_behind_threshold?: number | null
          readiness_alert_threshold?: number | null
          tsb_alert_threshold?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_review_day?: string | null
          weekly_review_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptation_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_composition_logs: {
        Row: {
          almi: number | null
          android_fat_pct: number | null
          arm_fat_pct: number | null
          body_fat_pct: number | null
          bone_mass_lbs: number | null
          bone_mineral_density: number | null
          created_at: string | null
          ffmi: number | null
          gynoid_fat_pct: number | null
          id: string
          lean_mass_lbs: number | null
          leg_fat_pct: number | null
          log_date: string
          muscle_mass_lbs: number | null
          notes: string | null
          source: string
          trunk_fat_pct: number | null
          updated_at: string | null
          user_id: string
          visceral_fat_rating: number | null
          water_pct: number | null
          weight_lbs: number | null
        }
        Insert: {
          almi?: number | null
          android_fat_pct?: number | null
          arm_fat_pct?: number | null
          body_fat_pct?: number | null
          bone_mass_lbs?: number | null
          bone_mineral_density?: number | null
          created_at?: string | null
          ffmi?: number | null
          gynoid_fat_pct?: number | null
          id?: string
          lean_mass_lbs?: number | null
          leg_fat_pct?: number | null
          log_date: string
          muscle_mass_lbs?: number | null
          notes?: string | null
          source?: string
          trunk_fat_pct?: number | null
          updated_at?: string | null
          user_id: string
          visceral_fat_rating?: number | null
          water_pct?: number | null
          weight_lbs?: number | null
        }
        Update: {
          almi?: number | null
          android_fat_pct?: number | null
          arm_fat_pct?: number | null
          body_fat_pct?: number | null
          bone_mass_lbs?: number | null
          bone_mineral_density?: number | null
          created_at?: string | null
          ffmi?: number | null
          gynoid_fat_pct?: number | null
          id?: string
          lean_mass_lbs?: number | null
          leg_fat_pct?: number | null
          log_date?: string
          muscle_mass_lbs?: number | null
          notes?: string | null
          source?: string
          trunk_fat_pct?: number | null
          updated_at?: string | null
          user_id?: string
          visceral_fat_rating?: number | null
          water_pct?: number | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_composition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      centenarian_goals: {
        Row: {
          achieved_date: string | null
          category: string
          created_at: string | null
          current_ability: string | null
          current_score: number | null
          description: string | null
          display_order: number | null
          goal_name: string
          id: string
          is_achieved: boolean | null
          last_tested_date: string | null
          required_cardio: string | null
          required_mobility: string | null
          required_strength: string | null
          target_ability: string | null
          target_age: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achieved_date?: string | null
          category: string
          created_at?: string | null
          current_ability?: string | null
          current_score?: number | null
          description?: string | null
          display_order?: number | null
          goal_name: string
          id?: string
          is_achieved?: boolean | null
          last_tested_date?: string | null
          required_cardio?: string | null
          required_mobility?: string | null
          required_strength?: string | null
          target_ability?: string | null
          target_age?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achieved_date?: string | null
          category?: string
          created_at?: string | null
          current_ability?: string | null
          current_score?: number | null
          description?: string | null
          display_order?: number | null
          goal_name?: string
          id?: string
          is_achieved?: boolean | null
          last_tested_date?: string | null
          required_cardio?: string | null
          required_mobility?: string | null
          required_strength?: string | null
          target_ability?: string | null
          target_age?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centenarian_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cgm_readings: {
        Row: {
          created_at: string | null
          glucose_mg_dl: number
          id: string
          meal_context: string | null
          notes: string | null
          nutrition_log_id: string | null
          reading_time: string
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          glucose_mg_dl: number
          id?: string
          meal_context?: string | null
          notes?: string | null
          nutrition_log_id?: string | null
          reading_time: string
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          glucose_mg_dl?: number
          id?: string
          meal_context?: string | null
          notes?: string | null
          nutrition_log_id?: string | null
          reading_time?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cgm_readings_nutrition_log_id_fkey"
            columns: ["nutrition_log_id"]
            isOneToOne: false
            referencedRelation: "nutrition_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cgm_readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          context_type: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          context_type?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          context_type?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_access: {
        Row: {
          access_name: string | null
          access_pin: string
          created_at: string | null
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          permissions: Json | null
          user_id: string
        }
        Insert: {
          access_name?: string | null
          access_pin: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          permissions?: Json | null
          user_id: string
        }
        Update: {
          access_name?: string | null
          access_pin?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          permissions?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deload_triggers: {
        Row: {
          created_at: string | null
          id: string
          recommended_deload_type: string | null
          recommended_duration_days: number | null
          responded_at: string | null
          response_notes: string | null
          severity: string | null
          trigger_data: Json | null
          trigger_type: string
          triggered_at: string | null
          user_id: string
          user_response: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recommended_deload_type?: string | null
          recommended_duration_days?: number | null
          responded_at?: string | null
          response_notes?: string | null
          severity?: string | null
          trigger_data?: Json | null
          trigger_type: string
          triggered_at?: string | null
          user_id: string
          user_response?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recommended_deload_type?: string | null
          recommended_duration_days?: number | null
          responded_at?: string | null
          response_notes?: string | null
          severity?: string | null
          trigger_data?: Json | null
          trigger_type?: string
          triggered_at?: string | null
          user_id?: string
          user_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deload_triggers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_collection_items: {
        Row: {
          added_at: string | null
          collection_id: string
          exercise_id: string
          id: string
          notes: string | null
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          exercise_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          exercise_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "exercise_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_collection_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_collections: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          slug: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          slug: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exercise_sets: {
        Row: {
          actual_duration_seconds: number | null
          actual_reps: number | null
          actual_rpe: number | null
          actual_weight_lbs: number | null
          completed: boolean | null
          created_at: string | null
          id: string
          is_timed: boolean | null
          mean_velocity_mps: number | null
          notes: string | null
          set_number: number
          set_type: string | null
          target_duration_seconds: number | null
          target_reps: number | null
          target_rpe: number | null
          target_weight_lbs: number | null
          tempo: string | null
          workout_exercise_id: string
        }
        Insert: {
          actual_duration_seconds?: number | null
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight_lbs?: number | null
          completed?: boolean | null
          created_at?: string | null
          id?: string
          is_timed?: boolean | null
          mean_velocity_mps?: number | null
          notes?: string | null
          set_number: number
          set_type?: string | null
          target_duration_seconds?: number | null
          target_reps?: number | null
          target_rpe?: number | null
          target_weight_lbs?: number | null
          tempo?: string | null
          workout_exercise_id: string
        }
        Update: {
          actual_duration_seconds?: number | null
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight_lbs?: number | null
          completed?: boolean | null
          created_at?: string | null
          id?: string
          is_timed?: boolean | null
          mean_velocity_mps?: number | null
          notes?: string | null
          set_number?: number
          set_type?: string | null
          target_duration_seconds?: number | null
          target_reps?: number | null
          target_rpe?: number | null
          target_weight_lbs?: number | null
          tempo?: string | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          ai_enhanced: boolean | null
          body_part: string | null
          coaching_cues: string[] | null
          common_mistakes: string[] | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          equipment: string | null
          external_id: string | null
          external_source: string | null
          galpin_adaptations: string[] | null
          id: string
          import_date: string | null
          instructions: string | null
          is_compound: boolean | null
          is_plyometric: boolean | null
          is_power: boolean | null
          is_timed: boolean | null
          is_unilateral: boolean | null
          name: string
          primary_muscle: string | null
          primary_muscles: string[] | null
          quality_score: number | null
          secondary_muscles: string[] | null
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          ai_enhanced?: boolean | null
          body_part?: string | null
          coaching_cues?: string[] | null
          common_mistakes?: string[] | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          equipment?: string | null
          external_id?: string | null
          external_source?: string | null
          galpin_adaptations?: string[] | null
          id?: string
          import_date?: string | null
          instructions?: string | null
          is_compound?: boolean | null
          is_plyometric?: boolean | null
          is_power?: boolean | null
          is_timed?: boolean | null
          is_unilateral?: boolean | null
          name: string
          primary_muscle?: string | null
          primary_muscles?: string[] | null
          quality_score?: number | null
          secondary_muscles?: string[] | null
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          ai_enhanced?: boolean | null
          body_part?: string | null
          coaching_cues?: string[] | null
          common_mistakes?: string[] | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          equipment?: string | null
          external_id?: string | null
          external_source?: string | null
          galpin_adaptations?: string[] | null
          id?: string
          import_date?: string | null
          instructions?: string | null
          is_compound?: boolean | null
          is_plyometric?: boolean | null
          is_power?: boolean | null
          is_timed?: boolean | null
          is_unilateral?: boolean | null
          name?: string
          primary_muscle?: string | null
          primary_muscles?: string[] | null
          quality_score?: number | null
          secondary_muscles?: string[] | null
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_date: string
          metric_type: string
          notes: string | null
          source: string | null
          unit: string
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_date: string
          metric_type: string
          notes?: string | null
          source?: string | null
          unit: string
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_date?: string
          metric_type?: string
          notes?: string | null
          source?: string | null
          unit?: string
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          created_at: string | null
          external_user_id: string | null
          id: string
          last_poll_at: string | null
          last_webhook_at: string | null
          metadata: Json | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          strava_athlete_id: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          webhook_subscription_id: number | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          external_user_id?: string | null
          id?: string
          last_poll_at?: string | null
          last_webhook_at?: string | null
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          strava_athlete_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          webhook_subscription_id?: number | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          external_user_id?: string | null
          id?: string
          last_poll_at?: string | null
          last_webhook_at?: string | null
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          strava_athlete_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_subscription_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          body_part: string | null
          body_side: string | null
          content: string
          created_at: string | null
          entry_date: string | null
          entry_type: string
          id: string
          injury_status: string | null
          severity: number | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string
          workout_id: string | null
        }
        Insert: {
          body_part?: string | null
          body_side?: string | null
          content: string
          created_at?: string | null
          entry_date?: string | null
          entry_type: string
          id?: string
          injury_status?: string | null
          severity?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          workout_id?: string | null
        }
        Update: {
          body_part?: string | null
          body_side?: string | null
          content?: string
          created_at?: string | null
          entry_date?: string | null
          entry_type?: string
          id?: string
          injury_status?: string | null
          severity?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_screens: {
        Row: {
          active_slr_left: number | null
          active_slr_right: number | null
          created_at: string | null
          deep_squat: number | null
          hurdle_step_left: number | null
          hurdle_step_right: number | null
          id: string
          inline_lunge_left: number | null
          inline_lunge_right: number | null
          notes: string | null
          rotary_stability_left: number | null
          rotary_stability_right: number | null
          screen_date: string
          shoulder_mobility_left: number | null
          shoulder_mobility_right: number | null
          single_leg_stand_left_eyes_closed: number | null
          single_leg_stand_left_eyes_open: number | null
          single_leg_stand_right_eyes_closed: number | null
          single_leg_stand_right_eyes_open: number | null
          tandem_stance_seconds: number | null
          total_score: number | null
          trunk_stability_pushup: number | null
          user_id: string
        }
        Insert: {
          active_slr_left?: number | null
          active_slr_right?: number | null
          created_at?: string | null
          deep_squat?: number | null
          hurdle_step_left?: number | null
          hurdle_step_right?: number | null
          id?: string
          inline_lunge_left?: number | null
          inline_lunge_right?: number | null
          notes?: string | null
          rotary_stability_left?: number | null
          rotary_stability_right?: number | null
          screen_date: string
          shoulder_mobility_left?: number | null
          shoulder_mobility_right?: number | null
          single_leg_stand_left_eyes_closed?: number | null
          single_leg_stand_left_eyes_open?: number | null
          single_leg_stand_right_eyes_closed?: number | null
          single_leg_stand_right_eyes_open?: number | null
          tandem_stance_seconds?: number | null
          total_score?: number | null
          trunk_stability_pushup?: number | null
          user_id: string
        }
        Update: {
          active_slr_left?: number | null
          active_slr_right?: number | null
          created_at?: string | null
          deep_squat?: number | null
          hurdle_step_left?: number | null
          hurdle_step_right?: number | null
          id?: string
          inline_lunge_left?: number | null
          inline_lunge_right?: number | null
          notes?: string | null
          rotary_stability_left?: number | null
          rotary_stability_right?: number | null
          screen_date?: string
          shoulder_mobility_left?: number | null
          shoulder_mobility_right?: number | null
          single_leg_stand_left_eyes_closed?: number | null
          single_leg_stand_left_eyes_open?: number | null
          single_leg_stand_right_eyes_closed?: number | null
          single_leg_stand_right_eyes_open?: number | null
          tandem_stance_seconds?: number | null
          total_score?: number | null
          trunk_stability_pushup?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_screens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_foods: {
        Row: {
          brand: string | null
          calories: number | null
          carbs_g: number | null
          created_at: string | null
          fat_g: number | null
          fiber_g: number | null
          food_name: string
          id: string
          meal_type: string
          nutrition_log_id: string
          photo_url: string | null
          protein_g: number | null
          serving_size: number | null
          serving_unit: string | null
          sodium_mg: number | null
          source: string | null
        }
        Insert: {
          brand?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name: string
          id?: string
          meal_type: string
          nutrition_log_id: string
          photo_url?: string | null
          protein_g?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          sodium_mg?: number | null
          source?: string | null
        }
        Update: {
          brand?: string | null
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string
          id?: string
          meal_type?: string
          nutrition_log_id?: string
          photo_url?: string | null
          protein_g?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          sodium_mg?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_foods_nutrition_log_id_fkey"
            columns: ["nutrition_log_id"]
            isOneToOne: false
            referencedRelation: "nutrition_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          created_at: string | null
          id: string
          log_date: string
          notes: string | null
          total_calories: number | null
          total_carbs_g: number | null
          total_fat_g: number | null
          total_fiber_g: number | null
          total_protein_g: number | null
          total_sodium_mg: number | null
          updated_at: string | null
          user_id: string
          water_oz: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          log_date: string
          notes?: string | null
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_fiber_g?: number | null
          total_protein_g?: number | null
          total_sodium_mg?: number | null
          updated_at?: string | null
          user_id: string
          water_oz?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_fiber_g?: number | null
          total_protein_g?: number | null
          total_sodium_mg?: number | null
          updated_at?: string | null
          user_id?: string
          water_oz?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assessments: {
        Row: {
          assessment_date: string
          assessment_type: string
          assessment_week: number
          completed: boolean | null
          created_at: string | null
          id: string
          notes: string | null
          plan_id: string
          results: Json | null
          tests: Json
          updated_at: string | null
        }
        Insert: {
          assessment_date: string
          assessment_type: string
          assessment_week: number
          completed?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          results?: Json | null
          tests?: Json
          updated_at?: string | null
        }
        Update: {
          assessment_date?: string
          assessment_type?: string
          assessment_week?: number
          completed?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          results?: Json | null
          tests?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_assessments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_events: {
        Row: {
          blocks_training: boolean | null
          created_at: string | null
          distance_miles: number | null
          elevation_ft: number | null
          end_date: string | null
          event_date: string
          event_type: string
          expected_duration_hours: number | null
          external_url: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          plan_id: string
          priority: string | null
          recovery_days: number | null
          sport: string | null
          taper_days: number | null
          updated_at: string | null
        }
        Insert: {
          blocks_training?: boolean | null
          created_at?: string | null
          distance_miles?: number | null
          elevation_ft?: number | null
          end_date?: string | null
          event_date: string
          event_type: string
          expected_duration_hours?: number | null
          external_url?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          plan_id: string
          priority?: string | null
          recovery_days?: number | null
          sport?: string | null
          taper_days?: number | null
          updated_at?: string | null
        }
        Update: {
          blocks_training?: boolean | null
          created_at?: string | null
          distance_miles?: number | null
          elevation_ft?: number | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          expected_duration_hours?: number | null
          external_url?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          plan_id?: string
          priority?: string | null
          recovery_days?: number | null
          sport?: string | null
          taper_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_mode_config: {
        Row: {
          auto_generate_weeks: number | null
          conversion_reason: string | null
          converted_at: string | null
          converted_from: string | null
          created_at: string | null
          peak_readiness_target: number | null
          plan_id: string
          plan_mode: string
          regenerate_threshold: number | null
          rolling_cycle: Json | null
          rolling_phase_durations: Json | null
          taper_volume_reduction: number | null
          taper_weeks: number | null
          target_event_date: string | null
          target_event_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_generate_weeks?: number | null
          conversion_reason?: string | null
          converted_at?: string | null
          converted_from?: string | null
          created_at?: string | null
          peak_readiness_target?: number | null
          plan_id: string
          plan_mode?: string
          regenerate_threshold?: number | null
          rolling_cycle?: Json | null
          rolling_phase_durations?: Json | null
          taper_volume_reduction?: number | null
          taper_weeks?: number | null
          target_event_date?: string | null
          target_event_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_generate_weeks?: number | null
          conversion_reason?: string | null
          converted_at?: string | null
          converted_from?: string | null
          created_at?: string | null
          peak_readiness_target?: number | null
          plan_id?: string
          plan_mode?: string
          regenerate_threshold?: number | null
          rolling_cycle?: Json | null
          rolling_phase_durations?: Json | null
          taper_volume_reduction?: number | null
          taper_weeks?: number | null
          target_event_date?: string | null
          target_event_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_mode_config_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_mode_config_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "plan_events"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_recommendations: {
        Row: {
          applied_at: string | null
          confidence_score: number | null
          created_at: string | null
          evidence_summary: Json | null
          expires_at: string | null
          id: string
          modified_changes: Json | null
          plan_id: string
          priority: number | null
          projected_impact: Json | null
          proposed_changes: Json
          reasoning: string
          recommendation_type: string
          responded_at: string | null
          scope: string
          status: string | null
          target_phase_id: string | null
          target_week_id: string | null
          target_workout_id: string | null
          trigger_data: Json
          trigger_date: string | null
          trigger_type: string
          updated_at: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          applied_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_summary?: Json | null
          expires_at?: string | null
          id?: string
          modified_changes?: Json | null
          plan_id: string
          priority?: number | null
          projected_impact?: Json | null
          proposed_changes: Json
          reasoning: string
          recommendation_type: string
          responded_at?: string | null
          scope: string
          status?: string | null
          target_phase_id?: string | null
          target_week_id?: string | null
          target_workout_id?: string | null
          trigger_data?: Json
          trigger_date?: string | null
          trigger_type: string
          updated_at?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          applied_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_summary?: Json | null
          expires_at?: string | null
          id?: string
          modified_changes?: Json | null
          plan_id?: string
          priority?: number | null
          projected_impact?: Json | null
          proposed_changes?: Json
          reasoning?: string
          recommendation_type?: string
          responded_at?: string | null
          scope?: string
          status?: string | null
          target_phase_id?: string | null
          target_week_id?: string | null
          target_workout_id?: string | null
          trigger_data?: Json
          trigger_date?: string | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_recommendations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_recommendations_target_phase_id_fkey"
            columns: ["target_phase_id"]
            isOneToOne: false
            referencedRelation: "training_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_recommendations_target_week_id_fkey"
            columns: ["target_week_id"]
            isOneToOne: false
            referencedRelation: "weekly_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_recommendations_target_workout_id_fkey"
            columns: ["target_workout_id"]
            isOneToOne: false
            referencedRelation: "suggested_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      power_tests: {
        Row: {
          bench_mean_velocity_mps: number | null
          broad_jump_inches: number | null
          created_at: string | null
          equipment_used: string | null
          id: string
          notes: string | null
          reactive_strength_index: number | null
          sprint_10m_seconds: number | null
          sprint_20m_seconds: number | null
          sprint_40m_seconds: number | null
          squat_mean_velocity_mps: number | null
          test_conditions: string | null
          test_date: string
          user_id: string
          vertical_jump_inches: number | null
        }
        Insert: {
          bench_mean_velocity_mps?: number | null
          broad_jump_inches?: number | null
          created_at?: string | null
          equipment_used?: string | null
          id?: string
          notes?: string | null
          reactive_strength_index?: number | null
          sprint_10m_seconds?: number | null
          sprint_20m_seconds?: number | null
          sprint_40m_seconds?: number | null
          squat_mean_velocity_mps?: number | null
          test_conditions?: string | null
          test_date: string
          user_id: string
          vertical_jump_inches?: number | null
        }
        Update: {
          bench_mean_velocity_mps?: number | null
          broad_jump_inches?: number | null
          created_at?: string | null
          equipment_used?: string | null
          id?: string
          notes?: string | null
          reactive_strength_index?: number | null
          sprint_10m_seconds?: number | null
          sprint_20m_seconds?: number | null
          sprint_40m_seconds?: number | null
          squat_mean_velocity_mps?: number | null
          test_conditions?: string | null
          test_date?: string
          user_id?: string
          vertical_jump_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "power_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_coach_model: string | null
          ai_coach_personality: string | null
          available_equipment: string[] | null
          avatar_url: string | null
          biological_sex: string | null
          calendar_enabled: boolean | null
          calendar_token: string | null
          calorie_target: number | null
          carb_target_g: number | null
          created_at: string | null
          date_of_birth: string | null
          eightsleep_access_token: string | null
          eightsleep_refresh_token: string | null
          eightsleep_token_expires_at: string | null
          eightsleep_user_id: string | null
          email: string | null
          experience_level: string | null
          fat_target_g: number | null
          ftp_watts: number | null
          full_name: string | null
          grip_strength_date: string | null
          grip_strength_left_lbs: number | null
          grip_strength_right_lbs: number | null
          id: string
          lthr_bpm: number | null
          max_hr: number | null
          max_hr_bpm: number | null
          polarized_training_enabled: boolean | null
          protein_target_g: number | null
          resting_hr: number | null
          resting_hr_baseline: number | null
          target_high_intensity_pct: number | null
          target_low_intensity_pct: number | null
          threshold_pace_min_mile: number | null
          training_start_date: string | null
          updated_at: string | null
          vo2max_estimation_method: string | null
          vo2max_measured_date: string | null
          vo2max_ml_kg_min: number | null
          weather_lat: number | null
          weather_location_name: string | null
          weather_lon: number | null
          weather_zip_code: string | null
        }
        Insert: {
          ai_coach_model?: string | null
          ai_coach_personality?: string | null
          available_equipment?: string[] | null
          avatar_url?: string | null
          biological_sex?: string | null
          calendar_enabled?: boolean | null
          calendar_token?: string | null
          calorie_target?: number | null
          carb_target_g?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          eightsleep_access_token?: string | null
          eightsleep_refresh_token?: string | null
          eightsleep_token_expires_at?: string | null
          eightsleep_user_id?: string | null
          email?: string | null
          experience_level?: string | null
          fat_target_g?: number | null
          ftp_watts?: number | null
          full_name?: string | null
          grip_strength_date?: string | null
          grip_strength_left_lbs?: number | null
          grip_strength_right_lbs?: number | null
          id: string
          lthr_bpm?: number | null
          max_hr?: number | null
          max_hr_bpm?: number | null
          polarized_training_enabled?: boolean | null
          protein_target_g?: number | null
          resting_hr?: number | null
          resting_hr_baseline?: number | null
          target_high_intensity_pct?: number | null
          target_low_intensity_pct?: number | null
          threshold_pace_min_mile?: number | null
          training_start_date?: string | null
          updated_at?: string | null
          vo2max_estimation_method?: string | null
          vo2max_measured_date?: string | null
          vo2max_ml_kg_min?: number | null
          weather_lat?: number | null
          weather_location_name?: string | null
          weather_lon?: number | null
          weather_zip_code?: string | null
        }
        Update: {
          ai_coach_model?: string | null
          ai_coach_personality?: string | null
          available_equipment?: string[] | null
          avatar_url?: string | null
          biological_sex?: string | null
          calendar_enabled?: boolean | null
          calendar_token?: string | null
          calorie_target?: number | null
          carb_target_g?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          eightsleep_access_token?: string | null
          eightsleep_refresh_token?: string | null
          eightsleep_token_expires_at?: string | null
          eightsleep_user_id?: string | null
          email?: string | null
          experience_level?: string | null
          fat_target_g?: number | null
          ftp_watts?: number | null
          full_name?: string | null
          grip_strength_date?: string | null
          grip_strength_left_lbs?: number | null
          grip_strength_right_lbs?: number | null
          id?: string
          lthr_bpm?: number | null
          max_hr?: number | null
          max_hr_bpm?: number | null
          polarized_training_enabled?: boolean | null
          protein_target_g?: number | null
          resting_hr?: number | null
          resting_hr_baseline?: number | null
          target_high_intensity_pct?: number | null
          target_low_intensity_pct?: number | null
          threshold_pace_min_mile?: number | null
          training_start_date?: string | null
          updated_at?: string | null
          vo2max_estimation_method?: string | null
          vo2max_measured_date?: string | null
          vo2max_ml_kg_min?: number | null
          weather_lat?: number | null
          weather_location_name?: string | null
          weather_lon?: number | null
          weather_zip_code?: string | null
        }
        Relationships: []
      }
      readiness_assessments: {
        Row: {
          adjustment_factor: number | null
          assessment_date: string
          atl_value: number | null
          calculated_readiness_score: number | null
          created_at: string | null
          ctl_value: number | null
          grip_strength_lbs: number | null
          hrv_reading: number | null
          id: string
          notes: string | null
          recommended_intensity: string | null
          resting_hr: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          subjective_readiness: number
          tsb_value: number | null
          user_id: string
          vertical_jump_inches: number | null
        }
        Insert: {
          adjustment_factor?: number | null
          assessment_date: string
          atl_value?: number | null
          calculated_readiness_score?: number | null
          created_at?: string | null
          ctl_value?: number | null
          grip_strength_lbs?: number | null
          hrv_reading?: number | null
          id?: string
          notes?: string | null
          recommended_intensity?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          subjective_readiness: number
          tsb_value?: number | null
          user_id: string
          vertical_jump_inches?: number | null
        }
        Update: {
          adjustment_factor?: number | null
          assessment_date?: string
          atl_value?: number | null
          calculated_readiness_score?: number | null
          created_at?: string | null
          ctl_value?: number | null
          grip_strength_lbs?: number | null
          hrv_reading?: number | null
          id?: string
          notes?: string | null
          recommended_intensity?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          subjective_readiness?: number
          tsb_value?: number | null
          user_id?: string
          vertical_jump_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "readiness_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_baselines: {
        Row: {
          avg_grip_strength_lbs: number | null
          avg_hrv: number | null
          avg_resting_hr: number | null
          avg_sleep_hours: number | null
          avg_vertical_jump_inches: number | null
          grip_sample_count: number | null
          hrv_sample_count: number | null
          jump_sample_count: number | null
          last_updated: string | null
          std_grip_strength: number | null
          std_hrv: number | null
          std_vertical_jump: number | null
          user_id: string
        }
        Insert: {
          avg_grip_strength_lbs?: number | null
          avg_hrv?: number | null
          avg_resting_hr?: number | null
          avg_sleep_hours?: number | null
          avg_vertical_jump_inches?: number | null
          grip_sample_count?: number | null
          hrv_sample_count?: number | null
          jump_sample_count?: number | null
          last_updated?: string | null
          std_grip_strength?: number | null
          std_hrv?: number | null
          std_vertical_jump?: number | null
          user_id: string
        }
        Update: {
          avg_grip_strength_lbs?: number | null
          avg_hrv?: number | null
          avg_resting_hr?: number | null
          avg_sleep_hours?: number | null
          avg_vertical_jump_inches?: number | null
          grip_sample_count?: number | null
          hrv_sample_count?: number | null
          jump_sample_count?: number | null
          last_updated?: string | null
          std_grip_strength?: number | null
          std_hrv?: number | null
          std_vertical_jump?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          awake_minutes: number | null
          bedtime: string | null
          created_at: string | null
          deep_sleep_minutes: number | null
          hrv_avg: number | null
          id: string
          light_sleep_minutes: number | null
          log_date: string
          notes: string | null
          recovery_score: number | null
          rem_sleep_minutes: number | null
          respiratory_rate: number | null
          resting_hr: number | null
          sleep_score: number | null
          source: string | null
          time_in_bed_minutes: number | null
          total_sleep_minutes: number | null
          updated_at: string | null
          user_id: string
          wake_time: string | null
        }
        Insert: {
          awake_minutes?: number | null
          bedtime?: string | null
          created_at?: string | null
          deep_sleep_minutes?: number | null
          hrv_avg?: number | null
          id?: string
          light_sleep_minutes?: number | null
          log_date: string
          notes?: string | null
          recovery_score?: number | null
          rem_sleep_minutes?: number | null
          respiratory_rate?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          source?: string | null
          time_in_bed_minutes?: number | null
          total_sleep_minutes?: number | null
          updated_at?: string | null
          user_id: string
          wake_time?: string | null
        }
        Update: {
          awake_minutes?: number | null
          bedtime?: string | null
          created_at?: string | null
          deep_sleep_minutes?: number | null
          hrv_avg?: number | null
          id?: string
          light_sleep_minutes?: number | null
          log_date?: string
          notes?: string | null
          recovery_score?: number | null
          rem_sleep_minutes?: number | null
          respiratory_rate?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          source?: string | null
          time_in_bed_minutes?: number | null
          total_sleep_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          wake_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_activity_links: {
        Row: {
          id: string
          strava_activity_id: number
          sync_direction: string
          synced_at: string | null
          user_id: string
          workout_id: string
        }
        Insert: {
          id?: string
          strava_activity_id: number
          sync_direction: string
          synced_at?: string | null
          user_id: string
          workout_id: string
        }
        Update: {
          id?: string
          strava_activity_id?: number
          sync_direction?: string
          synced_at?: string | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_activity_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strava_activity_links_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_webhook_events: {
        Row: {
          aspect_type: string
          created_at: string | null
          error: string | null
          id: string
          object_id: number
          object_type: string
          owner_id: number
          processed: boolean | null
          processed_at: string | null
          subscription_id: number | null
          updates: Json | null
        }
        Insert: {
          aspect_type: string
          created_at?: string | null
          error?: string | null
          id?: string
          object_id: number
          object_type: string
          owner_id: number
          processed?: boolean | null
          processed_at?: string | null
          subscription_id?: number | null
          updates?: Json | null
        }
        Update: {
          aspect_type?: string
          created_at?: string | null
          error?: string | null
          id?: string
          object_id?: number
          object_type?: string
          owner_id?: number
          processed?: boolean | null
          processed_at?: string | null
          subscription_id?: number | null
          updates?: Json | null
        }
        Relationships: []
      }
      strength_standards: {
        Row: {
          advanced_threshold: number | null
          beginner_threshold: number | null
          body_weight_class: string
          data_source: string | null
          elite_threshold: number | null
          exercise_name: string
          intermediate_threshold: number | null
          novice_threshold: number | null
          percentile_50: number | null
          percentile_75: number | null
          percentile_90: number | null
          percentile_95: number | null
          percentile_99: number | null
          sex: string
        }
        Insert: {
          advanced_threshold?: number | null
          beginner_threshold?: number | null
          body_weight_class: string
          data_source?: string | null
          elite_threshold?: number | null
          exercise_name: string
          intermediate_threshold?: number | null
          novice_threshold?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          percentile_95?: number | null
          percentile_99?: number | null
          sex: string
        }
        Update: {
          advanced_threshold?: number | null
          beginner_threshold?: number | null
          body_weight_class?: string
          data_source?: string | null
          elite_threshold?: number | null
          exercise_name?: string
          intermediate_threshold?: number | null
          novice_threshold?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          percentile_95?: number | null
          percentile_99?: number | null
          sex?: string
        }
        Relationships: []
      }
      suggested_workouts: {
        Row: {
          adjustment_factor: number | null
          cardio_structure: Json | null
          category: string
          cooldown_exercises: Json | null
          created_at: string | null
          day_of_week: string | null
          description: string | null
          exercises: Json | null
          id: string
          name: string
          order_in_day: number | null
          original_intensity: string | null
          phase_id: string | null
          plan_id: string
          planned_duration_minutes: number | null
          planned_tss: number | null
          primary_intensity: string | null
          readiness_adjusted: boolean | null
          scheduled_workout_id: string | null
          status: string | null
          substitution_reason: string | null
          suggested_date: string
          updated_at: string | null
          warmup_exercises: Json | null
          week_number: number | null
          workout_type: string
        }
        Insert: {
          adjustment_factor?: number | null
          cardio_structure?: Json | null
          category: string
          cooldown_exercises?: Json | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          exercises?: Json | null
          id?: string
          name: string
          order_in_day?: number | null
          original_intensity?: string | null
          phase_id?: string | null
          plan_id: string
          planned_duration_minutes?: number | null
          planned_tss?: number | null
          primary_intensity?: string | null
          readiness_adjusted?: boolean | null
          scheduled_workout_id?: string | null
          status?: string | null
          substitution_reason?: string | null
          suggested_date: string
          updated_at?: string | null
          warmup_exercises?: Json | null
          week_number?: number | null
          workout_type: string
        }
        Update: {
          adjustment_factor?: number | null
          cardio_structure?: Json | null
          category?: string
          cooldown_exercises?: Json | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          exercises?: Json | null
          id?: string
          name?: string
          order_in_day?: number | null
          original_intensity?: string | null
          phase_id?: string | null
          plan_id?: string
          planned_duration_minutes?: number | null
          planned_tss?: number | null
          primary_intensity?: string | null
          readiness_adjusted?: boolean | null
          scheduled_workout_id?: string | null
          status?: string | null
          substitution_reason?: string | null
          suggested_date?: string
          updated_at?: string | null
          warmup_exercises?: Json | null
          week_number?: number | null
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_workouts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "training_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_workouts_scheduled_workout_id_fkey"
            columns: ["scheduled_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_logs: {
        Row: {
          created_at: string | null
          id: string
          log_date: string
          notes: string | null
          supplement_id: string
          taken: boolean
          time_taken: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          log_date: string
          notes?: string | null
          supplement_id: string
          taken?: boolean
          time_taken?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          supplement_id?: string
          taken?: boolean
          time_taken?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplement_logs_supplement_id_fkey"
            columns: ["supplement_id"]
            isOneToOne: false
            referencedRelation: "supplements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplement_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplements: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          cycle_off_days: number | null
          cycle_on_days: number | null
          dosage: string | null
          dosage_unit: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          reason: string | null
          start_date: string | null
          time_of_day: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          dosage?: string | null
          dosage_unit?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          reason?: string | null
          start_date?: string | null
          time_of_day?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          dosage?: string | null
          dosage_unit?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          reason?: string | null
          start_date?: string | null
          time_of_day?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technique_assessments: {
        Row: {
          areas_for_improvement: string[] | null
          assessed_by: string | null
          assessment_date: string
          coach_notes: string | null
          created_at: string | null
          cues_to_focus: string[] | null
          exercise_id: string | null
          exercise_name: string
          id: string
          strengths: string[] | null
          technique_rating: number
          user_id: string
          video_url: string | null
        }
        Insert: {
          areas_for_improvement?: string[] | null
          assessed_by?: string | null
          assessment_date: string
          coach_notes?: string | null
          created_at?: string | null
          cues_to_focus?: string[] | null
          exercise_id?: string | null
          exercise_name: string
          id?: string
          strengths?: string[] | null
          technique_rating: number
          user_id: string
          video_url?: string | null
        }
        Update: {
          areas_for_improvement?: string[] | null
          assessed_by?: string | null
          assessment_date?: string
          coach_notes?: string | null
          created_at?: string | null
          cues_to_focus?: string[] | null
          exercise_id?: string | null
          exercise_name?: string
          id?: string
          strengths?: string[] | null
          technique_rating?: number
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technique_assessments_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technique_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threshold_history: {
        Row: {
          activity_id: string | null
          conditions: string | null
          confidence_level: string | null
          created_at: string | null
          ftp_watts: number | null
          id: string
          lthr_bpm: number | null
          notes: string | null
          protocol_followed: boolean | null
          source: string | null
          test_date: string
          test_type: string | null
          threshold_pace_min_km: number | null
          threshold_pace_min_mile: number | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          conditions?: string | null
          confidence_level?: string | null
          created_at?: string | null
          ftp_watts?: number | null
          id?: string
          lthr_bpm?: number | null
          notes?: string | null
          protocol_followed?: boolean | null
          source?: string | null
          test_date: string
          test_type?: string | null
          threshold_pace_min_km?: number | null
          threshold_pace_min_mile?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          conditions?: string | null
          confidence_level?: string | null
          created_at?: string | null
          ftp_watts?: number | null
          id?: string
          lthr_bpm?: number | null
          notes?: string | null
          protocol_followed?: boolean | null
          source?: string | null
          test_date?: string
          test_type?: string | null
          threshold_pace_min_km?: number | null
          threshold_pace_min_mile?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threshold_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_load_history: {
        Row: {
          atl: number | null
          created_at: string | null
          ctl: number | null
          id: string
          log_date: string
          monotony: number | null
          session_rpe_avg: number | null
          strain: number | null
          total_duration_minutes: number | null
          total_tss: number | null
          training_load: number | null
          tsb: number | null
          updated_at: string | null
          user_id: string
          zone_1_seconds: number | null
          zone_2_seconds: number | null
          zone_3_seconds: number | null
          zone_4_seconds: number | null
          zone_5_seconds: number | null
        }
        Insert: {
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          id?: string
          log_date: string
          monotony?: number | null
          session_rpe_avg?: number | null
          strain?: number | null
          total_duration_minutes?: number | null
          total_tss?: number | null
          training_load?: number | null
          tsb?: number | null
          updated_at?: string | null
          user_id: string
          zone_1_seconds?: number | null
          zone_2_seconds?: number | null
          zone_3_seconds?: number | null
          zone_4_seconds?: number | null
          zone_5_seconds?: number | null
        }
        Update: {
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          id?: string
          log_date?: string
          monotony?: number | null
          session_rpe_avg?: number | null
          strain?: number | null
          total_duration_minutes?: number | null
          total_tss?: number | null
          training_load?: number | null
          tsb?: number | null
          updated_at?: string | null
          user_id?: string
          zone_1_seconds?: number | null
          zone_2_seconds?: number | null
          zone_3_seconds?: number | null
          zone_4_seconds?: number | null
          zone_5_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_load_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_phases: {
        Row: {
          activity_distribution: Json | null
          adaptation_history: Json | null
          completion_metrics: Json | null
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          intensity_focus: string | null
          intensity_modifier: number | null
          name: string
          notes: string | null
          order_index: number
          original_end_date: string | null
          phase_type: string
          plan_id: string
          start_date: string
          updated_at: string | null
          volume_modifier: number | null
        }
        Insert: {
          activity_distribution?: Json | null
          adaptation_history?: Json | null
          completion_metrics?: Json | null
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          intensity_focus?: string | null
          intensity_modifier?: number | null
          name: string
          notes?: string | null
          order_index: number
          original_end_date?: string | null
          phase_type: string
          plan_id: string
          start_date: string
          updated_at?: string | null
          volume_modifier?: number | null
        }
        Update: {
          activity_distribution?: Json | null
          adaptation_history?: Json | null
          completion_metrics?: Json | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          intensity_focus?: string | null
          intensity_modifier?: number | null
          name?: string
          notes?: string | null
          order_index?: number
          original_end_date?: string | null
          phase_type?: string
          plan_id?: string
          start_date?: string
          updated_at?: string | null
          volume_modifier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_phases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          ai_generated: boolean | null
          ai_prompt: string | null
          athlete_profile_snapshot: Json | null
          coaching_notes: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          exercise_substitutions: Json | null
          goal: string | null
          goal_pathway: Json | null
          id: string
          last_adaptation_eval: string | null
          name: string
          pending_recommendations_count: number | null
          plan_mode: string | null
          primary_sport: string | null
          program_philosophy: string | null
          recovery_protocols: Json | null
          start_date: string
          status: string | null
          updated_at: string | null
          user_id: string
          weekly_hours_target: number | null
        }
        Insert: {
          ai_generated?: boolean | null
          ai_prompt?: string | null
          athlete_profile_snapshot?: Json | null
          coaching_notes?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          exercise_substitutions?: Json | null
          goal?: string | null
          goal_pathway?: Json | null
          id?: string
          last_adaptation_eval?: string | null
          name: string
          pending_recommendations_count?: number | null
          plan_mode?: string | null
          primary_sport?: string | null
          program_philosophy?: string | null
          recovery_protocols?: Json | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          weekly_hours_target?: number | null
        }
        Update: {
          ai_generated?: boolean | null
          ai_prompt?: string | null
          athlete_profile_snapshot?: Json | null
          coaching_notes?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          exercise_substitutions?: Json | null
          goal?: string | null
          goal_pathway?: Json | null
          id?: string
          last_adaptation_eval?: string | null
          name?: string
          pending_recommendations_count?: number | null
          plan_mode?: string | null
          primary_sport?: string | null
          program_philosophy?: string | null
          recovery_protocols?: Json | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_hours_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_adaptation_goals: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          primary_adaptation: string
          priorities: Json | null
          secondary_adaptation: string | null
          tertiary_adaptation: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          primary_adaptation: string
          priorities?: Json | null
          secondary_adaptation?: string | null
          tertiary_adaptation?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          primary_adaptation?: string
          priorities?: Json | null
          secondary_adaptation?: string | null
          tertiary_adaptation?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_adaptation_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vo2max_tests: {
        Row: {
          age_at_test: number | null
          altitude_ft: number | null
          conditions: string | null
          created_at: string | null
          distance_meters: number | null
          duration_seconds: number | null
          estimated_vo2max: number
          final_heart_rate: number | null
          id: string
          notes: string | null
          recovery_heart_rate: number | null
          temperature_f: number | null
          test_date: string
          test_type: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age_at_test?: number | null
          altitude_ft?: number | null
          conditions?: string | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          estimated_vo2max: number
          final_heart_rate?: number | null
          id?: string
          notes?: string | null
          recovery_heart_rate?: number | null
          temperature_f?: number | null
          test_date: string
          test_type: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age_at_test?: number | null
          altitude_ft?: number | null
          conditions?: string | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          estimated_vo2max?: number
          final_heart_rate?: number | null
          id?: string
          notes?: string | null
          recovery_heart_rate?: number | null
          temperature_f?: number | null
          test_date?: string
          test_type?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vo2max_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_targets: {
        Row: {
          actual_hours: number | null
          actual_tss: number | null
          adaptation_adjustments: Json | null
          compliance_percentage: number | null
          created_at: string | null
          cycling_hours: number | null
          daily_structure: Json | null
          id: string
          lifting_sessions: number | null
          notes: string | null
          other_hours: number | null
          phase_id: string
          running_hours: number | null
          swimming_hours: number | null
          target_hours: number | null
          target_tss: number | null
          updated_at: string | null
          week_number: number
          week_start_date: string
          week_type: string | null
          zone_distribution: Json | null
        }
        Insert: {
          actual_hours?: number | null
          actual_tss?: number | null
          adaptation_adjustments?: Json | null
          compliance_percentage?: number | null
          created_at?: string | null
          cycling_hours?: number | null
          daily_structure?: Json | null
          id?: string
          lifting_sessions?: number | null
          notes?: string | null
          other_hours?: number | null
          phase_id: string
          running_hours?: number | null
          swimming_hours?: number | null
          target_hours?: number | null
          target_tss?: number | null
          updated_at?: string | null
          week_number: number
          week_start_date: string
          week_type?: string | null
          zone_distribution?: Json | null
        }
        Update: {
          actual_hours?: number | null
          actual_tss?: number | null
          adaptation_adjustments?: Json | null
          compliance_percentage?: number | null
          created_at?: string | null
          cycling_hours?: number | null
          daily_structure?: Json | null
          id?: string
          lifting_sessions?: number | null
          notes?: string | null
          other_hours?: number | null
          phase_id?: string
          running_hours?: number | null
          swimming_hours?: number | null
          target_hours?: number | null
          target_tss?: number | null
          updated_at?: string | null
          week_number?: number
          week_start_date?: string
          week_type?: string | null
          zone_distribution?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "training_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          body_fat_pct: number | null
          created_at: string | null
          id: string
          log_date: string
          notes: string | null
          user_id: string
          weight_lbs: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string | null
          id?: string
          log_date: string
          notes?: string | null
          user_id: string
          weight_lbs: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          user_id?: string
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string | null
          id: string
          item: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          item?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string | null
          exercise_name: string | null
          id: string
          notes: string | null
          order_index: number
          rest_seconds: number | null
          superset_group: string | null
          workout_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          notes?: string | null
          order_index: number
          rest_seconds?: number | null
          superset_group?: string | null
          workout_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          rest_seconds?: number | null
          superset_group?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          estimated_duration_min: number | null
          exercises: Json
          id: string
          is_favorite: boolean | null
          is_system: boolean | null
          last_used_at: string | null
          name: string
          times_used: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          estimated_duration_min?: number | null
          exercises: Json
          id?: string
          is_favorite?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name: string
          times_used?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          estimated_duration_min?: number | null
          exercises?: Json
          id?: string
          is_favorite?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name?: string
          times_used?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_zones: {
        Row: {
          id: string
          workout_id: string
          zone_1_seconds: number | null
          zone_2_seconds: number | null
          zone_3_seconds: number | null
          zone_4_seconds: number | null
          zone_5_seconds: number | null
          zone_6_seconds: number | null
          zone_7_seconds: number | null
          zone_type: string
        }
        Insert: {
          id?: string
          workout_id: string
          zone_1_seconds?: number | null
          zone_2_seconds?: number | null
          zone_3_seconds?: number | null
          zone_4_seconds?: number | null
          zone_5_seconds?: number | null
          zone_6_seconds?: number | null
          zone_7_seconds?: number | null
          zone_type: string
        }
        Update: {
          id?: string
          workout_id?: string
          zone_1_seconds?: number | null
          zone_2_seconds?: number | null
          zone_3_seconds?: number | null
          zone_4_seconds?: number | null
          zone_5_seconds?: number | null
          zone_6_seconds?: number | null
          zone_7_seconds?: number | null
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_zones_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          actual_avg_hr: number | null
          actual_avg_power: number | null
          actual_calories: number | null
          actual_distance_miles: number | null
          actual_duration_minutes: number | null
          actual_elevation_ft: number | null
          actual_max_hr: number | null
          actual_np: number | null
          actual_tss: number | null
          avg_heart_rate: number | null
          avg_pace_per_mile: string | null
          avg_power_watts: number | null
          category: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          exercises: Json | null
          external_id: string | null
          external_url: string | null
          id: string
          max_heart_rate: number | null
          max_power_watts: number | null
          name: string | null
          notes: string | null
          perceived_exertion: number | null
          planned_duration_minutes: number | null
          planned_intensity: string | null
          planned_tss: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          session_rpe: number | null
          source: string | null
          status: string | null
          training_load: number | null
          updated_at: string | null
          user_id: string
          workout_type: string
        }
        Insert: {
          actual_avg_hr?: number | null
          actual_avg_power?: number | null
          actual_calories?: number | null
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          actual_elevation_ft?: number | null
          actual_max_hr?: number | null
          actual_np?: number | null
          actual_tss?: number | null
          avg_heart_rate?: number | null
          avg_pace_per_mile?: string | null
          avg_power_watts?: number | null
          category: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          exercises?: Json | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          max_heart_rate?: number | null
          max_power_watts?: number | null
          name?: string | null
          notes?: string | null
          perceived_exertion?: number | null
          planned_duration_minutes?: number | null
          planned_intensity?: string | null
          planned_tss?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          session_rpe?: number | null
          source?: string | null
          status?: string | null
          training_load?: number | null
          updated_at?: string | null
          user_id: string
          workout_type: string
        }
        Update: {
          actual_avg_hr?: number | null
          actual_avg_power?: number | null
          actual_calories?: number | null
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          actual_elevation_ft?: number | null
          actual_max_hr?: number | null
          actual_np?: number | null
          actual_tss?: number | null
          avg_heart_rate?: number | null
          avg_pace_per_mile?: string | null
          avg_power_watts?: number | null
          category?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          exercises?: Json | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          max_heart_rate?: number | null
          max_power_watts?: number | null
          name?: string | null
          notes?: string | null
          perceived_exertion?: number | null
          planned_duration_minutes?: number | null
          planned_intensity?: string | null
          planned_tss?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          session_rpe?: number | null
          source?: string | null
          status?: string | null
          training_load?: number | null
          updated_at?: string | null
          user_id?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_old_recommendations: { Args: never; Returns: number }
      get_weekly_compliance: {
        Args: { p_user_id: string; p_week_start?: string }
        Returns: Json
      }
      search_exercises: {
        Args: {
          equipment_filter?: string
          muscle_filter?: string
          result_limit?: number
          search_term: string
        }
        Returns: {
          body_part: string
          coaching_cues: string[]
          common_mistakes: string[]
          description: string
          difficulty: string
          equipment: string
          external_source: string
          galpin_adaptations: string[]
          id: string
          instructions: string
          is_compound: boolean
          is_timed: boolean
          is_unilateral: boolean
          name: string
          primary_muscle: string
          rank: number
          secondary_muscles: string[]
          thumbnail_url: string
          video_url: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Helper types for convenience
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutZone = Database['public']['Tables']['workout_zones']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type ExerciseSet = Database['public']['Tables']['exercise_sets']['Row']
export type TrainingPlan = Database['public']['Tables']['training_plans']['Row']
export type TrainingPhase = Database['public']['Tables']['training_phases']['Row']
export type SuggestedWorkout = Database['public']['Tables']['suggested_workouts']['Row']
export type NutritionLog = Database['public']['Tables']['nutrition_logs']['Row']
export type NutritionFood = Database['public']['Tables']['nutrition_foods']['Row']
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row']
export type SleepLog = Database['public']['Tables']['sleep_logs']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type AdaptationSetting = Database['public']['Tables']['adaptation_settings']['Row']
export type PlanRecommendation = Database['public']['Tables']['plan_recommendations']['Row']
export type TrainingLoadHistory = Database['public']['Tables']['training_load_history']['Row']
export type ThresholdHistory = Database['public']['Tables']['threshold_history']['Row']
