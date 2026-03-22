import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TournamentScoringRuleResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  tournamentId: string;

  @ApiProperty({
    example: 'MEAL_LOGGED',
    enum: ['MEAL_LOGGED', 'HEALTHY_MEAL', 'UNHEALTHY_MEAL', 'DAILY_GOAL_MET', 'WATER_GOAL_MET', 'CALORIES_BURNED', 'WEIGHT_LOSS'],
    description: 'Scoring rule type',
  })
  type: string;

  @ApiProperty({ example: 'Refeição registrada' })
  label: string;

  @ApiProperty({ example: 'Pontua ao registrar qualquer refeição no torneio' })
  description: string;

  @ApiProperty({ example: 10, description: 'Points awarded (can be negative for penalties)' })
  points: number;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiPropertyOptional({
    example: 'per 100kcal',
    nullable: true,
    description: 'Unit used in point calculation. null for flat-rate rules.',
  })
  unit: string | null;

  @ApiProperty({ example: '🍽️' })
  emoji: string;
}

export class TournamentMemberResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  tournamentId: string;

  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  userId: string;

  @ApiProperty({
    example: 'member',
    enum: ['admin', 'member'],
    description: 'Member role serialized in lowercase',
  })
  role: string;

  @ApiProperty({ example: 150, description: 'Accumulated points (can be negative)' })
  points: number;

  @ApiProperty({ example: 1, description: 'Leaderboard position starting at 1, ordered by points DESC then joinedAt ASC' })
  position: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  joinedAt: string;
}

export class TournamentActivityResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  tournamentId: string;

  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  userId: string;

  @ApiProperty({
    example: 'MEAL_LOGGED',
    enum: ['MEAL_LOGGED', 'HEALTHY_MEAL', 'UNHEALTHY_MEAL', 'DAILY_GOAL_MET', 'WATER_GOAL_MET', 'CALORIES_BURNED', 'WEIGHT_LOSS'],
  })
  type: string;

  @ApiProperty({ example: 'Refeição registrada' })
  label: string;

  @ApiProperty({ example: '🍽️' })
  emoji: string;

  @ApiProperty({ example: 10, description: 'Points awarded at time of activity (immutable)' })
  points: number;

  @ApiProperty({ example: '2024-01-15', description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ example: '12:30', description: 'Time in HH:MM format' })
  time: string;

  @ApiPropertyOptional({ example: 'Almoço', nullable: true })
  mealName: string | null;

  @ApiPropertyOptional({ example: 450, nullable: true, description: 'Calories in kcal' })
  calories: number | null;

  @ApiPropertyOptional({ example: 35, nullable: true, description: 'Protein in grams' })
  protein: number | null;

  @ApiPropertyOptional({ example: 40, nullable: true, description: 'Carbohydrates in grams' })
  carbs: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true, description: 'Fat in grams' })
  fat: number | null;

  @ApiPropertyOptional({ example: 72.5, nullable: true, description: 'Logged weight in kg' })
  weightKg: number | null;

  @ApiPropertyOptional({ example: 300, nullable: true, description: 'Calories burned in exercise' })
  caloriesBurned: number | null;

  @ApiPropertyOptional({ example: 2.5, nullable: true, description: 'Water intake in liters' })
  waterLiters: number | null;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  createdAt: string;
}

export class TournamentResponseDto {
  @ApiProperty({ example: 'clx1y2z3a0000abc123def456' })
  id: string;

  @ApiProperty({ example: 'Desafio Janeiro Saudável' })
  title: string;

  @ApiProperty({ example: 'Quem acumular mais pontos no mês vence!' })
  description: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/banner.jpg',
    nullable: true,
    description: 'Banner image URL',
  })
  bannerUri: string | null;

  @ApiProperty({ example: 'KBCD-4827', description: 'Invite code in format XXXX-YYYY' })
  inviteCode: string;

  @ApiProperty({
    example: 'active',
    enum: ['upcoming', 'active', 'ended'],
    description: 'Tournament status serialized in lowercase',
  })
  status: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Tournament start date (ISO-8601)' })
  startDate: string;

  @ApiPropertyOptional({
    example: '2024-01-31T23:59:59.000Z',
    nullable: true,
    description: 'Tournament end date (ISO-8601). null means open-ended.',
  })
  endDate: string | null;

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-15T08:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({
    type: [TournamentMemberResponseDto],
    description: 'Members sorted by position (leaderboard order)',
  })
  members: TournamentMemberResponseDto[];

  @ApiProperty({
    type: [TournamentActivityResponseDto],
    description: 'Activity feed sorted by createdAt DESC',
  })
  activities: TournamentActivityResponseDto[];

  @ApiProperty({
    type: [TournamentScoringRuleResponseDto],
    description: 'All 7 scoring rules for this tournament',
  })
  scoringRules: TournamentScoringRuleResponseDto[];
}
