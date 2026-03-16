import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CaloriesSummaryDto {
  @ApiProperty({ example: 1840, description: 'Calories consumed (in user preferred unit)' })
  consumed: number;

  @ApiProperty({ example: 2200, description: 'Daily calorie goal (in user preferred unit)' })
  goal: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kj'] })
  unit: string;
}

export class MacroItemDto {
  @ApiProperty({ example: 'Protein', enum: ['Protein', 'Carbs', 'Fat'] })
  label: string;

  @ApiProperty({ example: 87, description: 'Amount consumed in grams' })
  value: number;

  @ApiProperty({ example: 'g' })
  unit: string;

  @ApiProperty({ example: 'rgba(100,220,180,0.22)', description: 'Accent color for UI rendering' })
  accentColor: string;
}

export class WaterSummaryDto {
  @ApiProperty({ example: 1.8, description: 'Water consumed (in user preferred unit)' })
  consumed: number;

  @ApiProperty({ example: 2.5, description: 'Daily water goal (in user preferred unit)' })
  goal: number;

  @ApiProperty({ example: 'l', enum: ['l', 'fl_oz'] })
  unit: string;
}

export class LastMealSummaryDto {
  @ApiProperty({ example: 'Grilled Salmon', description: 'Name of the last meal' })
  name: string;

  @ApiProperty({ example: 520, description: 'Calories of the last meal (in user preferred unit)' })
  calories: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kj'] })
  unit: string;

  @ApiProperty({ example: 2, description: 'Hours since the meal was logged' })
  hoursAgo: number;
}

export class DailySummaryResponseDto {
  @ApiProperty({ type: CaloriesSummaryDto })
  calories: CaloriesSummaryDto;

  @ApiProperty({ type: [MacroItemDto] })
  macros: MacroItemDto[];

  @ApiProperty({ type: WaterSummaryDto })
  water: WaterSummaryDto;

  @ApiPropertyOptional({ type: LastMealSummaryDto, nullable: true, description: "Last meal logged on the given date, or null" })
  lastMeal: LastMealSummaryDto | null;

  @ApiProperty({ example: 14, description: 'Number of consecutive days with logged meals' })
  streak: number;
}
