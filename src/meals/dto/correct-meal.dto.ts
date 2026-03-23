import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class CurrentAnalysisDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  portion: string;

  @IsNumber()
  @Min(0)
  calories: number;

  @IsNumber()
  @Min(0)
  protein: number;

  @IsNumber()
  @Min(0)
  carbs: number;

  @IsNumber()
  @Min(0)
  fat: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CorrectMealDto {
  @ValidateNested()
  @Type(() => CurrentAnalysisDto)
  current: CurrentAnalysisDto;

  @IsString()
  @IsNotEmpty()
  correction: string;
}
