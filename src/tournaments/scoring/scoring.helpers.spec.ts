import { calculatePoints, isHealthyMeal, getCurrentTime, getCurrentDate } from './scoring.helpers';

const makeRule = (type: string, points: number) =>
  ({ id: 'r-1', tournamentId: 't-1', type, points, label: '', description: '', enabled: true, unit: null, emoji: '' }) as any;

describe('scoring.helpers', () => {
  // ─── calculatePoints ────────────────────────────────────────────────────────

  describe('calculatePoints', () => {
    it('returns rule.points for MEAL_LOGGED', () => {
      const rule = makeRule('MEAL_LOGGED', 10);
      expect(calculatePoints(rule, { kcal: 300, proteinG: 20, carbsG: 30, fatG: 8, mealName: 'Salad', date: '2026-01-01', time: '12:00' })).toBe(10);
    });

    it('returns rule.points for HEALTHY_MEAL', () => {
      const rule = makeRule('HEALTHY_MEAL', 25);
      expect(calculatePoints(rule, { kcal: 300, proteinG: 30, carbsG: 30, fatG: 3, mealName: 'Bowl', date: '2026-01-01', time: '12:00' })).toBe(25);
    });

    it('returns rule.points (negative) for UNHEALTHY_MEAL', () => {
      const rule = makeRule('UNHEALTHY_MEAL', -10);
      expect(calculatePoints(rule, { kcal: 900, proteinG: 10, carbsG: 80, fatG: 30, mealName: 'Burger', date: '2026-01-01', time: '20:00' })).toBe(-10);
    });

    it('returns rule.points for DAILY_GOAL_MET', () => {
      const rule = makeRule('DAILY_GOAL_MET', 50);
      expect(calculatePoints(rule, { date: '2026-01-01' })).toBe(50);
    });

    it('returns rule.points for WATER_GOAL_MET', () => {
      const rule = makeRule('WATER_GOAL_MET', 30);
      expect(calculatePoints(rule, { date: '2026-01-01' })).toBe(30);
    });

    describe('CALORIES_BURNED', () => {
      const rule = makeRule('CALORIES_BURNED', 5);

      it('returns 0 when burned < 100kcal', () => {
        expect(calculatePoints(rule, { caloriesBurned: 99, date: '2026-01-01' })).toBe(0);
      });

      it('returns points for exactly 100kcal burned (1 unit × 5)', () => {
        expect(calculatePoints(rule, { caloriesBurned: 100, date: '2026-01-01' })).toBe(5);
      });

      it('returns points for 350kcal burned (3 units × 5 = 15)', () => {
        expect(calculatePoints(rule, { caloriesBurned: 350, date: '2026-01-01' })).toBe(15);
      });

      it('returns points for 1000kcal burned (10 units × 5 = 50)', () => {
        expect(calculatePoints(rule, { caloriesBurned: 1000, date: '2026-01-01' })).toBe(50);
      });
    });

    describe('WEIGHT_LOSS', () => {
      const rule = makeRule('WEIGHT_LOSS', 100);

      it('returns 0 when weight increased', () => {
        expect(calculatePoints(rule, { weightKg: 80, previousWeightKg: 79, date: '2026-01-01' })).toBe(0);
      });

      it('returns 0 when weight is the same', () => {
        expect(calculatePoints(rule, { weightKg: 80, previousWeightKg: 80, date: '2026-01-01' })).toBe(0);
      });

      it('returns 0 when loss < 0.1kg', () => {
        expect(calculatePoints(rule, { weightKg: 79.95, previousWeightKg: 80, date: '2026-01-01' })).toBe(0);
      });

      it('returns 100 for exactly 0.1kg loss', () => {
        expect(calculatePoints(rule, { weightKg: 79.9, previousWeightKg: 80, date: '2026-01-01' })).toBe(100);
      });

      it('returns 500 for 0.5kg loss (5 units × 100)', () => {
        expect(calculatePoints(rule, { weightKg: 79.5, previousWeightKg: 80, date: '2026-01-01' })).toBe(500);
      });

      it('returns 1000 for 1.0kg loss (10 units × 100)', () => {
        expect(calculatePoints(rule, { weightKg: 79, previousWeightKg: 80, date: '2026-01-01' })).toBe(1000);
      });
    });
  });

  // ─── isHealthyMeal ──────────────────────────────────────────────────────────

  describe('isHealthyMeal', () => {
    it('returns false when kcal >= 600', () => {
      // protein 30g (high), fat 3g (low) — macros ok but too many calories
      expect(isHealthyMeal(600, 30, 30, 3)).toBe(false);
      expect(isHealthyMeal(900, 30, 30, 3)).toBe(false);
    });

    it('returns false when macroCals is zero', () => {
      expect(isHealthyMeal(0, 0, 0, 0)).toBe(false);
    });

    it('returns false when protein < 25% of macro calories', () => {
      // protein 10g=40kcal(~16%), fat 5g=45kcal(~18%), carbs 55g=220kcal — total 305kcal macros, kcal=300
      expect(isHealthyMeal(300, 10, 55, 5)).toBe(false);
    });

    it('returns false when fat > 35% of macro calories', () => {
      // fat 20g=180kcal(~47%), protein 30g=120kcal — macros heavy on fat
      expect(isHealthyMeal(400, 30, 10, 20)).toBe(false);
    });

    it('returns true when kcal < 600, protein >= 25%, fat <= 35%', () => {
      // protein 30g=120kcal(44%), fat 3g=27kcal(10%), carbs 30g=120kcal
      expect(isHealthyMeal(267, 30, 30, 3)).toBe(true);
    });

    it('returns true for a lean chicken + rice meal', () => {
      // 400kcal: protein 35g=140(45%), carbs 35g=140(45%), fat 5g=45(15%)
      expect(isHealthyMeal(400, 35, 35, 5)).toBe(true);
    });
  });

  // ─── getCurrentTime & getCurrentDate ────────────────────────────────────────

  describe('getCurrentTime', () => {
    it('returns a string in HH:MM format', () => {
      const result = getCurrentTime();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('getCurrentDate', () => {
    it('returns a string in YYYY-MM-DD format', () => {
      const result = getCurrentDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
