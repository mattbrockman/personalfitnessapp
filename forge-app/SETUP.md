# FORGE Setup Guide

This guide will get your personal fitness app running in about 30 minutes.

---

## Step 1: Create Accounts (5 min)

Create free accounts on these services (use "Sign up with GitHub" when available):

1. **GitHub** - https://github.com/signup
2. **Supabase** - https://supabase.com (click "Start your project" → sign in with GitHub)
3. **Vercel** - https://vercel.com (click "Sign Up" → continue with GitHub)

---

## Step 2: Create Supabase Project (3 min)

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name:** `forge` (or whatever you want)
   - **Database Password:** Generate a strong one and SAVE IT somewhere
   - **Region:** Choose closest to you (e.g., "East US" for East Coast)
4. Click **"Create new project"**
5. Wait 1-2 minutes for it to provision

---

## Step 3: Set Up Database Tables (5 min)

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `sql/001_schema.sql` from this project
4. Copy ALL the contents and paste into the SQL editor
5. Click **"Run"** (or Cmd+Enter)
6. You should see "Success. No rows returned" - that's good!

**Then add the exercise library:**

1. Click **"New query"** again
2. Open `sql/seed_exercises.sql`
3. Copy and paste, then click **"Run"**

---

## Step 4: Get Your Supabase Keys (2 min)

1. In Supabase, go to **Settings** (gear icon) → **API**
2. You'll need these three values:
   - **Project URL** - looks like `https://xxxxx.supabase.co`
   - **anon/public key** - starts with `eyJ...`
   - **service_role key** - also starts with `eyJ...` (click "Reveal" to see it)

Keep this page open - you'll need these soon.

---

## Step 5: Create GitHub Repository (3 min)

1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** `forge-app`
   - **Description:** `Personal fitness tracking app`
   - **Private** (select this - it's your personal app)
3. Click **"Create repository"**
4. You'll see a page with setup instructions - keep this open

---

## Step 6: Upload Code to GitHub (5 min)

**Option A: If you have Git installed (Mac/Linux usually do):**

Open Terminal, then:

```bash
# Go to where you downloaded the forge-app folder
cd ~/Downloads/forge-app  # or wherever you unzipped it

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Connect to your GitHub repo (copy this from GitHub - it has YOUR username)
git remote add origin https://github.com/YOUR_USERNAME/forge-app.git

# Push
git branch -M main
git push -u origin main
```

**Option B: Upload via GitHub website:**

1. On your GitHub repo page, click **"uploading an existing file"**
2. Drag the entire contents of the forge-app folder into the upload area
3. Click **"Commit changes"**

---

## Step 7: Deploy to Vercel (5 min)

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Find `forge-app` in your GitHub repos and click **"Import"**
4. **Configure Environment Variables** - Click "Environment Variables" and add these:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now |

5. Click **"Deploy"**
6. Wait 1-2 minutes for it to build

---

## Step 8: Update App URL (1 min)

1. Once deployed, Vercel gives you a URL like `forge-app-xxxxx.vercel.app`
2. Go back to Vercel project settings → Environment Variables
3. Add/update `NEXT_PUBLIC_APP_URL` to be your full URL: `https://forge-app-xxxxx.vercel.app`
4. Go to **Deployments** tab → click the "..." menu on your deployment → **"Redeploy"**

---

## Step 9: Configure Supabase Auth (2 min)

1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL: `https://forge-app-xxxxx.vercel.app`
3. Under **Redirect URLs**, add:
   - `https://forge-app-xxxxx.vercel.app/api/auth/callback`

---

## Step 10: Test It! (1 min)

1. Go to your Vercel URL
2. You should see the Forge login page
3. Click **"Sign up"** and create an account with your email
4. Check your email for a confirmation link
5. Click the link and you're in!

---

## Optional: Connect Strava

If you want to sync your Strava activities:

1. Go to https://www.strava.com/settings/api
2. Create an application:
   - **Application Name:** Forge
   - **Website:** Your Vercel URL
   - **Authorization Callback Domain:** `forge-app-xxxxx.vercel.app` (no https://)
3. Save your **Client ID** and **Client Secret**
4. Add these to Vercel Environment Variables:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `NEXT_PUBLIC_STRAVA_CLIENT_ID` (same as STRAVA_CLIENT_ID)
5. Redeploy

---

## Troubleshooting

**"Invalid API key" error:**
- Double-check your Supabase keys in Vercel - no extra spaces or quotes

**Can't sign up / no confirmation email:**
- Check Supabase Authentication → Users to see if the user was created
- Check spam folder for confirmation email

**Strava not connecting:**
- Make sure the callback domain matches exactly (no trailing slash)

**Blank page or errors:**
- Check Vercel deployment logs for errors
- Make sure all SQL ran successfully in Supabase

---

## You're Done! 🎉

Your app is now live at your Vercel URL. You can:
- Access it on your laptop via the URL
- Access it on your iPhone via the same URL (add to Home Screen for app-like experience)
- All your data syncs automatically

Next steps when you're ready:
- Connect Strava for automatic workout imports
- Set up your training zones in Settings
- Start logging workouts, nutrition, and sleep!
