import { ApiProperty } from '@nestjs/swagger';

export class FoodResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Chicken Breast' })
  name: string;

  @ApiProperty({ example: 165, description: 'Calories per 100g' })
  calories_per_100g: number;

  @ApiProperty({ example: 31, description: 'Protein in grams per 100g' })
  protein_per_100g: number;

  @ApiProperty({ example: 0, description: 'Carbohydrates in grams per 100g' })
  carbs_per_100g: number;

  @ApiProperty({ example: 3.6, description: 'Fat in grams per 100g' })
  fat_per_100g: number;
}
