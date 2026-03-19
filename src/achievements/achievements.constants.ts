export type AchievementCategory =
  | 'consistency'
  | 'hydration'
  | 'nutrition'
  | 'behavior'
  | 'milestone';

export interface AchievementDefinition {
  key: string;
  name: string;
  icon: string;
  description: string;
  category: AchievementCategory;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Consistency
  {
    key: 'FIRST_LOG',
    name: 'First Step',
    icon: '🌱',
    description: 'Logged your first meal',
    category: 'consistency',
  },
  {
    key: 'PERFECT_WEEK',
    name: 'Perfect Week',
    icon: 'W',
    description: '7 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: 'STREAK_14',
    name: '14-Day Streak',
    icon: '14',
    description: '14 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: 'STREAK_21',
    name: '21-Day Record',
    icon: '21',
    description: '21 consecutive days with diary entries',
    category: 'consistency',
  },
  {
    key: 'MARATHON',
    name: 'Marathon',
    icon: '30',
    description: '30 consecutive days with diary entries',
    category: 'consistency',
  },

  // Hydration
  {
    key: 'HYDRATION_HERO',
    name: 'Hydration Hero',
    icon: 'H',
    description: 'Met your daily water goal at least once',
    category: 'hydration',
  },
  {
    key: 'WATER_WEEK',
    name: 'Water Week',
    icon: '💧',
    description: 'Met your daily water goal 7 days in a row',
    category: 'hydration',
  },

  // Nutrition
  {
    key: 'PROTEIN_PRO',
    name: 'Protein Pro',
    icon: 'P',
    description: 'Met your daily protein goal at least once',
    category: 'nutrition',
  },
  {
    key: 'CALORIE_MASTER',
    name: 'Calorie Master',
    icon: 'C',
    description: 'Hit your calorie goal (±10%) on 3 different days',
    category: 'nutrition',
  },
  {
    key: 'TRIPLE_CROWN',
    name: 'Triple Crown',
    icon: '👑',
    description: 'Hit calories, protein and water goals in the same day',
    category: 'nutrition',
  },
  {
    key: 'QUALITY_STREAK',
    name: 'Quality Streak',
    icon: '⭐',
    description: 'Logged 5 high-quality entries in one day',
    category: 'nutrition',
  },

  // Behavior
  {
    key: 'EARLY_BIRD',
    name: 'Early Bird',
    icon: 'E',
    description: 'Logged a meal before 8am',
    category: 'behavior',
  },
  {
    key: 'PHOTO_FOODIE',
    name: 'Photo Foodie',
    icon: '📸',
    description: 'Added a photo to 5 diary entries',
    category: 'behavior',
  },
  {
    key: 'NIGHT_OWL',
    name: 'Night Owl',
    icon: '🦉',
    description: 'Logged a meal after 9pm at least 3 times',
    category: 'behavior',
  },

  // Milestone
  {
    key: 'CENTURION',
    name: 'Centurion',
    icon: '💯',
    description: '100 total diary entries logged',
    category: 'milestone',
  },
  {
    key: 'WEEK_COMPLETE',
    name: 'Week Complete',
    icon: '✅',
    description: 'Logged all 7 days of a calendar week (Mon–Sun)',
    category: 'milestone',
  },
];
