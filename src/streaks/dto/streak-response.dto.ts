import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StreakResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  user_id: string;

  @ApiProperty({ example: 7, description: 'Number of consecutive days the user has met their daily goals' })
  current_streak: number;

  @ApiProperty({ example: 30, description: 'All-time best streak in days' })
  best_streak: number;

  @ApiPropertyOptional({ example: '2024-01-14', description: 'Date when the user last hit their daily goal (ISO date)' })
  last_goal_hit_date: string | null;
}
