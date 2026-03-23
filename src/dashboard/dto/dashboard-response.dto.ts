import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CaloriesSummaryDto {
  @ApiProperty({ example: 1200, description: 'Calories consumed in the user\'s preferred energy unit' })
  consumed: number;

  @ApiProperty({ example: 2000, description: 'Daily calorie goal in the user\'s preferred energy unit' })
  goal: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kJ'] })
  unit: string;
}

export class MacroItemDto {
  @ApiProperty({ example: 'Protein', description: 'Macro name' })
  label: string;

  @ApiProperty({ example: 87, description: 'Amount consumed in grams' })
  value: number;

  @ApiProperty({ example: 'g', description: 'Unit (always grams)' })
  unit: string;

  @ApiProperty({ example: 'protein', enum: ['protein', 'carbs', 'fat'] })
  type: string;
}

export class WaterSummaryDto {
  @ApiProperty({ example: 1.8, description: 'Water consumed in the user\'s preferred water unit' })
  consumed: number;

  @ApiProperty({ example: 2.6, description: 'Daily water goal in the user\'s preferred water unit' })
  goal: number;

  @ApiProperty({ example: 'l', enum: ['l', 'fl_oz'] })
  unit: string;
}

export class LastMealDto {
  @ApiProperty({ example: 'Almoço', description: 'Name of the meal' })
  name: string;

  @ApiProperty({ example: 600, description: 'Calories of the last meal in the user\'s preferred energy unit' })
  calories: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kJ'] })
  unit: string;

  @ApiProperty({ example: 2, description: 'Hours since the meal was logged' })
  hoursAgo: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: CaloriesSummaryDto })
  calories: CaloriesSummaryDto;

  @ApiProperty({ type: [MacroItemDto] })
  macros: MacroItemDto[];

  @ApiProperty({ type: WaterSummaryDto })
  water: WaterSummaryDto;

  @ApiPropertyOptional({ type: LastMealDto, nullable: true })
  lastMeal: LastMealDto | null;

  @ApiProperty({ example: 7, description: 'Current consecutive-day streak' })
  streak: number;
}
