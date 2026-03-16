import { IsIn, IsOptional } from 'class-validator';

export class UpdateUnitsDto {
  @IsOptional()
  @IsIn(['kcal', 'kj'])
  energy?: string;

  @IsOptional()
  @IsIn(['l', 'fl_oz'])
  water?: string;

  @IsOptional()
  @IsIn(['kg', 'lbs'])
  weight?: string;

  @IsOptional()
  @IsIn(['cm', 'ft_in'])
  height?: string;
}
