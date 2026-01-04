# FORGE - Product Roadmap & Development Guide

## Vision
FORGE is a comprehensive health and fitness platform that unifies training, nutrition, sleep, and recovery tracking with AI-powered insights. Unlike fragmented fitness apps, FORGE creates a complete picture of your health journey.

## Target User
- Serious fitness enthusiasts (not beginners, not elite athletes)
- Data-driven individuals who track multiple health metrics
- People who use multiple devices/apps and want consolidation
- Those interested in longevity and preventive health

---

## Current State (v0.1)

### ✅ Completed Features

#### Core Infrastructure
- [x] Next.js 14 App Router setup
- [x] TypeScript configuration
- [x] Supabase integration (auth + database)
- [x] Tailwind CSS with custom design tokens
- [x] Dark theme with glass morphism aesthetic
- [x] Responsive layout with mobile navigation
- [x] Protected routes via middleware

#### Authentication
- [x] Email/password signup and login
- [x] Session management and refresh
- [x] Auto-create profile on signup

#### Strava Integration
- [x] OAuth flow (connect/disconnect)
- [x] Activity sync (30 days back)
- [x] Zone data import (HR + Power)
- [x] Token refresh handling
- [x] Duplicate detection

#### Calendar View
- [x] Month grid with workout display
- [x] Color-coded by category
- [x] Zone badges (Z1-Z5, HIT, MIX)
- [x] Workout detail modal
- [x] Navigate months
- [x] Sync button

#### Settings
- [x] Profile display
- [x] Training zones (FTP, LTHR, Max HR)
- [x] Integration management

### 🔄 Components Built (Need Page Integration)

#### Lifting Tracker
- [x] Exercise search with muscle filtering
- [x] Set logging (warmup/working/dropset/failure/AMRAP)
- [x] Target vs actual tracking
- [x] RPE logging
- [x] Rest timer with pause/skip
- [x] Exercise notes
- [x] Superset grouping support
- [x] Live workout stats

#### Nutrition Tracker
- [x] Meal-based logging
- [x] Macro rings with targets
- [x] Photo capture with AI placeholder
- [x] Favorites system
- [x] Manual entry form
- [x] Water tracking
- [x] Calorie remaining display

#### Journal
- [x] Entry types (general/injury/recovery/goal/milestone/technique)
- [x] Body part tagging
- [x] Severity levels for injuries
- [x] Status tracking (active/recovering/resolved)
- [x] Full-text search
- [x] Filter by type and body part

#### Sleep Tracker
- [x] Week view with scores
- [x] Eight Sleep screenshot upload
- [x] AI parsing placeholder
- [x] Sleep stage visualization
- [x] HRV/HR/recovery tracking
- [x] Trend comparison
- [x] Manual entry

#### AI Coach
- [x] Chat interface
- [x] Quick action suggestions
- [x] Insight cards
- [x] Context-aware responses (simulated)
- [x] Typing indicator

#### Progress Charts
- [x] Strength progress lines
- [x] Body composition tracking
- [x] Fitness (CTL/ATL/TSB) chart
- [x] Recovery metrics
- [x] Weekly volume bars
- [x] Personal records display
- [x] Protein consistency

---

## Known Bugs

- [x] Exercise timers triggered at wrong time (lifting tracker) - FIXED: Redesigned timer with Strong-style UI

---

## Phase 1: Core Polish (Weeks 1-2)

### High Priority
- [ ] Integrate built components into actual pages
  - [ ] Create `/lifting` route with LiftingTracker
  - [x] Create `/nutrition` route with NutritionTracker
  - [ ] Create `/journal` route with Journal
  - [ ] Create `/sleep` route with SleepTracker
  - [ ] Create `/coach` route with AICoach
  - [ ] Create `/progress` route with Progress
- [ ] Wire up components to Supabase
  - [ ] Lifting: save/load workouts
  - [x] Nutrition: save/load food logs
  - [ ] Journal: CRUD operations
  - [ ] Sleep: save/load logs
- [ ] Add workout templates/library
  - [ ] Pre-built workout templates
  - [ ] Save custom templates
  - [ ] Template scheduling

### Medium Priority
- [ ] Calendar drag-and-drop workout planning
- [ ] Workout copy/paste between days
- [ ] Bulk sync for Strava (full history)
- [ ] Exercise video/GIF support
- [ ] Exercise history per movement

### Lower Priority
- [ ] Onboarding flow for new users
- [ ] Settings page for nutrition targets
- [ ] Settings page for notification preferences
- [ ] Dark/light theme toggle

---

## Phase 2: AI Integration (Weeks 3-4)

### OpenAI/Anthropic Integration
- [ ] Nutrition photo analysis
  - [ ] Food identification from images
  - [ ] Portion estimation
  - [ ] Macro calculation
  - [ ] Confidence scores
- [ ] Eight Sleep screenshot parsing
  - [ ] OCR for sleep metrics
  - [ ] Stage duration extraction
  - [ ] Score parsing
- [ ] AI Coach real responses
  - [ ] RAG over user's workout history
  - [ ] RAG over user's journal entries
  - [ ] Workout recommendations
  - [ ] Progress analysis
  - [ ] Injury modifications

### Smart Features
- [ ] Auto-generate workout based on goals
- [ ] Suggest deload weeks based on fatigue
- [ ] Recovery-based training adjustments
- [ ] PR prediction based on trends
- [ ] Nutrition suggestions to hit targets

---

## Phase 3: Integrations (Weeks 5-8)

### Fitness Platforms
- [x] Intervals.icu integration
  - [x] API Key authentication (connect/disconnect)
  - [x] Push workouts to calendar (Zwift/Wahoo sync via Intervals.icu)
  - [x] Pull completed activities
  - [x] ZWO workout file generation
  - [ ] Activity completion detection
  - [ ] RPE collection after workouts
  - [ ] Push notification infrastructure (VAPID keys configured)
- [ ] TrainerRoad integration
  - [ ] Workout sync
  - [ ] TSS import
  - [ ] Plan compliance tracking
- [ ] Apple Health
  - [ ] HealthKit read/write
  - [ ] Activity, sleep, HRV sync
  - [ ] Workout export
- [ ] WHOOP integration
  - [ ] Recovery scores
  - [ ] Strain tracking
  - [ ] Sleep stages
- [ ] Oura Ring
  - [ ] Readiness scores
  - [ ] Sleep data
  - [ ] Activity tracking
- [ ] Garmin Connect
  - [ ] Activity sync
  - [ ] Training status
  - [ ] Body battery

### Nutrition
- [ ] MyFitnessPal import
- [ ] Cronometer integration
- [x] USDA FoodData Central search
- [x] Open Food Facts barcode API (backend ready, UI pending)
- [ ] Barcode scanner UI (camera integration)
- [ ] Restaurant menu lookup

### Lab Work
- [ ] InsideTracker integration
- [ ] Manual biomarker entry
- [ ] Trend visualization
- [ ] Out-of-range alerts

---

## Phase 4: Advanced Features (Weeks 9-12)

### Training Intelligence
- [ ] Periodization planning
  - [ ] Mesocycle builder
  - [ ] Auto-regulate based on recovery
  - [ ] Taper calculator
- [ ] Volume landmark tracking
  - [ ] MEV/MAV/MRV per muscle
  - [ ] Adaptive recommendations
- [ ] Fatigue management
  - [ ] CTL/ATL/TSB visualization
  - [ ] Peak form prediction
  - [ ] Race day readiness

### Body Composition
- [ ] Progress photos with comparison
- [ ] Measurement tracking (chest, waist, etc.)
- [ ] DEXA/InBody data import
- [ ] Trend analysis and projections

### Social/Sharing
- [ ] Coach access (view-only)
  - [ ] PIN-based authentication
  - [ ] Filtered views
  - [ ] Note sharing
- [ ] Export to PDF reports
- [ ] Share progress cards

---

## Phase 5: Mobile & Polish (Weeks 13-16)

### Mobile Experience
- [ ] PWA optimizations
  - [ ] Offline support
  - [ ] Push notifications
  - [ ] Install prompts
- [ ] Native app (React Native or Expo)
  - [ ] iOS build
  - [ ] Android build
  - [ ] Apple Watch companion
  - [ ] Widgets

### Performance
- [ ] Database query optimization
- [ ] Image CDN and compression
- [ ] Lazy loading for charts
- [ ] Server-side rendering optimization

### UX Polish
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Empty states with CTAs
- [ ] Haptic feedback (mobile)
- [ ] Keyboard shortcuts (desktop)
- [ ] Accessibility audit (WCAG 2.1)

---

## Technical Debt & Infrastructure

### Database
- [ ] Add database indexes for common queries
- [ ] Set up Supabase Edge Functions for complex logic
- [ ] Implement proper caching strategy
- [ ] Add database migrations workflow

### Testing
- [ ] Unit tests for utilities
- [ ] Component tests with React Testing Library
- [ ] E2E tests with Playwright
- [ ] API integration tests

### DevOps
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Preview deployments (Vercel)
- [ ] Error monitoring (Sentry)
- [ ] Analytics (PostHog or similar)
- [ ] Uptime monitoring

### Security
- [ ] Rate limiting on API routes
- [ ] Input validation/sanitization
- [ ] CSRF protection audit
- [ ] Security headers review

---

## Future Ideas (Backlog)

### Lifting Enhancements
- Sticky notes for exercises
  - Persistent notes that show by default below exercise name, above sets/reps
  - Useful for form cues, injury modifications, equipment preferences
- Exercise notes log
  - Regular notes stored in exercise history log (viewable in exercise info popup)
  - Notification bubble icon next to exercise name if there was a note last time
  - Clicking bubble opens notes log with most recent note highlighted
- [x] Redesign rest timer to match Strong app's timer UX - DONE
  - [x] Replace -15/+30 buttons with simple -/+ buttons, each adjusting by 15 seconds
  - [x] Inactive state shows planned rest time between sets (subtle blue text)
  - [x] Active state shows blue pill with countdown and controls
- Set completion indicator next to exercise name
  - Show "0/3", "1/3", etc. when exercise is collapsed (hide when expanded)
  - Replace "Done" button with green checkmark next to completed count (e.g., ✓ 3/3)
- Exercise name abbreviations
  - Shorten common terms: Barbell → BB, Dumbbell → DB, Romanian Deadlift → RDL, etc.
  - Requires database update to store abbreviations tied to exercise names
  - Allows more of the exercise name to be visible in compact views

### Gamification
- Streaks and achievements
- Challenges (weekly, monthly)
- Leaderboards (opt-in)
- XP system

### Coaching Marketplace
- Connect with certified coaches
- Program purchases
- Video form checks
- Live consultations

### Advanced Analytics
- Muscle group volume heatmap
- Time-of-day performance analysis
- Nutrition timing correlations
- Sleep quality impact on performance

### Hardware Integration
- Bluetooth weight scale sync
- Smart gym equipment (Tonal, etc.)
- Heart rate monitor direct connect
- Force plate integration

### Content
- Exercise tutorial library
- Nutrition education
- Recovery protocols
- Mental performance

---

## Success Metrics

### Engagement
- Daily active users
- Average session duration
- Feature adoption rates
- Workout completion rate

### Retention
- Day 1, 7, 30 retention
- Churn rate by feature usage
- Reactivation rate

### Quality
- Sync success rate
- AI accuracy scores
- Error rates
- Load times (p50, p95)

### Business (if monetized)
- Conversion rate (free → paid)
- Revenue per user
- Lifetime value
- CAC payback period

---

## Design Principles

1. **Data Density**: Show more information without overwhelming
2. **Progressive Disclosure**: Details on demand, summary first
3. **Zero Friction**: Logging should be faster than competitors
4. **Smart Defaults**: Pre-fill based on history and patterns
5. **Unified Experience**: All health data in one place
6. **Privacy First**: User owns their data, granular sharing controls

---

## Tech Stack Summary

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts (visualization)
- Lucide (icons)
- date-fns (dates)

**Backend**
- Supabase (PostgreSQL + Auth + Storage)
- Edge Functions (complex logic)
- OpenAI/Anthropic (AI features)

**Integrations**
- Strava API
- TrainerRoad API
- Apple HealthKit
- Various fitness platform APIs

**Infrastructure**
- Vercel (hosting)
- Supabase (database)
- Cloudflare (CDN/security)
- Sentry (monitoring)

---

## Immediate Next Steps

1. ~~Build core UI components~~ ✅
2. Create page routes for each feature
3. Wire components to Supabase
4. Deploy v0.1 for testing
5. Set up AI photo analysis
6. Build workout template system
7. Add TrainerRoad integration

---

*Last updated: January 4, 2026*
