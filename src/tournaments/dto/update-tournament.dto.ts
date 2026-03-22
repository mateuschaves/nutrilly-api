import { IsString, IsOptional, IsBoolean, IsInt, IsArray, ValidateNested, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScoringRuleDto {
  @ApiProperty({
    example: 'UNHEALTHY_MEAL',
    enum: ['MEAL_LOGGED', 'HEALTHY_MEAL', 'UNHEALTHY_MEAL', 'DAILY_GOAL_MET', 'WATER_GOAL_MET', 'CALORIES_BURNED', 'WEIGHT_LOSS'],
    description: 'Scoring rule type to update',
  })
  @IsString()
  type: string;

  @ApiProperty({ example: false, description: 'Enable or disable this rule' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    example: -20,
    description: 'Override the point value for this rule. Omit to keep the current value.',
  })
  @IsOptional()
  @IsInt()
  points?: number;
}

export class UpdateTournamentDto {
  @ApiPropertyOptional({ example: 'Desafio Fevereiro' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Nova descrição do torneio' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/new-banner.jpg',
    description: 'New banner image URL',
  })
  @IsOptional()
  @IsString()
  bannerUri?: string;

  @ApiPropertyOptional({
    type: [UpdateScoringRuleDto],
    description: 'Partial list of scoring rules to update. Only provided rules are changed.',
    example: [{ type: 'UNHEALTHY_MEAL', enabled: false }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateScoringRuleDto)
  scoringRules?: UpdateScoringRuleDto[];

  @ApiPropertyOptional({ example: true, description: 'Enable or disable the score limit for this tournament' })
  @IsOptional()
  @IsBoolean()
  scoreLimitEnabled?: boolean;

  @ApiPropertyOptional({ example: 200, description: 'Maximum points a member can earn per period (min: 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  scoreLimitMaxPts?: number;

  @ApiPropertyOptional({ example: 'DAY', enum: ['DAY', 'WEEK', 'MONTH'], description: 'Period for the score limit' })
  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH'])
  scoreLimitPeriod?: string;
}
