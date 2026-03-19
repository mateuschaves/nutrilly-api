import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AchievementDto {
  @ApiProperty({ example: 'STREAK_14' })
  key: string;

  @ApiProperty({ example: '14-Day Streak' })
  name: string;

  @ApiProperty({ example: '14' })
  icon: string;

  @ApiProperty({ example: '14 consecutive days with diary entries' })
  description: string;

  @ApiProperty({ example: 'consistency', enum: ['consistency', 'hydration', 'nutrition', 'behavior', 'milestone'] })
  category: string;

  @ApiProperty()
  earned: boolean;

  @ApiPropertyOptional({ example: '2026-03-19T10:00:00.000Z', nullable: true })
  earnedAt: string | null;
}
