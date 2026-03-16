import { IsString, IsInt, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class CreateMealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsInt()
  @Min(0)
  sortOrder: number;
}
