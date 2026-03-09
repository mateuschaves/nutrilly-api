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
  @ApiProperty({ example: 'uuid-of-food' })
  @IsUUID()
  foodId: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0)
  grams: number;
}

export class CreateMealDto {
  @ApiProperty({ example: 'breakfast', enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsString()
  name: string;

  @ApiProperty({ required: false, description: 'ISO date string for when the meal was eaten' })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;

  @ApiProperty({ type: [MealItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items: MealItemDto[];
}
