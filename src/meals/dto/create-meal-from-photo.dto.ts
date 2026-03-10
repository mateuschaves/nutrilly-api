import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMealFromPhotoDto {
  @ApiProperty({
    example: 'lunch',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    description: 'Type of meal',
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    description: 'ISO 8601 date-time for when the meal was eaten (defaults to now)',
    example: '2024-01-15T12:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;
}
