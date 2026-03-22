import { calculatePoints, isHealthyMeal, getCurrentTime, getCurrentDate, getPeriodWindow } from './scoring.helpers';

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

  // ─── getPeriodWindow ────────────────────────────────────────────────────────

  describe('getPeriodWindow', () => {
    describe('DAY', () => {
      it('returns start at 00:00:00.000 UTC and end at 23:59:59.999 UTC', () => {
        const { start, end } = getPeriodWindow('DAY');
        expect(start.getUTCHours()).toBe(0);
        expect(start.getUTCMinutes()).toBe(0);
        expect(start.getUTCSeconds()).toBe(0);
        expect(start.getUTCMilliseconds()).toBe(0);
        expect(end.getUTCHours()).toBe(23);
        expect(end.getUTCMinutes()).toBe(59);
        expect(end.getUTCSeconds()).toBe(59);
        expect(end.getUTCMilliseconds()).toBe(999);
        expect(start.getUTCFullYear()).toBe(end.getUTCFullYear());
        expect(start.getUTCMonth()).toBe(end.getUTCMonth());
        expect(start.getUTCDate()).toBe(end.getUTCDate());
      });
    });

    describe('WEEK', () => {
      it('returns a window spanning 7 days starting on Monday', () => {
        // Use a fixed Wednesday to avoid flakiness
        const wednesday = new Date('2026-03-25T10:00:00Z'); // Wednesday
        jest.useFakeTimers({ now: wednesday.getTime() });
        const { start, end } = getPeriodWindow('WEEK');
        jest.useRealTimers();
        // start must be Monday (UTC day = 1)
        expect(start.getUTCDay()).toBe(1);
        expect(start.getUTCDate()).toBe(23); // Mon March 23
        // end must be Sunday (UTC day = 0)
        expect(end.getUTCDay()).toBe(0);
        expect(end.getUTCDate()).toBe(29); // Sun March 29
      });

      it('returns correct Monday when today is Sunday', () => {
        // Mock a Sunday
        const sunday = new Date('2026-03-22T12:00:00Z'); // Sunday
        expect(sunday.getUTCDay()).toBe(0);
        jest.useFakeTimers({ now: sunday.getTime() });
        const { start } = getPeriodWindow('WEEK');
        expect(start.getUTCDay()).toBe(1); // Monday
        // Sunday March 22 → Monday should be March 16
        expect(start.getUTCDate()).toBe(16);
        expect(start.getUTCMonth()).toBe(2); // March = 2
        jest.useRealTimers();
      });

      it('returns correct Monday when today is Monday', () => {
        const monday = new Date('2026-03-23T08:00:00Z'); // Monday
        expect(monday.getUTCDay()).toBe(1);
        jest.useFakeTimers({ now: monday.getTime() });
        const { start } = getPeriodWindow('WEEK');
        expect(start.getUTCDay()).toBe(1);
        expect(start.getUTCDate()).toBe(23);
        jest.useRealTimers();
      });
    });

    describe('MONTH', () => {
      it('returns start on the 1st and end on the last day of the current month', () => {
        const { start, end } = getPeriodWindow('MONTH');
        expect(start.getUTCDate()).toBe(1);
        expect(start.getUTCHours()).toBe(0);
        // end should be the last day of the month
        const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
        expect(end.getUTCDate()).toBe(lastDay.getUTCDate());
        expect(end.getUTCHours()).toBe(23);
        expect(end.getUTCMinutes()).toBe(59);
        expect(end.getUTCSeconds()).toBe(59);
        expect(end.getUTCMilliseconds()).toBe(999);
      });

      it('handles month boundary correctly for February', () => {
        const feb = new Date('2026-02-15T12:00:00Z');
        jest.useFakeTimers({ now: feb.getTime() });
        const { start, end } = getPeriodWindow('MONTH');
        expect(start.getUTCDate()).toBe(1);
        expect(start.getUTCMonth()).toBe(1); // February
        expect(end.getUTCDate()).toBe(28); // 2026 is not a leap year
        expect(end.getUTCMonth()).toBe(1);
        jest.useRealTimers();
      });
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
