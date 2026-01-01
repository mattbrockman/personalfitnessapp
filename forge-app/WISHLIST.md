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

## Bug Reports
<!-- Add bug reports here -->

---
*Last updated: 2026-01-01*
