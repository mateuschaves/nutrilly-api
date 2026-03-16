import { IsString, IsInt, IsNumber, IsNotEmpty, IsOptional, Min } from 'class-validator';

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
}
