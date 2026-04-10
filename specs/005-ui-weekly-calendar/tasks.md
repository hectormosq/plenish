# Tasks: Phase 2 - Weekly Calendar

1. [ ] Create MealCalendar.tsx (async server fetcher)
   - [ ] Fetch getRecentMeals()
   - [ ] Fetch getHouseholdMeals(50)
   - [ ] Merge by date + meal type
   - [ ] Pass to MealWeekGrid
2. [ ] Create MealWeekGrid.tsx (client grid)
   - [ ] Define grid layout (7 cols × 5 rows)
   - [ ] Render meal cells (colored blocks)
   - [ ] Add ghost cells for missing meals
   - [ ] Render shared badges (👥)
   - [ ] Add delete button to cells
3. [ ] Add hover tooltip
   - [ ] Show full meal text
   - [ ] Show timestamp
   - [ ] Show delete/dismiss buttons
4. [ ] Add today highlight
   - [ ] Identify current day
   - [ ] Add border/background to column
5. [ ] Update dashboard layout
   - [ ] Add calendarSlot parameter
   - [ ] Update DashboardLayout signature
   - [ ] Remove recentMealsSlot
6. [ ] Update dashboard page
   - [ ] Add calendar to layout
   - [ ] Remove RecentMeals
7. [ ] Test
   - [ ] Grid displays correctly
   - [ ] Meals appear in correct cells
   - [ ] Colors correct
   - [ ] Shared badges show
   - [ ] Delete works
   - [ ] Dismiss works
   - [ ] Mobile responsive
   - [ ] No regressions
8. [ ] Commit

**Time: ~4-6 hours | 16 total items**
