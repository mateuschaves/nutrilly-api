import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  IsPositive,
  ValidateNested,
} from 'class-validator';

class DailyGoalsDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  calories?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  waterMl?: number;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  birthdate?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  sex?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  heightCm?: number;

  @IsOptional()
  @IsIn(['lose_weight', 'maintain', 'gain_muscle'])
  goal?: string;

  @IsOptional()
  @IsIn(['sedentary', 'lightly_active', 'active', 'very_active'])
  activityLevel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyGoalsDto)
  dailyGoals?: DailyGoalsDto;
}
