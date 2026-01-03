# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (Next.js config)
```

No test suite is currently configured.

## Architecture Overview

**Forge** is a unified fitness tracking app built with Next.js 14 App Router, Supabase (PostgreSQL + Auth), and Tailwind CSS.

### Tech Stack
- **Framework**: Next.js 14 with App Router, React 18, TypeScript
- **Database/Auth**: Supabase (PostgreSQL with Row Level Security)
- **AI**: Anthropic Claude API for coaching and workout generation
- **Styling**: Tailwind CSS with custom dark theme
- **Integrations**: Strava OAuth, 8sleep API

### Directory Structure

```
src/
├── app/
│   ├── (dashboard)/     # Protected routes (requires auth)
│   │   ├── calendar/    # Workout calendar
│   │   ├── plan/        # Training plan builder with AI generation
│   │   ├── lifting/     # Strength training tracker
│   │   ├── coach/       # AI coaching chat
│   │   ├── nutrition/   # Macro tracking
│   │   ├── sleep/       # Sleep tracking (8sleep)
│   │   ├── progress/    # Analytics dashboard
│   │   └── settings/    # User profile, integrations
│   ├── api/             # 70+ API routes
│   └── login/           # Auth pages
├── components/          # React components
│   └── plan/            # Training plan components
├── lib/
│   ├── supabase/        # Client (browser) and server (admin) clients
│   ├── ai-tools.ts      # AI tool definitions for Claude
│   ├── ai-tool-handlers.ts  # Tool execution logic
│   └── [domain].ts      # Domain utilities (strava, weather, strength-calculations, etc.)
└── types/               # TypeScript types
    ├── database.ts      # Supabase auto-generated types
    └── training-plan.ts # Training plan, workouts, phases
```

### Key Patterns

**Supabase Clients** (`src/lib/supabase/`):
- `createClient()` - User-scoped client for server components/API routes (respects RLS)
- `createAdminClient()` - Service role client for bypassing RLS when needed

**API Routes**: All routes use Next.js App Router conventions (`route.ts`). Auth is checked via `supabase.auth.getSession()`. Most endpoints support CRUD operations with RLS-protected queries.

**Auth Flow**: Middleware (`src/middleware.ts`) protects dashboard routes and redirects unauthenticated users to `/login`.

**Training Plans**: The plan system has three layers:
1. `training_plans` - Overall plan with goal, dates, status
2. `training_phases` - Periodization blocks (base/build/peak/taper/recovery)
3. `suggested_workouts` - AI-generated workouts linked to phases, with status (suggested/scheduled/skipped)

When a suggested workout is scheduled, it creates an actual workout in the `workouts` table and links via `scheduled_workout_id`.

**Nutrition System**: The nutrition tracking has three layers:
1. `nutrition_logs` - Daily log with totals (calories, protein, carbs, fat)
2. `nutrition_foods` - Individual food entries linked to a log, with meal_type (breakfast/lunch/dinner/snack)
3. `nutrition_favorites` - User's saved foods for quick logging, with usage tracking

API routes (`/api/nutrition/`):
- `log` - GET/POST/PATCH/DELETE for daily logs and food entries
- `targets` - GET/PATCH for user's calorie/macro goals (stored in profiles)
- `favorites` - GET/POST/DELETE for saved foods
- `search` - USDA FoodData Central search integration
- `barcode` - Open Food Facts barcode lookup
- `analyze` - AI-powered photo analysis for food recognition

The `NutritionTracker` component (`src/components/NutritionTracker.tsx`) provides:
- Daily macro tracking with progress rings
- Meal-based food logging (breakfast, lunch, dinner, snacks)
- Food search via USDA database
- Barcode scanning (native BarcodeDetector API + manual fallback)
- AI photo analysis for food recognition
- Favorites system with database persistence
- Edit/delete food entries

### Database

SQL migrations are in `sql/` directory and `supabase/migrations/`. Core tables:
- `profiles` - User settings, training zones, nutrition targets, polarized training settings
- `workouts` - All training sessions (cardio, strength, etc.) with session_rpe and training_load
- `exercises` - Exercise library with muscle groups, equipment
- `training_plans`, `training_phases`, `suggested_workouts` - Plan system
- `integrations` - OAuth tokens (Strava, 8sleep) with provider field
- `nutrition_logs`, `nutrition_foods`, `nutrition_favorites` - Nutrition tracking
- `training_load_history` - Daily CTL/ATL/TSB metrics for periodization
- `threshold_history` - FTP/LTHR test history tracking
- `adaptation_settings`, `plan_recommendations` - Adaptive periodization system

All tables have RLS policies - users can only access their own data.

**Regenerating Types**: When database schema changes, regenerate types with:
```bash
npx supabase gen types typescript --project-id vmrqsofuqtavzdiklpzb > src/types/database.ts
```
Then add helper type exports at the end of the file (Profile, Workout, etc.).

### Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
ANTHROPIC_API_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
NEXT_PUBLIC_STRAVA_CLIENT_ID=
```

### Component Conventions

- Server Components for data fetching (pages in `(dashboard)/`)
- Client Components marked with `'use client'`
- Lucide React for icons
- @dnd-kit for drag-and-drop (workout planning)
- Tailwind utility classes with custom colors for zones (z1-z5) and categories (cardio/strength/other)
