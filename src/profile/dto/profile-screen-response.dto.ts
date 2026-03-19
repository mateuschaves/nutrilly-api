import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WeightValueDto {
  @ApiProperty({ example: 78.5 })
  value: number;

  @ApiProperty({ example: 'kg', enum: ['kg', 'lbs'] })
  unit: string;
}

export class HeightValueDto {
  @ApiPropertyOptional({ example: 178, description: 'Height in cm (when unit is cm)' })
  cm: number | null;

  @ApiPropertyOptional({ example: 5, description: 'Feet component (when unit is ft_in)' })
  feet: number | null;

  @ApiPropertyOptional({ example: 10, description: 'Inches component (when unit is ft_in)' })
  inches: number | null;

  @ApiProperty({ example: 'ft_in', enum: ['cm', 'ft_in'] })
  unit: string;
}

export class BodyStatsDto {
  @ApiPropertyOptional({ type: WeightValueDto, nullable: true })
  weight: WeightValueDto | null;

  @ApiPropertyOptional({ type: HeightValueDto, nullable: true })
  height: HeightValueDto | null;

  @ApiPropertyOptional({ example: 29, nullable: true, description: 'Age in years calculated from birthdate' })
  age: number | null;

  @ApiPropertyOptional({ example: 24.6, nullable: true, description: 'BMI calculated from weight and height' })
  bmi: number | null;
}

export class WeightProgressEntryDto {
  @ApiProperty({ example: '2026-02-11', description: 'Date of the measurement (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ example: 78.5 })
  value: number;

  @ApiProperty({ example: 'kg', enum: ['kg', 'lbs'] })
  unit: string;
}

export class WeightChangeDto {
  @ApiProperty({ example: 2.3 })
  value: number;

  @ApiProperty({ example: 'kg', enum: ['kg', 'lbs'] })
  unit: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down', 'stable'] })
  direction: 'up' | 'down' | 'stable';
}

export class WeightProgressDto {
  @ApiProperty({ type: [WeightProgressEntryDto] })
  entries: WeightProgressEntryDto[];

  @ApiProperty({ example: 9, description: 'Total number of weight log entries' })
  totalEntries: number;

  @ApiPropertyOptional({ type: WeightValueDto, nullable: true, description: 'Lowest recorded weight' })
  min: WeightValueDto | null;

  @ApiPropertyOptional({ type: WeightValueDto, nullable: true, description: 'Highest recorded weight' })
  max: WeightValueDto | null;

  @ApiPropertyOptional({
    type: WeightChangeDto,
    nullable: true,
    description: 'Overall change between the first and last log entry',
  })
  change: WeightChangeDto | null;
}

export class GoalProgressDto {
  @ApiProperty({ example: 1200 })
  consumed: number;

  @ApiProperty({ example: 2000 })
  goal: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kJ'] })
  unit: string;
}

export class MacroGoalDto {
  @ApiProperty({ example: 87, description: 'Grams consumed today' })
  consumed: number;

  @ApiProperty({ example: 156, description: 'Daily goal in grams' })
  goal: number;
}

export class WaterGoalDto {
  @ApiProperty({ example: 1.8 })
  consumed: number;

  @ApiProperty({ example: 2.6 })
  goal: number;

  @ApiProperty({ example: 'l', enum: ['l', 'fl_oz'] })
  unit: string;
}

export class DailyGoalsProgressDto {
  @ApiProperty({ type: GoalProgressDto })
  calories: GoalProgressDto;

  @ApiProperty({ type: MacroGoalDto })
  protein: MacroGoalDto;

  @ApiProperty({ type: WaterGoalDto })
  water: WaterGoalDto;
}

export class ProfileScreenResponseDto {
  @ApiProperty({ example: 'Mateus Henrique' })
  name: string;

  @ApiProperty({ example: 'mateus@nutrilly.app' })
  email: string;

  @ApiProperty({ example: 'MH', description: 'Initials derived from the user name for avatar display' })
  initials: string;

  @ApiPropertyOptional({
    example: 'gain_muscle',
    enum: ['lose_weight', 'maintain', 'gain_muscle'],
    nullable: true,
  })
  goal: string | null;

  @ApiProperty({ type: BodyStatsDto })
  bodyStats: BodyStatsDto;

  @ApiProperty({ type: WeightProgressDto })
  weightProgress: WeightProgressDto;

  @ApiProperty({ type: DailyGoalsProgressDto })
  dailyGoals: DailyGoalsProgressDto;
}
