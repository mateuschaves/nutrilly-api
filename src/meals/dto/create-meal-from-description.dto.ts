import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMealFromDescriptionDto {
  @ApiProperty({
    example: 'lunch',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    description: 'Type of meal',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '200g of grilled chicken breast with 150g of brown rice and a side salad',
    description: 'Natural language description of what you ate. The more detail you provide, the more accurate the macro estimates will be.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    required: false,
    description: 'ISO 8601 date-time for when the meal was eaten (defaults to now)',
    example: '2024-01-15T12:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;
}
