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
  kcal: number;

  @IsNumber()
  @Min(0)
  proteinG: number;

  @IsNumber()
  @Min(0)
  carbsG: number;

  @IsNumber()
  @Min(0)
  fatG: number;

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

  @IsOptional()
  @IsString()
  sessionId?: string;
}
