import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMealFromDescriptionDto {
  @ApiProperty({
    example: 'lunch',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '200g of grilled chicken breast with 150g of brown rice and a side salad',
  })
  @IsString()
  description: string;

  @ApiProperty({
    required: false,
    description: 'ISO date string for when the meal was eaten',
  })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;
}
