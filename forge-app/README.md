# Forge - Unified Fitness Tracking

Track strength, cardio, nutrition, and recovery in one place.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Integrations**: Strava (OAuth)

## Setup

### 1. Clone and Install

```bash
cd forge-app
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → API to get your keys
3. Run the database schema (see `FORGE_DATABASE_SCHEMA_V2.md`)

### 3. Strava Setup

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an application:
   - **Application Name**: Forge
   - **Website**: http://localhost:3000 (or your domain)
   - **Authorization Callback Domain**: localhost (or your domain)
3. Copy your Client ID and Client Secret

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Strava
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_STRAVA_CLIENT_ID=your-client-id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Database Schema

Run the SQL from `FORGE_DATABASE_SCHEMA_V2.md` in your Supabase SQL editor.

Quick setup for minimum viable:

```sql
-- Profiles (auto-created on signup via trigger)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  ftp_watts INTEGER,
  lthr_bpm INTEGER,
  max_hr_bpm INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  external_user_id TEXT,
  scopes TEXT[],
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active',
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service)
);

-- Workouts
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  category TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  name TEXT,
  primary_intensity TEXT,
  planned_duration_minutes INTEGER,
  planned_distance_miles DECIMAL(6,2),
  planned_tss INTEGER,
  actual_duration_minutes INTEGER,
  actual_distance_miles DECIMAL(6,2),
  actual_tss INTEGER,
  actual_calories INTEGER,
  actual_avg_hr INTEGER,
  actual_max_hr INTEGER,
  actual_avg_power INTEGER,
  actual_elevation_ft INTEGER,
  status TEXT DEFAULT 'planned',
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  external_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout zones
CREATE TABLE public.workout_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL,
  zone_1_seconds INTEGER DEFAULT 0,
  zone_2_seconds INTEGER DEFAULT 0,
  zone_3_seconds INTEGER DEFAULT 0,
  zone_4_seconds INTEGER DEFAULT 0,
  zone_5_seconds INTEGER DEFAULT 0,
  zone_6_seconds INTEGER DEFAULT 0,
  zone_7_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workout_id, zone_type)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_zones ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own integrations" ON public.integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own workout zones" ON public.workout_zones FOR ALL USING (
  workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

### Implemented
- [x] User authentication (email/password)
- [x] Strava OAuth integration
- [x] Activity sync from Strava
- [x] Calendar month view
- [x] Workout detail modal
- [x] Zone data import (HR, Power)
- [x] Settings page

### Coming Soon
- [ ] Workout library sidebar
- [ ] Drag-and-drop workout planning
- [ ] Lifting tracker
- [ ] Nutrition logging
- [ ] Photo food logging with AI
- [ ] Journal/injury notes
- [ ] AI Coach
- [ ] Sleep tracking
- [ ] TrainerRoad integration
- [ ] Apple Health integration

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/      # Protected routes
│   │   ├── calendar/
│   │   ├── lifting/
│   │   ├── nutrition/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   └── strava/
│   │   └── strava/
│   │       └── sync/
│   ├── login/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── CalendarView.tsx
│   ├── Navigation.tsx
│   └── SettingsView.tsx
├── lib/
│   ├── strava.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── types/
│   └── database.ts
└── middleware.ts
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Update Strava callback URL to production domain

### Environment Variables for Production

Make sure to update:
- `NEXT_PUBLIC_APP_URL` → your production URL
- Strava callback domain in Strava settings
