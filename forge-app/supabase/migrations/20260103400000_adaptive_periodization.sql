-- Migration: Adaptive Periodization System
-- Implements plan recommendations, adaptation evaluations, plan modes, and settings
-- Enables dynamic plan adjustments at phase, week, and workout levels

-- ============================================================================
-- PLAN RECOMMENDATIONS - Central recommendation entity
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Recommendation Type & Scope
  recommendation_type TEXT NOT NULL,
  -- Phase-level: 'phase_extension', 'phase_shorten', 'phase_insert', 'phase_reorder'
  -- Week-level: 'week_volume_adjust', 'week_type_change', 'week_activity_shift', 'week_zone_adjust'
  -- Workout-level: 'workout_intensity_scale', 'workout_substitute', 'workout_reschedule', 'workout_skip'
  -- Plan-level: 'plan_convert', 'plan_pause', 'plan_resume', 'deload_trigger'

  scope TEXT NOT NULL CHECK (scope IN ('phase', 'week', 'workout', 'plan')),

  -- Trigger Information
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time', 'performance', 'event', 'readiness', 'user')),
  trigger_date TIMESTAMPTZ DEFAULT NOW(),
  trigger_data JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- time: {"trigger": "weekly_review", "week_number": 7}
  -- performance: {"tsb": -22, "compliance_rate": 0.65, "plateaued_exercises": ["squat", "bench"]}
  -- event: {"event_type": "vacation", "start_date": "2024-03-01", "end_date": "2024-03-07"}
  -- readiness: {"readiness_score": 38, "hrv_percent_baseline": 78, "sleep_hours": 5.2}

  -- Target References (depending on scope)
  target_phase_id UUID REFERENCES training_phases(id) ON DELETE SET NULL,
  target_week_id UUID REFERENCES weekly_targets(id) ON DELETE SET NULL,
  target_workout_id UUID REFERENCES suggested_workouts(id) ON DELETE SET NULL,

  -- Proposed Changes (structure depends on recommendation_type)
  proposed_changes JSONB NOT NULL,
  -- phase_extension: {"days_to_extend": 7, "new_end_date": "2024-02-15", "reason": "performance_behind"}
  -- week_volume_adjust: {"target_hours": {"current": 12, "proposed": 10}, "percent_change": -17}
  -- workout_intensity_scale: {"adjustment_factor": 0.85, "affected_exercises": ["squat", "deadlift"]}

  -- AI Reasoning
  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence_summary JSONB,
  -- {"tsb_trend": "declining", "compliance_7day": 0.72, "readiness_avg": 45, "hrv_trend": "declining"}

  -- Impact Preview
  projected_impact JSONB,
  -- {"weekly_hours_delta": -2, "tss_delta": -50, "affected_workouts": 3, "event_date_impact": null}

  -- Priority & Urgency (1 = critical/immediate, 10 = nice to have)
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  expires_at TIMESTAMPTZ, -- Recommendation no longer valid after this time

  -- User Response
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'modified', 'dismissed', 'expired', 'superseded')),
  user_notes TEXT,
  modified_changes JSONB, -- If user modified the recommendation, what they changed
  responded_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ, -- When changes were actually applied to the plan

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_recommendations_plan_status ON plan_recommendations(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_recommendations_user_pending ON plan_recommendations(user_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_plan_recommendations_scope ON plan_recommendations(plan_id, scope);
CREATE INDEX IF NOT EXISTS idx_plan_recommendations_expires ON plan_recommendations(expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- ============================================================================
-- ADAPTATION EVALUATIONS - Audit trail of engine runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS adaptation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Evaluation Context
  evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('scheduled', 'on_demand', 'event_triggered')),
  evaluation_trigger TEXT,
  -- 'weekly_review', 'phase_end', 'mid_phase', 'readiness_alert', 'compliance_alert',
  -- 'tsb_alert', 'plateau_detected', 'event_approaching', 'user_request'
  evaluation_date TIMESTAMPTZ DEFAULT NOW(),

  -- Scope evaluated
  scopes_evaluated TEXT[] DEFAULT ARRAY['phase', 'week', 'workout'],

  -- Data Snapshot at Evaluation Time
  metrics_snapshot JSONB NOT NULL,
  -- {
  --   "training_load": {"ctl": 65, "atl": 85, "tsb": -20, "acwr": 1.3},
  --   "compliance": {"hours_percent": 0.85, "tss_percent": 0.90, "activity_distribution": {...}},
  --   "phase_progress": {"current_phase": "build", "percent_complete": 0.75, "days_remaining": 7},
  --   "readiness": {"current": 58, "7day_avg": 62, "trend": "declining"},
  --   "strength_progress": {"squat": {"start": 315, "current": 330, "target": 350, "percent": 0.47}},
  --   "recovery_quality": {"sleep_avg": 6.8, "hrv_trend": "stable"}
  -- }

  -- Evaluation Results
  recommendations_generated INTEGER DEFAULT 0,
  recommendation_ids UUID[],
  no_action_reason TEXT, -- If no recommendations, explain why (e.g., "all metrics within normal range")

  -- Processing
  processing_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adaptation_evals_plan_date ON adaptation_evaluations(plan_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_adaptation_evals_user ON adaptation_evaluations(user_id, evaluation_date DESC);

-- ============================================================================
-- PLAN MODE CONFIG - Rolling vs Goal-based configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_mode_config (
  plan_id UUID PRIMARY KEY REFERENCES training_plans(id) ON DELETE CASCADE,

  -- Mode Type
  plan_mode TEXT NOT NULL DEFAULT 'rolling' CHECK (plan_mode IN ('rolling', 'goal_based')),

  -- Rolling Mode Config
  rolling_cycle JSONB,
  -- {
  --   "sequence": ["base", "build", "build", "recovery"],
  --   "repeat": true
  -- }
  rolling_phase_durations JSONB,
  -- {"base": 4, "build": 3, "recovery": 1, "peak": 2, "taper": 1, "transition": 2}
  auto_generate_weeks INTEGER DEFAULT 8, -- Generate this many weeks ahead
  regenerate_threshold INTEGER DEFAULT 4, -- Regenerate when < this many weeks remain

  -- Goal Mode Config
  target_event_id UUID REFERENCES plan_events(id) ON DELETE SET NULL,
  target_event_date DATE,
  peak_readiness_target INTEGER DEFAULT 15, -- Target TSB at event (positive = fresh)
  taper_weeks INTEGER DEFAULT 2,
  taper_volume_reduction DECIMAL(3,2) DEFAULT 0.40, -- Reduce volume by 40% during taper

  -- Conversion History
  converted_from TEXT CHECK (converted_from IN ('rolling', 'goal_based')),
  converted_at TIMESTAMPTZ,
  conversion_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ADAPTATION SETTINGS - User preferences for adaptations
-- ============================================================================

CREATE TABLE IF NOT EXISTS adaptation_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Evaluation Frequency
  auto_evaluate BOOLEAN DEFAULT TRUE,
  weekly_review_day TEXT DEFAULT 'sunday' CHECK (weekly_review_day IN ('sunday', 'monday')),
  weekly_review_enabled BOOLEAN DEFAULT TRUE,
  phase_end_evaluate BOOLEAN DEFAULT TRUE,
  mid_phase_evaluate BOOLEAN DEFAULT TRUE,

  -- Notification Preferences
  notify_pending_recommendations BOOLEAN DEFAULT TRUE,
  notify_urgent_only BOOLEAN DEFAULT FALSE, -- Only notify for priority <= 3
  max_pending_recommendations INTEGER DEFAULT 5, -- Auto-expire oldest if exceeded

  -- Performance Trigger Thresholds
  compliance_alert_threshold DECIMAL(3,2) DEFAULT 0.80, -- Alert if below 80%
  compliance_consecutive_weeks INTEGER DEFAULT 2, -- Only alert after N consecutive low weeks
  tsb_alert_threshold INTEGER DEFAULT -20, -- Alert when TSB drops below this
  readiness_alert_threshold INTEGER DEFAULT 40, -- Alert when readiness below this
  plateau_weeks_threshold INTEGER DEFAULT 2, -- Alert if exercise plateaued for N weeks
  plateau_exercise_count INTEGER DEFAULT 3, -- Alert if N+ exercises plateaued
  progress_ahead_threshold DECIMAL(3,2) DEFAULT 0.15, -- Suggest shortening if 15%+ ahead
  progress_behind_threshold DECIMAL(3,2) DEFAULT 0.15, -- Suggest extending if 15%+ behind

  -- Day-of Readiness Adjustments
  day_of_adjustment_enabled BOOLEAN DEFAULT TRUE,
  day_of_readiness_threshold INTEGER DEFAULT 50, -- Auto-suggest scaling if below

  -- Automation Level (for future expansion)
  auto_apply_workout_adjustments BOOLEAN DEFAULT FALSE, -- Auto-apply day-of readiness scaling

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRAINING_PLANS - Add adaptive fields
-- ============================================================================

ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS plan_mode TEXT DEFAULT 'rolling';
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS last_adaptation_eval TIMESTAMPTZ;
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS pending_recommendations_count INTEGER DEFAULT 0;

-- ============================================================================
-- TRAINING_PHASES - Add adaptation tracking fields
-- ============================================================================

ALTER TABLE training_phases ADD COLUMN IF NOT EXISTS original_end_date DATE;
ALTER TABLE training_phases ADD COLUMN IF NOT EXISTS adaptation_history JSONB DEFAULT '[]';
-- [{"date": "2024-02-01", "type": "extension", "days": 7, "reason": "performance_behind"}]
ALTER TABLE training_phases ADD COLUMN IF NOT EXISTS completion_metrics JSONB;
-- Captured when phase ends: {"compliance": 0.87, "strength_progress": {...}, "tsb_final": -5}

-- ============================================================================
-- WEEKLY_TARGETS - Add compliance and adaptation tracking
-- ============================================================================

ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,1);
ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS actual_tss INTEGER;
ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS compliance_percentage DECIMAL(5,2);
ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS adaptation_adjustments JSONB DEFAULT '[]';
-- [{"date": "2024-02-05", "type": "volume_reduce", "from_hours": 12, "to_hours": 10}]

-- ============================================================================
-- SUGGESTED_WORKOUTS - Add readiness adjustment tracking
-- ============================================================================

ALTER TABLE suggested_workouts ADD COLUMN IF NOT EXISTS readiness_adjusted BOOLEAN DEFAULT FALSE;
ALTER TABLE suggested_workouts ADD COLUMN IF NOT EXISTS original_intensity TEXT;
ALTER TABLE suggested_workouts ADD COLUMN IF NOT EXISTS adjustment_factor DECIMAL(3,2);
ALTER TABLE suggested_workouts ADD COLUMN IF NOT EXISTS substitution_reason TEXT;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to expire old pending recommendations
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE plan_recommendations
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update pending_recommendations_count on plan
CREATE OR REPLACE FUNCTION update_pending_recommendations_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE training_plans
    SET pending_recommendations_count = (
      SELECT COUNT(*) FROM plan_recommendations
      WHERE plan_id = NEW.plan_id AND status = 'pending'
    )
    WHERE id = NEW.plan_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE training_plans
    SET pending_recommendations_count = (
      SELECT COUNT(*) FROM plan_recommendations
      WHERE plan_id = OLD.plan_id AND status = 'pending'
    )
    WHERE id = OLD.plan_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pending_recs ON plan_recommendations;
CREATE TRIGGER trigger_update_pending_recs
AFTER INSERT OR UPDATE OR DELETE ON plan_recommendations
FOR EACH ROW EXECUTE FUNCTION update_pending_recommendations_count();

-- Function to get current week's compliance
CREATE OR REPLACE FUNCTION get_weekly_compliance(p_user_id UUID, p_week_start DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  week_start DATE;
  target_hours DECIMAL;
  target_tss INTEGER;
  actual_hours DECIMAL;
  actual_tss INTEGER;
BEGIN
  -- Default to current week
  week_start := COALESCE(p_week_start, date_trunc('week', CURRENT_DATE)::DATE);

  -- Get weekly target from active plan
  SELECT wt.target_hours, wt.target_tss
  INTO target_hours, target_tss
  FROM training_plans tp
  JOIN training_phases ph ON ph.plan_id = tp.id
  JOIN weekly_targets wt ON wt.phase_id = ph.id
  WHERE tp.user_id = p_user_id
    AND tp.status = 'active'
    AND wt.week_start_date = week_start
  LIMIT 1;

  -- Calculate actual from workouts
  SELECT
    COALESCE(SUM(COALESCE(actual_duration_minutes, planned_duration_minutes)) / 60.0, 0),
    COALESCE(SUM(COALESCE(actual_tss, planned_tss)), 0)
  INTO actual_hours, actual_tss
  FROM workouts
  WHERE user_id = p_user_id
    AND workout_date >= week_start
    AND workout_date < week_start + INTERVAL '7 days'
    AND status = 'completed';

  RETURN jsonb_build_object(
    'week_start', week_start,
    'target_hours', target_hours,
    'actual_hours', actual_hours,
    'hours_compliance', CASE WHEN target_hours > 0 THEN actual_hours / target_hours ELSE NULL END,
    'target_tss', target_tss,
    'actual_tss', actual_tss,
    'tss_compliance', CASE WHEN target_tss > 0 THEN actual_tss::DECIMAL / target_tss ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE plan_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_mode_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_settings ENABLE ROW LEVEL SECURITY;

-- Plan recommendations policies
CREATE POLICY "Users can view own recommendations" ON plan_recommendations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recommendations" ON plan_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recommendations" ON plan_recommendations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recommendations" ON plan_recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- Adaptation evaluations policies
CREATE POLICY "Users can view own evaluations" ON adaptation_evaluations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evaluations" ON adaptation_evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Plan mode config policies (based on plan ownership)
CREATE POLICY "Users can view own plan mode config" ON plan_mode_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM training_plans WHERE id = plan_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert own plan mode config" ON plan_mode_config
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM training_plans WHERE id = plan_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update own plan mode config" ON plan_mode_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM training_plans WHERE id = plan_id AND user_id = auth.uid())
  );

-- Adaptation settings policies
CREATE POLICY "Users can view own adaptation settings" ON adaptation_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own adaptation settings" ON adaptation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own adaptation settings" ON adaptation_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE plan_recommendations IS 'Plan adjustment recommendations from the adaptation engine';
COMMENT ON TABLE adaptation_evaluations IS 'Audit log of adaptation engine evaluation runs';
COMMENT ON TABLE plan_mode_config IS 'Configuration for rolling vs goal-based plan modes';
COMMENT ON TABLE adaptation_settings IS 'User preferences for adaptation triggers and notifications';

COMMENT ON COLUMN plan_recommendations.scope IS 'Level of plan affected: phase, week, workout, or plan';
COMMENT ON COLUMN plan_recommendations.trigger_type IS 'What triggered this recommendation: time, performance, event, readiness, or user';
COMMENT ON COLUMN plan_recommendations.confidence_score IS 'AI confidence in recommendation (0.0 to 1.0)';
COMMENT ON COLUMN plan_recommendations.priority IS 'Urgency level: 1=critical, 5=normal, 10=nice-to-have';
COMMENT ON COLUMN plan_recommendations.status IS 'User response: pending, accepted, modified, dismissed, expired, superseded';

COMMENT ON COLUMN plan_mode_config.plan_mode IS 'rolling = indefinite cycling, goal_based = targeting specific event';
COMMENT ON COLUMN plan_mode_config.peak_readiness_target IS 'Target TSB value at event (positive = fresh and ready)';

COMMENT ON COLUMN adaptation_settings.auto_evaluate IS 'Enable automatic adaptation evaluations';
COMMENT ON COLUMN adaptation_settings.compliance_alert_threshold IS 'Alert if weekly compliance drops below this (0.0-1.0)';
COMMENT ON COLUMN adaptation_settings.day_of_adjustment_enabled IS 'Allow day-of workout intensity scaling based on readiness';
