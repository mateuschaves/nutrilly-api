import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsIn,
  IsPositive,
  ValidateNested,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class OnboardingDailyGoalsDto {
  @ApiProperty({ example: 2200, description: 'Daily calorie goal in kcal' })
  @IsNumber()
  @IsPositive()
  calories: number;

  @ApiProperty({ example: 150, description: 'Daily protein goal in grams' })
  @IsNumber()
  @IsPositive()
  proteinG: number;

  @ApiProperty({ example: 250, description: 'Daily carbs goal in grams' })
  @IsNumber()
  @IsPositive()
  carbsG: number;

  @ApiProperty({ example: 70, description: 'Daily fat goal in grams' })
  @IsNumber()
  @IsPositive()
  fatG: number;

  @ApiProperty({ example: 2.6, description: 'Daily water goal in liters' })
  @IsNumber()
  @IsPositive()
  waterL: number;
}

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'lose_weight', enum: ['lose_weight', 'maintain', 'gain_muscle'] })
  @IsIn(['lose_weight', 'maintain', 'gain_muscle'])
  goal: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female'] })
  @IsIn(['male', 'female'])
  sex: string;

  @ApiProperty({ example: 78.5, description: 'Weight in kg' })
  @IsNumber()
  @IsPositive()
  weightKg: number;

  @ApiProperty({ example: 178, description: 'Height in cm' })
  @IsNumber()
  @IsPositive()
  heightCm: number;

  @ApiProperty({ example: '1995-06-15', description: 'Birthdate in ISO YYYY-MM-DD format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthdate must be in YYYY-MM-DD format' })
  birthdate: string;

  @ApiProperty({ example: 'active', enum: ['sedentary', 'lightly_active', 'active', 'very_active'] })
  @IsIn(['sedentary', 'lightly_active', 'active', 'very_active'])
  activityLevel: string;

  @ApiProperty({ type: OnboardingDailyGoalsDto })
  @ValidateNested()
  @Type(() => OnboardingDailyGoalsDto)
  dailyGoals: OnboardingDailyGoalsDto;
}
