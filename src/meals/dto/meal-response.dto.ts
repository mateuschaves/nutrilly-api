import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MealItemFoodDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Chicken Breast' })
  name: string;

  @ApiProperty({ example: 165 })
  calories_per_100g: number;

  @ApiProperty({ example: 31 })
  protein_per_100g: number;

  @ApiProperty({ example: 0 })
  carbs_per_100g: number;

  @ApiProperty({ example: 3.6 })
  fat_per_100g: number;
}

export class MealItemResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  meal_id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  food_id: string;

  @ApiProperty({ example: 150, description: 'Weight of the food item in grams' })
  grams: number;

  @ApiProperty({ example: 247.5, description: 'Total calories for this item' })
  calories: number;

  @ApiProperty({ example: 46.5, description: 'Total protein in grams for this item' })
  protein: number;

  @ApiProperty({ example: 0, description: 'Total carbohydrates in grams for this item' })
  carbs: number;

  @ApiProperty({ example: 5.4, description: 'Total fat in grams for this item' })
  fat: number;

  @ApiProperty({ type: MealItemFoodDto })
  food: MealItemFoodDto;
}

export class MealResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  user_id: string;

  @ApiProperty({ example: 'lunch', enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  name: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/bucket/meals/user123/photo.jpg', description: 'Presigned URL to the meal photo (valid for a limited time)' })
  photo_url: string | null;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  eaten_at: string;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  created_at: string;

  @ApiProperty({ type: [MealItemResponseDto] })
  items: MealItemResponseDto[];
}
