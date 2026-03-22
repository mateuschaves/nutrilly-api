import { IsString, IsOptional, IsBoolean, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateScoringRuleDto {
  @IsString()
  type: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  points?: number;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUri?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateScoringRuleDto)
  scoringRules?: UpdateScoringRuleDto[];
}
