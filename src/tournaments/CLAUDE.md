# Tournaments Module

This module implements the competitive nutrition feature for Nutrilly. Users create or join tournaments, accumulate points by registering meals and hitting nutritional goals, and compete on a leaderboard.

---

## Architecture

### File Map

```
src/tournaments/
├── tournaments.types.ts           — Enums, default scoring rules, scoring event types
├── tournaments.service.ts         — CRUD, authorization, cascade delete
├── tournaments.controller.ts      — HTTP endpoints (10 routes)
├── tournaments.module.ts          — Module declaration; exports TournamentScoringService
├── tournament-scheduler.service.ts — Hourly cron: status transitions
├── scoring/
│   ├── scoring.service.ts         — processMealScoringEvent + processScoringEvent
│   ├── scoring.helpers.ts         — calculatePoints, isHealthyMeal, time helpers
│   ├── scoring.service.spec.ts    — Unit tests for scoring service
│   └── scoring.helpers.spec.ts    — Unit tests for scoring helpers
├── tournaments.service.spec.ts    — Unit tests for tournament service
├── dto/
│   ├── create-tournament.dto.ts
│   ├── update-tournament.dto.ts   — Includes scoring rule overrides
│   ├── join-tournament.dto.ts
│   └── update-member-role.dto.ts
```

### Dependency Graph

```
AppModule
  ├── TournamentsModule ──────────────────────────────────────────┐
  │     ├── TournamentsService (uses PrismaService)               │
  │     ├── TournamentScoringService (uses PrismaService)  ◄──────┤ (exported)
  │     └── TournamentSchedulerService (uses PrismaService)       │
  │                                                               │
  ├── DiaryModule ──────── imports TournamentsModule ─────────────┤
  ├── WeightModule ─────── imports TournamentsModule ─────────────┤
  └── DashboardModule ──── imports TournamentsModule ─────────────┘
```

**TournamentsModule exports only `TournamentScoringService`** — the minimal surface needed by other modules.

---

## Database Models

All models use MongoDB via Prisma 5. No `onDelete: Cascade` (not supported by MongoDB connector) — cascade deletes are handled manually in `TournamentsService.deleteTournamentCascade()`.

### Tournament
Core entity. Status is stored as a plain string (`"UPCOMING"` | `"ACTIVE"` | `"ENDED"`) since Prisma enums have limited MongoDB support.

### TournamentMember
Join table between `User` and `Tournament`. Role is stored as `"MEMBER"` | `"ADMIN"`. A tournament always has at least one ADMIN.

`@@unique([tournamentId, userId])` — one membership per user per tournament.

### TournamentScoringRule
Configurable point values per tournament. 7 rules seeded on creation. Admins can enable/disable rules and change point values via `PATCH /tournaments/:id`.

`@@unique([tournamentId, type])` — one rule per type per tournament.

### TournamentActivity
Immutable log of every scoring event. Contains denormalized metadata (mealName, weightKg, etc.) for display in the activity feed. Points are stored at creation time so historical records remain accurate even after rule changes.

---

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/tournaments` | member | All user's tournaments |
| GET | `/tournaments/active` | member | ACTIVE tournaments only (for meal-log selector) |
| GET | `/tournaments/:id` | member | Full detail with members + activities + rules |
| POST | `/tournaments` | any user | Create tournament + seed rules + add creator as ADMIN |
| POST | `/tournaments/join` | any user | Join via invite code |
| PATCH | `/tournaments/:id` | admin | Edit title/description/banner/rules |
| DELETE | `/tournaments/:id` | member | Leave (or delete if last admin) |
| DELETE | `/tournaments/:id/members/:userId` | admin | Kick a member |
| PATCH | `/tournaments/:id/members/:userId/role` | admin | Promote/demote member |
| DELETE | `/tournaments/:id/activities/:actId` | admin | Remove activity + revert points |

---

## Authorization Model

| Action | Requirement |
|--------|-------------|
| Read tournament | Member |
| Create tournament | Any authenticated user |
| Join tournament | Any authenticated user (with valid invite code) |
| Leave tournament | Member |
| Edit title/description/banner | Admin |
| Enable/disable/change scoring rules | Admin |
| Remove a member | Admin (cannot remove self) |
| Promote/demote member | Admin |
| Demote last admin | **Forbidden** — must promote another member first |
| Delete activity + revert points | Admin |
| Delete entire tournament | Last remaining admin (triggered by `DELETE /tournaments/:id`) |

Authorization is enforced by `assertAdmin(userId, tournamentId)` (private method in `TournamentsService`) which throws `ForbiddenException` if the member is not found or not an admin.

---

## Invite Code

Format: `XXXX-YYYY` where X and Y are uppercase letters or digits (e.g., `KBCD-4827`).

Generated with `crypto.randomBytes(8)` mapped to a charset of 36 characters. Stored on the `Tournament` model as a `@unique` field. Collision retry loop ensures uniqueness in the (astronomically unlikely) event of a collision.

Exposed in `GET /tournaments/:id` so admins can share it with potential members.

---

## Scoring Engine

### Two entry points

#### `processMealScoringEvent(userId, event, tournamentIds)`
Called manually from `POST /diary/:date/:mealId`. The user explicitly selects which active tournaments should receive points for this meal.

- Filters tournaments by: `id IN tournamentIds AND status = 'ACTIVE' AND user is member`
- Can be called multiple times per diary entry (once per applicable event type)

```typescript
// In diary.service.ts
await scoring.processMealScoringEvent(userId, { type: 'MEAL_LOGGED', payload }, tournamentIds);
if (isHealthyMeal(...)) {
  await scoring.processMealScoringEvent(userId, { type: 'HEALTHY_MEAL', payload }, tournamentIds);
} else if (kcal > 800) {
  await scoring.processMealScoringEvent(userId, { type: 'UNHEALTHY_MEAL', payload }, tournamentIds);
}
```

#### `processScoringEvent(userId, event)`
Called automatically for non-meal events. Applies to **all active tournaments** the user belongs to.

```
POST /weight            → WEIGHT_LOSS (if new weight < previous weight)
GET  /dashboard/summary → DAILY_GOAL_MET (if totalKcal >= caloriesGoal)
GET  /dashboard/summary → WATER_GOAL_MET (if totalWaterMl >= waterGoalMl)
```

### Idempotency

`DAILY_GOAL_MET` and `WATER_GOAL_MET` are idempotent per (tournament, user, date). Before creating an activity, the engine checks for an existing record with the same `tournamentId + userId + type + date`. If found, the event is skipped.

This prevents double-scoring when `GET /dashboard/summary` is called multiple times on the same day.

### Point calculation (`calculatePoints`)

| Type | Formula |
|------|---------|
| MEAL_LOGGED | `rule.points` |
| HEALTHY_MEAL | `rule.points` |
| UNHEALTHY_MEAL | `rule.points` (typically negative, e.g. -10) |
| DAILY_GOAL_MET | `rule.points` |
| WATER_GOAL_MET | `rule.points` |
| CALORIES_BURNED | `floor(caloriesBurned / 100) × rule.points` |
| WEIGHT_LOSS | `floor((previousKg - newKg) / 0.1) × rule.points` |

Points can be negative. There is no floor at zero.

### HEALTHY_MEAL detection (`isHealthyMeal`)

A meal qualifies as healthy when **all three** conditions are met:
1. `kcal < 600`
2. `(protein × 4 / macroCals) × 100 >= 25%`
3. `(fat × 9 / macroCals) × 100 <= 35%`

This mirrors the `EntryQuality.Good` classification in the diary module.

### Leaderboard recalculation (`recalculatePositions`)

Called after every scoring event and after every activity deletion. Members are sorted by `points DESC, joinedAt ASC` (ties broken by join date — earlier members rank higher). Positions are written back as integers starting at 1.

---

## Default Scoring Rules

Seeded automatically when a tournament is created:

| Type | Label | Points | Unit |
|------|-------|--------|------|
| MEAL_LOGGED | Refeição registrada | +10 | — |
| HEALTHY_MEAL | Refeição saudável | +25 | — |
| UNHEALTHY_MEAL | Refeição pesada | -10 | — |
| DAILY_GOAL_MET | Meta diária batida | +50 | — |
| WATER_GOAL_MET | Meta de água | +30 | — |
| CALORIES_BURNED | Calorias queimadas | +5 | per 100kcal |
| WEIGHT_LOSS | Perda de peso | +100 | per 0.1kg |

---

## Status Lifecycle

```
UPCOMING ──(startDate reached)──▶ ACTIVE ──(endDate reached)──▶ ENDED
```

Managed by `TournamentSchedulerService` which runs every hour via `@Cron(CronExpression.EVERY_HOUR)`:

```typescript
// UPCOMING → ACTIVE
tournament.updateMany({ where: { status: 'UPCOMING', startDate: { lte: now } } })

// ACTIVE → ENDED
tournament.updateMany({ where: { status: 'ACTIVE', endDate: { lt: now }, NOT: { endDate: null } } })
```

Tournaments without an `endDate` remain ACTIVE indefinitely (open-ended).

Requires `ScheduleModule.forRoot()` in `AppModule` (already configured).

---

## Response Serialization

All enum values are serialized to **lowercase** in responses to match frontend expectations:

| Database | API response |
|----------|-------------|
| `"ACTIVE"` | `"active"` |
| `"UPCOMING"` | `"upcoming"` |
| `"ENDED"` | `"ended"` |
| `"ADMIN"` | `"admin"` |
| `"MEMBER"` | `"member"` |

Additionally:
- `members` is sorted by `position ASC`
- `activities` is sorted by `createdAt DESC`

---

## Error Codes

| Scenario | HTTP Status | Message |
|----------|-------------|---------|
| Tournament not found | 404 | `Tournament not found` |
| Invite code doesn't exist | 404 | `Invalid invite code` |
| Tournament is ENDED | 400 | `Tournament has already ended` |
| Already a member | 409 | `You are already a member of this tournament` |
| Not a member | 403 | `You are not a member of this tournament` |
| Not an admin | 403 | `Admin access required` |
| Admin tries to remove self | 400 | `Use the leave endpoint to remove yourself` |
| Demoting last admin | 400 | `Cannot demote the last admin` |
| Activity not found | 404 | `Activity not found` |
| Member not found | 404 | `Member not found` |

---

## Testing

### Test files

| File | Coverage |
|------|---------|
| `scoring/scoring.helpers.spec.ts` | `calculatePoints` (all 7 types), `isHealthyMeal`, `getCurrentTime/Date` |
| `scoring/scoring.service.spec.ts` | `processMealScoringEvent`, `processScoringEvent`, `recalculatePositions` |
| `tournaments.service.spec.ts` | CRUD, authorization, leave scenarios, role management, point reversion |

### Key test scenarios

**Scoring helpers:**
- CALORIES_BURNED: boundary at 100kcal, correct floor math (350kcal → 3 units)
- WEIGHT_LOSS: boundary at 0.1kg, loss < 0.1kg → 0 points, 0.5kg → 5 units × 100

**Scoring service:**
- Skips disabled rules
- Skips missing rule types
- Idempotency for DAILY_GOAL_MET and WATER_GOAL_MET
- Skips WEIGHT_LOSS when points = 0
- Correct position ordering with tie-breaking

**Tournament service:**
- Last admin leave → full cascade delete
- Admin with co-admins leave → only removes self
- Demote last admin → BadRequestException
- Remove activity → decrements points, recalculates positions

### Mocking pattern

All tests use NestJS `TestingModule` with manual mocks for `PrismaService` and `TournamentScoringService`. No database connection is required. Pattern follows the existing `diary.service.spec.ts` convention.

---

## Key Business Rules

1. **At least one admin always**: Cannot demote the last admin. Last admin must delete the tournament (via leave) or promote another member first.
2. **Points can be negative**: UNHEALTHY_MEAL applies a -10 penalty. Revoking activities also decrements — no floor at zero.
3. **Meal scoring is opt-in**: Meals only score in tournaments the user explicitly selects via `tournamentIds` in the diary POST body.
4. **Goal scoring is automatic**: Dashboard and weight endpoints auto-score in all active tournaments.
5. **Open-ended tournaments**: `endDate` is optional. Omitting it creates a tournament that stays ACTIVE indefinitely.
6. **Re-joining**: A user who was removed can re-join with the invite code. They start with 0 points (no point restoration).
7. **Scores are per-tournament**: Points and positions are completely independent across tournaments.
8. **Historical integrity**: Activity records store point values at creation time. Changing a rule's point value does not retroactively affect past activities.
