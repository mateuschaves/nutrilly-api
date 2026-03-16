-- AlterTable
ALTER TABLE "user_goals" ADD COLUMN "energy_unit" TEXT NOT NULL DEFAULT 'kcal';
ALTER TABLE "user_goals" ADD COLUMN "water_unit" TEXT NOT NULL DEFAULT 'l';
