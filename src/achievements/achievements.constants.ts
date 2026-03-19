export enum AchievementKey {
  FIRST_LOG = 'FIRST_LOG',
  PERFECT_WEEK = 'PERFECT_WEEK',
  STREAK_14 = 'STREAK_14',
  STREAK_21 = 'STREAK_21',
  MARATHON = 'MARATHON',
  HYDRATION_HERO = 'HYDRATION_HERO',
  WATER_WEEK = 'WATER_WEEK',
  PROTEIN_PRO = 'PROTEIN_PRO',
  CALORIE_MASTER = 'CALORIE_MASTER',
  TRIPLE_CROWN = 'TRIPLE_CROWN',
  QUALITY_STREAK = 'QUALITY_STREAK',
  EARLY_BIRD = 'EARLY_BIRD',
  PHOTO_FOODIE = 'PHOTO_FOODIE',
  NIGHT_OWL = 'NIGHT_OWL',
  CENTURION = 'CENTURION',
  WEEK_COMPLETE = 'WEEK_COMPLETE',
}

export type AchievementCategory =
  | 'consistency'
  | 'hydration'
  | 'nutrition'
  | 'behavior'
  | 'milestone';

export interface AchievementDefinition {
  key: AchievementKey;
  name: string;
  icon: string;
  description: string;
  category: AchievementCategory;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Consistency
  {
    key: AchievementKey.FIRST_LOG,
    name: 'First Step',
    icon: '🌱',
    description: 'Logged your first meal',
    category: 'consistency',
  },
  {
    key: AchievementKey.PERFECT_WEEK,
    name: 'Perfect Week',
    icon: 'W',
    description: '7 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: AchievementKey.STREAK_14,
    name: '14-Day Streak',
    icon: '14',
    description: '14 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: AchievementKey.STREAK_21,
    name: '21-Day Record',
    icon: '21',
    description: '21 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: AchievementKey.MARATHON,
    name: 'Marathon',
    icon: '30',
    description: '30 consecutive days with diary entries',
    category: 'consistency',
  },

  // Hydration
  {
    key: AchievementKey.HYDRATION_HERO,
    name: 'Hydration Hero',
    icon: 'H',
    description: 'Met your daily water goal at least once',
    category: 'hydration',
  },
  {
    key: AchievementKey.WATER_WEEK,
    name: 'Water Week',
    icon: '💧',
    description: 'Met your daily water goal 7 days in a row',
    category: 'hydration',
  },

  // Nutrition
  {
    key: AchievementKey.PROTEIN_PRO,
    name: 'Protein Pro',
    icon: 'P',
    description: 'Met your daily protein goal at least once',
    category: 'nutrition',
  },
  {
    key: AchievementKey.CALORIE_MASTER,
    name: 'Calorie Master',
    icon: 'C',
    description: 'Hit your calorie goal (±10%) on 3 different days',
    category: 'nutrition',
  },
  {
    key: AchievementKey.TRIPLE_CROWN,
    name: 'Triple Crown',
    icon: '👑',
    description: 'Hit calories, protein and water goals in the same day',
    category: 'nutrition',
  },
  {
    key: AchievementKey.QUALITY_STREAK,
    name: 'Quality Streak',
    icon: '⭐',
    description: 'Logged 5 high-quality entries in one day',
    category: 'nutrition',
  },

  // Behavior
  {
    key: AchievementKey.EARLY_BIRD,
    name: 'Early Bird',
    icon: 'E',
    description: 'Logged a meal before 8am',
    category: 'behavior',
  },
  {
    key: AchievementKey.PHOTO_FOODIE,
    name: 'Photo Foodie',
    icon: '📸',
    description: 'Added a photo to 5 diary entries',
    category: 'behavior',
  },
  {
    key: AchievementKey.NIGHT_OWL,
    name: 'Night Owl',
    icon: '🦉',
    description: 'Logged a meal after 9pm at least 3 times',
    category: 'behavior',
  },

  // Milestone
  {
    key: AchievementKey.CENTURION,
    name: 'Centurion',
    icon: '💯',
    description: '100 total diary entries logged',
    category: 'milestone',
  },
  {
    key: AchievementKey.WEEK_COMPLETE,
    name: 'Week Complete',
    icon: '✅',
    description: 'Logged all 7 days of a calendar week (Mon–Sun)',
    category: 'milestone',
  },
];
