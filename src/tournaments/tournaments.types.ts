export const ScoreLimitPeriod = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
} as const;
export type ScoreLimitPeriod = (typeof ScoreLimitPeriod)[keyof typeof ScoreLimitPeriod];

export interface ScoringResult {
  tournamentId: string;
  points: number;
  limitReached: boolean;
}

export const TournamentStatus = {
  UPCOMING: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const;
export type TournamentStatus = (typeof TournamentStatus)[keyof typeof TournamentStatus];

export const TournamentMemberRole = {
  MEMBER: 'MEMBER',
  ADMIN: 'ADMIN',
} as const;
export type TournamentMemberRole = (typeof TournamentMemberRole)[keyof typeof TournamentMemberRole];

export const ScoringRuleType = {
  MEAL_LOGGED: 'MEAL_LOGGED',
  HEALTHY_MEAL: 'HEALTHY_MEAL',
  UNHEALTHY_MEAL: 'UNHEALTHY_MEAL',
  DAILY_GOAL_MET: 'DAILY_GOAL_MET',
  WATER_GOAL_MET: 'WATER_GOAL_MET',
  CALORIES_BURNED: 'CALORIES_BURNED',
  WEIGHT_LOSS: 'WEIGHT_LOSS',
} as const;
export type ScoringRuleType = (typeof ScoringRuleType)[keyof typeof ScoringRuleType];

export interface DefaultScoringRule {
  type: ScoringRuleType;
  label: string;
  description: string;
  points: number;
  unit: string | null;
  emoji: string;
}

export const DEFAULT_SCORING_RULES: DefaultScoringRule[] = [
  {
    type: ScoringRuleType.MEAL_LOGGED,
    label: 'Refeição registrada',
    description: 'Pontua ao registrar qualquer refeição no torneio',
    points: 10,
    unit: null,
    emoji: '🍽️',
  },
  {
    type: ScoringRuleType.HEALTHY_MEAL,
    label: 'Refeição saudável',
    description: 'Refeição balanceada: menos de 600kcal e macros equilibrados',
    points: 25,
    unit: null,
    emoji: '🥗',
  },
  {
    type: ScoringRuleType.UNHEALTHY_MEAL,
    label: 'Refeição pesada',
    description: 'Penalidade para refeições acima de 800kcal',
    points: -10,
    unit: null,
    emoji: '🍔',
  },
  {
    type: ScoringRuleType.DAILY_GOAL_MET,
    label: 'Meta diária batida',
    description: 'Meta diária de calorias atingida',
    points: 50,
    unit: null,
    emoji: '🎯',
  },
  {
    type: ScoringRuleType.WATER_GOAL_MET,
    label: 'Meta de água',
    description: 'Meta diária de ingestão de água atingida',
    points: 30,
    unit: null,
    emoji: '💧',
  },
  {
    type: ScoringRuleType.CALORIES_BURNED,
    label: 'Calorias queimadas',
    description: 'Pontos por calorias queimadas em exercícios',
    points: 5,
    unit: 'per 100kcal',
    emoji: '🏃',
  },
  {
    type: ScoringRuleType.WEIGHT_LOSS,
    label: 'Perda de peso',
    description: 'Pontos por redução de peso registrada',
    points: 100,
    unit: 'per 0.1kg',
    emoji: '⚖️',
  },
];

// Scoring event types

export interface MealScoringPayload {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export interface DailyGoalPayload {
  date: string; // YYYY-MM-DD
}

export interface WeightLossPayload {
  weightKg: number;
  previousWeightKg: number;
  date: string; // YYYY-MM-DD
}

export interface CaloriesBurnedPayload {
  caloriesBurned: number;
  date: string; // YYYY-MM-DD
}

export interface MealScoringEvent {
  type: 'MEAL_LOGGED' | 'HEALTHY_MEAL' | 'UNHEALTHY_MEAL';
  payload: MealScoringPayload;
}

export type ScoringEvent =
  | { type: 'DAILY_GOAL_MET'; payload: DailyGoalPayload }
  | { type: 'WATER_GOAL_MET'; payload: DailyGoalPayload }
  | { type: 'CALORIES_BURNED'; payload: CaloriesBurnedPayload }
  | { type: 'WEIGHT_LOSS'; payload: WeightLossPayload };
