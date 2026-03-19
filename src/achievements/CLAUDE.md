# Achievements Module

This module implements the gamification/rewards system for Nutrilly. Users earn badges (achievements) when they reach nutritional and behavioral milestones.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `achievements.constants.ts` | Static definitions of all 16 achievements (key, name, icon, description, category) |
| `achievements.service.ts` | Core evaluation logic, persistence, and public API |
| `achievements.controller.ts` | `GET /achievements` endpoint |
| `dto/achievement-response.dto.ts` | `AchievementDto` with Swagger decorators |
| `achievements.module.ts` | Module declaration — exports `AchievementsService` |

### Dependency Graph

```
DiaryModule  ──imports──▶  AchievementsModule
HydrationModule ─imports──▶  AchievementsModule
AchievementsModule ─imports──▶  PrismaModule (global, no import needed)
```

**AchievementsModule does NOT import DiaryModule or HydrationModule** — this prevents circular dependencies.

---

## Persistence

Achievements are stored in the `user_achievements` table (`UserAchievement` Prisma model):

```prisma
model UserAchievement {
  id             String   @id @default(cuid())
  userId         String
  achievementKey String
  earnedAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementKey])   // prevents duplicates
  @@map("user_achievements")
}
```

- Achievement **definitions** live in code (`achievements.constants.ts`), never in the database.
- The database only stores **which user earned which key** and **when**.
- `createMany({ skipDuplicates: true })` is used so concurrent requests are safe.

---

## Evaluation Strategy

Achievements are evaluated **reactively** (on user mutations) and **lazily** (on GET):

### Reactive: called from other services after a successful write

| Action | Method called | Achievements checked |
|--------|--------------|---------------------|
| `POST /diary/:date/:mealId` | `evaluateForDiary(userId)` | FIRST_LOG, PERFECT_WEEK, STREAK_14, STREAK_21, MARATHON, PROTEIN_PRO, CALORIE_MASTER, TRIPLE_CROWN, QUALITY_STREAK, EARLY_BIRD, PHOTO_FOODIE, NIGHT_OWL, CENTURION, WEEK_COMPLETE |
| `POST /hydration/:date` | `evaluateForHydration(userId)` | HYDRATION_HERO, WATER_WEEK, TRIPLE_CROWN |

### Lazy: full evaluation on read

`GET /achievements` calls `evaluateAll(userId)` which runs all checks as a fallback, ensuring the list is always consistent even if a reactive evaluation was missed.

### Return value

- `evaluateForDiary` and `evaluateForHydration` return `AchievementDto[]` containing **only the achievements newly unlocked by that specific action** (not previously earned ones).
- This array is included as `newAchievements` in the diary and hydration `POST` responses so the frontend can show a congratulations animation.
- An empty array `[]` means no new achievements were unlocked.

---

## Response Shape for POST endpoints

When the frontend calls `POST /diary/:date/:mealId` or `POST /hydration/:date`, the response includes a `newAchievements` field:

```json
{
  "id": "...",
  "amountMl": 500,
  "loggedAt": "2026-03-19T09:00:00.000Z",
  "newAchievements": [
    {
      "key": "HYDRATION_HERO",
      "name": "Hydration Hero",
      "icon": "H",
      "description": "Met your daily water goal for the first time",
      "category": "hydration",
      "earned": true,
      "earnedAt": "2026-03-19T09:00:00.000Z"
    }
  ]
}
```

**Frontend contract**: If `newAchievements.length > 0`, display a congratulations screen/animation for each unlocked achievement. If empty, proceed normally.

---

## All 16 Achievements

### Consistency (`category: "consistency"`)

| Key | Name | Icon | Unlock Condition |
|-----|------|------|-----------------|
| `FIRST_LOG` | First Step | 🌱 | First diary entry ever |
| `PERFECT_WEEK` | Perfect Week | W | Best streak ≥ 7 consecutive days with diary entries |
| `STREAK_14` | 14-Day Streak | 14 | Best streak ≥ 14 consecutive days |
| `STREAK_21` | 21-Day Record | 21 | Best streak ≥ 21 consecutive days |
| `MARATHON` | Marathon | 30 | Best streak ≥ 30 consecutive days |

> **Note**: Streak checks use `computeBestStreak` (all-time best), **not** the current active streak. This means users keep their streak achievements even after breaking the streak.

### Hydration (`category: "hydration"`)

| Key | Name | Icon | Unlock Condition |
|-----|------|------|-----------------|
| `HYDRATION_HERO` | Hydration Hero | H | Met daily water goal (`waterGoalMl`) on at least 1 day |
| `WATER_WEEK` | Water Week | 💧 | Met daily water goal for 7 **consecutive** days |

> Default `waterGoalMl` is 2600 ml when the user has no profile.

### Nutrition (`category: "nutrition"`)

| Key | Name | Icon | Unlock Condition |
|-----|------|------|-----------------|
| `PROTEIN_PRO` | Protein Pro | P | Met daily protein goal (`proteinGoalG`) on at least 1 day |
| `CALORIE_MASTER` | Calorie Master | C | Calorie intake within ±10% of `caloriesGoal` on ≥ 3 days |
| `TRIPLE_CROWN` | Triple Crown | 👑 | Met calories (±10%), protein, AND water goals on the same day |
| `QUALITY_STREAK` | Quality Streak | ⭐ | ≥ 5 "GOOD" quality entries logged on the same calendar day |

> GOOD quality means: protein ≥ 25% of macro calories AND fat ≤ 35% of macro calories.

### Behavior (`category: "behavior"`)

| Key | Name | Icon | Unlock Condition |
|-----|------|------|-----------------|
| `EARLY_BIRD` | Early Bird | E | Logged at least 1 diary entry before 08:00 UTC |
| `PHOTO_FOODIE` | Photo Foodie | 📸 | Added photo (`photoUri`) to at least 5 diary entries |
| `NIGHT_OWL` | Night Owl | 🦉 | Logged diary entries at 21:00 UTC or later on ≥ 3 occasions |

### Milestone (`category: "milestone"`)

| Key | Name | Icon | Unlock Condition |
|-----|------|------|-----------------|
| `CENTURION` | Centurion | 💯 | 100 total diary entries |
| `WEEK_COMPLETE` | Week Complete | ✅ | Logged entries for every day of a full calendar week (Mon–Sun) |

---

## API Endpoints

### `GET /achievements`

Returns all 16 achievements for the authenticated user with earned status.

**Query params:**
- `?category=consistency` — filter by category (optional)

**Response:** `AchievementDto[]`

```json
[
  {
    "key": "FIRST_LOG",
    "name": "First Step",
    "icon": "🌱",
    "description": "Logged your first meal",
    "category": "consistency",
    "earned": true,
    "earnedAt": "2026-03-01T08:00:00.000Z"
  },
  {
    "key": "MARATHON",
    "name": "Marathon",
    "icon": "30",
    "description": "30 consecutive days with diary entries",
    "category": "consistency",
    "earned": false,
    "earnedAt": null
  }
]
```

---

## Key Business Rules

1. **No duplicates**: Once an achievement is earned, it is never re-awarded. The `@@unique([userId, achievementKey])` constraint and `skipDuplicates: true` both enforce this.
2. **Best streak, not current streak**: Streak achievements (PERFECT_WEEK through MARATHON) use the historical best streak, so users who broke a streak still keep their badges.
3. **Same-day aggregation**: Nutrition goals (PROTEIN_PRO, CALORIE_MASTER, TRIPLE_CROWN) aggregate all diary entries for a given date before comparing to goals.
4. **UTC timestamps**: EARLY_BIRD and NIGHT_OWL use `loggedAt AT TIME ZONE 'UTC'` — hour boundaries are UTC-based.
5. **Null-safe defaults**: If a user has no profile, defaults are: `waterGoalMl = 2600`, `proteinGoalG = 150`, `caloriesGoal = 2200`.
6. **Order of operations**: `evaluateForDiary`/`evaluateForHydration` fetch already-earned achievements **in parallel** with running the checks. Only truly new keys (not in the already-earned set) are persisted and returned.

---

## Testing

Tests are in `achievements.service.spec.ts`. Private methods are tested via bracket notation (`service['checkFirstLog'](userId)`).

Key test scenarios:
- Each check returns the correct key(s) when the threshold is met
- No key is returned when the threshold is not met
- `evaluateAll` persists multiple achievements in a single `createMany` call
- `evaluateForDiary`/`evaluateForHydration` return only newly unlocked achievements (not already-earned ones)
- `getAchievements` result order matches the `ACHIEVEMENTS` constant
- Null/zero values from Prisma aggregations are handled as 0
- BigInt results from `$queryRaw` (EARLY_BIRD, NIGHT_OWL) are correctly converted with `Number()`
- Achievements are scoped per user (user A's achievements are not visible to user B)
