import { computeStreak, computeBestStreak } from './streak.utils';

describe('streak.utils', () => {
  describe('computeStreak', () => {
    it('should return 0 when dates array is empty', () => {
      expect(computeStreak([], '2026-03-19')).toBe(0);
    });

    it('should return 0 when last entry is not today or yesterday', () => {
      expect(computeStreak(['2026-03-15'], '2026-03-19')).toBe(0);
    });

    it('should return 1 when only today is logged', () => {
      expect(computeStreak(['2026-03-19'], '2026-03-19')).toBe(1);
    });

    it('should return 1 when only yesterday is logged', () => {
      expect(computeStreak(['2026-03-18'], '2026-03-19')).toBe(1);
    });

    it('should return consecutive count from today', () => {
      expect(
        computeStreak(
          ['2026-03-19', '2026-03-18', '2026-03-17', '2026-03-15'],
          '2026-03-19',
        ),
      ).toBe(3);
    });

    it('should stop counting at a gap in the dates', () => {
      expect(
        computeStreak(
          ['2026-03-19', '2026-03-18', '2026-03-16'], // gap on 17th
          '2026-03-19',
        ),
      ).toBe(2);
    });

    it('should return full count when all days are consecutive', () => {
      const dates = Array.from({ length: 30 }, (_, i) => {
        const d = new Date('2026-03-19T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().split('T')[0];
      });
      expect(computeStreak(dates, '2026-03-19')).toBe(30);
    });
  });

  describe('computeBestStreak', () => {
    it('should return 0 when dates array is empty', () => {
      expect(computeBestStreak([])).toBe(0);
    });

    it('should return 1 when only one date exists', () => {
      expect(computeBestStreak(['2026-03-19'])).toBe(1);
    });

    it('should return 1 when all dates have gaps between them', () => {
      expect(computeBestStreak(['2026-03-19', '2026-03-17', '2026-03-15'])).toBe(1);
    });

    it('should return the longest consecutive run', () => {
      expect(
        computeBestStreak([
          '2026-03-19', '2026-03-18', '2026-03-17', // 3 days
          '2026-03-15',                               // gap
          '2026-03-10', '2026-03-09',                // 2 days
        ]),
      ).toBe(3);
    });

    it('should detect best streak from a historical period, not the current one', () => {
      // Best streak: Jan 1–20 (20 days). Current streak: 2 days.
      const past = Array.from({ length: 20 }, (_, i) => {
        const d = new Date('2026-01-20T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().split('T')[0];
      });
      const current = ['2026-03-19', '2026-03-18'];
      expect(computeBestStreak([...current, ...past])).toBe(20);
    });

    it('should return full length when all dates are consecutive', () => {
      const dates = Array.from({ length: 14 }, (_, i) => {
        const d = new Date('2026-03-19T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().split('T')[0];
      });
      expect(computeBestStreak(dates)).toBe(14);
    });
  });
});
