import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class AnalyzeMealDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  photoBase64?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
