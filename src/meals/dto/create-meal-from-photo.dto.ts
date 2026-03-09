import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMealFromPhotoDto {
  @ApiProperty({
    example: 'lunch',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
  })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    description: 'ISO date string for when the meal was eaten',
  })
  @IsOptional()
  @IsDateString()
  eaten_at?: string;
}
