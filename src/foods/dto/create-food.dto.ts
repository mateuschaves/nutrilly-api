import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFoodDto {
  @ApiProperty({ example: 'Chicken Breast' })
  @IsString()
  name: string;

  @ApiProperty({ example: 165 })
  @IsNumber()
  @Min(0)
  calories_per_100g: number;

  @ApiProperty({ example: 31 })
  @IsNumber()
  @Min(0)
  protein_per_100g: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  carbs_per_100g: number;

  @ApiProperty({ example: 3.6 })
  @IsNumber()
  @Min(0)
  fat_per_100g: number;
}
