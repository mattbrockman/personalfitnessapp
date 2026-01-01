# FORGE App - Wishlist & Bug Fixes

## In Progress
<!-- Add current work items here -->

## Completed
- [x] Fix mobile layout - hide swap/camera/superset buttons on mobile for more exercise name space
- [x] Fix workout save bug - status was hardcoded to 'planned' instead of using request body
- [x] Add inputMode and onFocus select-all to reps/weight inputs
- [x] Add manual duration entry for timed exercises
- [x] Add weight auto-fill to remaining sets when entering weight
- [x] Add timer sound notifications (rest timer completion + work timer at target)

## Wishlist (Future Features)
- [ ] Show notes from previous workout when performing same exercise - display indicator next to exercise notes with popup showing last time's notes (e.g., "Back squat: focus on depth" from last week)

### Nutrition API Integrations
- [ ] **Barcode Scanner for Food Logging** - Use Open Food Facts API (free, 3M+ products). Scan packaged foods to auto-populate nutrition data. API: https://world.openfoodfacts.org/data - Query by barcode: `/api/v2/product/{barcode}`. Returns calories, macros, ingredients, allergens, Nutri-Score.
- [ ] **Restaurant Menu Nutrition Lookup** - Integrate Nutritionix API for chain restaurant meals (Chipotle, McDonalds, etc). Free tier available. API: https://www.nutritionix.com/ - Supports natural language queries like "Big Mac" or "Chipotle burrito bowl".
- [ ] **Natural Language Food Logging** - Add NLP parsing so users can type "I had 2 eggs, toast with butter, and coffee" and auto-calculate macros. Use Nutritionix or Edamam NLP APIs. Could integrate with AI coach for conversational food logging.
- [ ] **Recipe URL Import with Nutrition Analysis** - Paste a recipe URL, extract ingredients, calculate full nutrition breakdown. Use Edamam Recipe API (free tier) or build custom scraper + USDA FoodData Central for nutrition lookup.
- [ ] **Supplement Tracker** - Log daily supplements with actual ingredient amounts. Use NIH DSLD API (free, 200K+ labels): https://dsld.od.nih.gov/api-guide. Track vitamins, minerals, dosages. Show interactions/recommendations.
- [ ] **AI Meal Photo Analysis** - Take photo of meal, AI estimates calories/macros. Options: Edamam Food Recognition, LogMeal API, or Spike Nutrition API. Could use Claude vision for initial analysis then lookup in nutrition DB.
- [ ] **USDA FoodData Central Integration** - Use free government API for authoritative nutrition data: https://fdc.nal.usda.gov/api-guide/. 28 nutrients per food, foundation foods, branded products. Good base layer for all nutrition features.

### Strength Training Features (inspired by Strong app)
- [ ] **PR Detection & Celebration** - Auto-detect personal records (weight PR, rep PR, volume PR, estimated 1RM PR). Show confetti animation and "NEW PR!" badge. Store in exercise_prs table. Display PR history on exercise detail page.
- [ ] **1RM Calculator & Tracking** - Calculate estimated 1RM using Brzycki formula: `1RM = weight × (36 / (37 - reps))`. Show estimated 1RM after each working set. Track progression over time with charts. Display "% of 1RM" when entering weights.
- [ ] **Exercise Progress Charts** - Per-exercise analytics: volume over time, max weight progression, estimated 1RM trend, frequency, best sets history. Add "Stats" tab to exercise detail modal.
- [ ] **AI Weight Suggestion for New Exercises** - When no history exists, show "Get AI Suggestion" button. AI analyzes strength in similar exercises, movement patterns, body weight to recommend conservative starting weight.

### Reports & Trends (inspired by Hevy)
- [ ] **Comprehensive Reports & Trends Section** - Build robust analytics dashboard with multiple time-based views:
  - **Weekly:** Workouts completed vs planned, volume by muscle group, PRs achieved, streak, avg duration, comparison to previous week
  - **Monthly:** Aggregated metrics, month-over-month charts, muscle balance pie chart, training frequency heatmap, best lifts, AI insights
  - **Yearly (Year in Review):** Total volume lifted, PR timeline, most trained muscles, longest streak, goals achieved
  - **Training Phase:** Period-specific reports for periodized plans (Base/Build/Peak/Recovery), phase goals progress, TSS/CTL trends, next phase recommendations
  - Implementation: Add /reports page with tabs, use recharts, cache aggregates, optional email summaries & PDF export

## Bug Reports
<!-- Add bug reports here -->

---
*Last updated: 2026-01-01*
