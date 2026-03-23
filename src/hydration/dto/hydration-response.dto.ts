import { ApiProperty } from '@nestjs/swagger';
import { AchievementDto } from '../../achievements/dto/achievement-response.dto';

export class HydrationEntryResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 0.5, description: 'Amount in the user\'s preferred water unit' })
  amount: number;

  @ApiProperty({ example: 'l', enum: ['l', 'fl_oz'] })
  unit: string;

  @ApiProperty({ example: '2026-03-19T09:00:00.000Z' })
  loggedAt: Date;
}

export class HydrationByDateResponseDto {
  @ApiProperty({ type: [HydrationEntryResponseDto] })
  entries: HydrationEntryResponseDto[];

  @ApiProperty({ example: 1.8, description: 'Total water consumed in the user\'s preferred water unit' })
  totalConsumed: number;

  @ApiProperty({ example: 2.6, description: 'Daily water goal in the user\'s preferred water unit' })
  goal: number;

  @ApiProperty({ example: 'l', enum: ['l', 'fl_oz'] })
  unit: string;
}

export class AddHydrationEntryResponseDto extends HydrationEntryResponseDto {
  @ApiProperty({
    type: [AchievementDto],
    description: 'Achievements unlocked by this hydration entry. Empty array if none were unlocked.',
  })
  newAchievements: AchievementDto[];
}
