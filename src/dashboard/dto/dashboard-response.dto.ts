import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MacroProgressDto {
  @ApiProperty({ example: 120, description: 'Amount consumed in grams' })
  consumed: number;

  @ApiProperty({ example: 150, description: 'Daily goal in grams' })
  goal: number;
}

export class CaloriesProgressDto {
  @ApiProperty({ example: 1200, description: 'Calories consumed today' })
  consumed: number;

  @ApiProperty({ example: 2000, description: 'Daily calorie goal' })
  goal: number;

  @ApiProperty({ example: 800, description: 'Calories remaining to reach daily goal' })
  remaining: number;

  @ApiProperty({ example: 60.0, description: 'Percentage of daily calorie goal reached (0–100)' })
  progress_percent: number;
}

export class MacrosSummaryDto {
  @ApiProperty({ type: MacroProgressDto })
  protein: MacroProgressDto;

  @ApiProperty({ type: MacroProgressDto })
  carbs: MacroProgressDto;

  @ApiProperty({ type: MacroProgressDto })
  fat: MacroProgressDto;
}

export class HydrationProgressDto {
  @ApiProperty({ example: 1000, description: 'Water consumed today in milliliters' })
  consumed_ml: number;

  @ApiProperty({ example: 2000, description: 'Daily water goal in milliliters' })
  goal_ml: number;

  @ApiProperty({ example: 50.0, description: 'Percentage of daily water goal reached (0–100)' })
  progress_percent: number;
}

export class LastMealSummaryDto {
  @ApiProperty({ example: 'lunch', enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  name: string;

  @ApiProperty({ example: 600, description: 'Total calories of the last meal' })
  calories: number;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  eaten_at: string;
}

export class StreakSummaryDto {
  @ApiProperty({ example: 7, description: 'Number of consecutive days the user has met their daily goals' })
  current_streak: number;

  @ApiProperty({ example: 30, description: 'All-time best streak in days' })
  best_streak: number;

  @ApiProperty({ example: 23, description: 'Days remaining to beat the best streak' })
  days_to_record: number;
}

export class DashboardResponseDto {
  @ApiProperty({ example: '2024-01-15', description: 'Current date (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ type: CaloriesProgressDto })
  calories: CaloriesProgressDto;

  @ApiProperty({ type: MacrosSummaryDto })
  macros: MacrosSummaryDto;

  @ApiProperty({ type: HydrationProgressDto })
  hydration: HydrationProgressDto;

  @ApiPropertyOptional({ type: LastMealSummaryDto, nullable: true, description: "Summary of the user's most recent meal, or null if no meals logged" })
  last_meal: LastMealSummaryDto | null;

  @ApiProperty({ type: StreakSummaryDto })
  streak: StreakSummaryDto;
}
