import {
  IsString,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MealItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'UUID of the food item from the catalog' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ example: 150, description: 'Amount of food consumed in grams' })
  @IsNumber()
  @Min(0)
  grams: number;
}

export class CreateMealDto {
  @ApiProperty({ example: 'breakfast', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Type of meal' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, description: 'ISO 8601 date-time for when the meal was eaten (defaults to now)', example: '2024-01-15T12:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;

  @ApiProperty({ type: [MealItemDto], description: 'List of food items included in the meal' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items: MealItemDto[];
}
