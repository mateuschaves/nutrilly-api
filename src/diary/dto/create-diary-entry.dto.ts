import { IsString, IsInt, IsNumber, IsNotEmpty, IsOptional, Min, IsArray } from 'class-validator';

export class CreateDiaryEntryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
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

  @IsString()
  @IsNotEmpty()
  portion: string;

  @IsOptional()
  @IsString()
  photoUri?: string;

  /**
   * IDs of active tournaments where this meal should score points.
   * Omit or send empty array to log without scoring in any tournament.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tournamentIds?: string[];
}
