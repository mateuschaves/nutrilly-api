import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertGoalsDto {
  @ApiProperty({ example: 2000, description: 'Daily calorie goal' })
  @IsNumber()
  @Min(0)
  calories_goal: number;

  @ApiProperty({ example: 150, description: 'Daily protein goal in grams' })
  @IsNumber()
  @Min(0)
  protein_goal: number;

  @ApiProperty({ example: 250, description: 'Daily carbohydrate goal in grams' })
  @IsNumber()
  @Min(0)
  carbs_goal: number;

  @ApiProperty({ example: 65, description: 'Daily fat goal in grams' })
  @IsNumber()
  @Min(0)
  fat_goal: number;

  @ApiProperty({ example: 2000, description: 'Daily water goal in milliliters' })
  @IsNumber()
  @Min(0)
  water_goal_ml: number;
}
