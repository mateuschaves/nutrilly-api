import { ApiProperty } from '@nestjs/swagger';

export class GoalsResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  user_id: string;

  @ApiProperty({ example: 2000, description: 'Daily calorie goal' })
  calories_goal: number;

  @ApiProperty({ example: 150, description: 'Daily protein goal in grams' })
  protein_goal: number;

  @ApiProperty({ example: 250, description: 'Daily carbohydrate goal in grams' })
  carbs_goal: number;

  @ApiProperty({ example: 65, description: 'Daily fat goal in grams' })
  fat_goal: number;

  @ApiProperty({ example: 2000, description: 'Daily water goal in milliliters' })
  water_goal_ml: number;
}
