import { ApiProperty } from '@nestjs/swagger';
import { AchievementDto } from '../../achievements/dto/achievement-response.dto';

export class HydrationEntryResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 500, description: 'Amount in millilitres' })
  amountMl: number;

  @ApiProperty({ example: '2026-03-19T09:00:00.000Z' })
  loggedAt: Date;
}

export class AddHydrationEntryResponseDto extends HydrationEntryResponseDto {
  @ApiProperty({
    type: [AchievementDto],
    description: 'Achievements unlocked by this hydration entry. Empty array if none were unlocked.',
  })
  newAchievements: AchievementDto[];
}
