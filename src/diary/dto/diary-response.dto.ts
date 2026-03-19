import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntryQuality } from '../diary.types';

export class DiaryEntryResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 'Greek Yogurt' })
  name: string;

  @ApiProperty({ example: 628, description: 'Calories in the user\'s preferred energy unit' })
  calories: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kJ'] })
  energyUnit: string;

  @ApiProperty({ example: 17, description: 'Protein in grams' })
  protein: number;

  @ApiProperty({ example: 8, description: 'Carbohydrates in grams' })
  carbs: number;

  @ApiProperty({ example: 4, description: 'Fat in grams' })
  fat: number;

  @ApiProperty({ example: '200g' })
  portion: string;

  @ApiProperty({ example: '7:30 AM' })
  time: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/photo.jpg', nullable: true })
  photoUri: string | null;

  @ApiPropertyOptional({
    enum: EntryQuality,
    enumName: 'EntryQuality',
    nullable: true,
    description: 'Macro quality classification based on caloric distribution. '
      + 'GOOD: protein ≥ 25% and fat ≤ 35%. '
      + 'POOR: protein < 15% or fat > 45%. '
      + 'FAIR: everything in between. '
      + 'null: entry has no calories.',
    example: EntryQuality.Good,
  })
  quality: EntryQuality | null;
}

export class MealSectionResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  mealId: string;

  @ApiProperty({ example: 'Breakfast' })
  mealName: string;

  @ApiProperty({ example: '🌅' })
  mealIcon: string;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: 628, description: 'Sum of calories for all entries in this meal' })
  totalCalories: number;

  @ApiProperty({ example: 'kcal', enum: ['kcal', 'kJ'] })
  energyUnit: string;

  @ApiProperty({ type: [DiaryEntryResponseDto] })
  entries: DiaryEntryResponseDto[];
}
