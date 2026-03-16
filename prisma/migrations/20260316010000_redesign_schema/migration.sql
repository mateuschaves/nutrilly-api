-- DropTable (old schema — order matters to avoid FK violations)
DROP TABLE IF EXISTS "suspicious_photos";
DROP TABLE IF EXISTS "meal_items";
DROP TABLE IF EXISTS "daily_summaries";
DROP TABLE IF EXISTS "meals";
DROP TABLE IF EXISTS "foods";
DROP TABLE IF EXISTS "water_logs";
DROP TABLE IF EXISTS "user_goals";
DROP TABLE IF EXISTS "user_preferences";
DROP TABLE IF EXISTS "streaks";

-- AlterTable users: rename snake_case → camelCase columns
ALTER TABLE "users" RENAME COLUMN "password_hash" TO "passwordHash";
ALTER TABLE "users" RENAME COLUMN "google_id"     TO "googleId";
ALTER TABLE "users" RENAME COLUMN "apple_id"      TO "appleId";
ALTER TABLE "users" RENAME COLUMN "created_at"    TO "createdAt";
ALTER TABLE "users" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recreate unique indexes with new column names
DROP INDEX IF EXISTS "users_google_id_key";
DROP INDEX IF EXISTS "users_apple_id_key";
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");

-- CreateTable user_unit_preferences
CREATE TABLE "user_unit_preferences" (
    "userId" TEXT NOT NULL,
    "energy" TEXT NOT NULL DEFAULT 'kcal',
    "water"  TEXT NOT NULL DEFAULT 'l',
    "weight" TEXT NOT NULL DEFAULT 'kg',
    "height" TEXT NOT NULL DEFAULT 'cm',
    CONSTRAINT "user_unit_preferences_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_unit_preferences" ADD CONSTRAINT "user_unit_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable user_profiles
CREATE TABLE "user_profiles" (
    "userId"        TEXT NOT NULL,
    "birthdate"     TEXT,
    "sex"           TEXT,
    "weightKg"      DOUBLE PRECISION,
    "heightCm"      DOUBLE PRECISION,
    "goal"          TEXT,
    "activityLevel" TEXT,
    "caloriesGoal"  INTEGER NOT NULL DEFAULT 2200,
    "proteinGoalG"  DOUBLE PRECISION NOT NULL DEFAULT 150,
    "carbsGoalG"    DOUBLE PRECISION NOT NULL DEFAULT 250,
    "fatGoalG"      DOUBLE PRECISION NOT NULL DEFAULT 70,
    "waterGoalMl"   INTEGER NOT NULL DEFAULT 2600,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable meals (user-defined meal categories)
CREATE TABLE "meals" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "icon"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "meals_userId_idx" ON "meals"("userId");
ALTER TABLE "meals" ADD CONSTRAINT "meals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable diary_entries
CREATE TABLE "diary_entries" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "mealId"   TEXT NOT NULL,
    "date"     TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "kcal"     INTEGER NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG"   DOUBLE PRECISION NOT NULL,
    "fatG"     DOUBLE PRECISION NOT NULL,
    "portion"  TEXT NOT NULL,
    "photoUri" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "diary_entries_userId_date_idx" ON "diary_entries"("userId", "date");
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_mealId_fkey"
    FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable hydration_entries
CREATE TABLE "hydration_entries" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "date"     TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hydration_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hydration_entries_userId_date_idx" ON "hydration_entries"("userId", "date");
ALTER TABLE "hydration_entries" ADD CONSTRAINT "hydration_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
