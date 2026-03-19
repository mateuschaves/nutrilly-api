import { Test, TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UnitsService', () => {
  let service: UnitsService;

  const mockPrisma = {
    userUnitPreferences: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getUserUnits ────────────────────────────────────────────────────────────

  describe('getUserUnits', () => {
    it('should return stored preferences when they exist', async () => {
      mockPrisma.userUnitPreferences.findUnique.mockResolvedValue({
        userId: 'user-1',
        energy: 'kj',
        water: 'fl_oz',
        weight: 'lbs',
        height: 'ft_in',
      });

      const result = await service.getUserUnits('user-1');

      expect(result).toEqual({ energy: 'kj', water: 'fl_oz', weight: 'lbs', height: 'ft_in' });
    });

    it('should return default units when no preferences exist', async () => {
      mockPrisma.userUnitPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getUserUnits('user-1');

      expect(result).toEqual({ energy: 'kcal', water: 'l', weight: 'kg', height: 'cm' });
    });

    it('should fall back to defaults for undefined fields in partial preferences', async () => {
      mockPrisma.userUnitPreferences.findUnique.mockResolvedValue({
        userId: 'user-1',
        energy: 'kj',
        water: undefined,
        weight: undefined,
        height: undefined,
      });

      const result = await service.getUserUnits('user-1');

      expect(result.energy).toBe('kj');
      expect(result.water).toBe('l');
      expect(result.weight).toBe('kg');
      expect(result.height).toBe('cm');
    });
  });

  // ─── convertEnergy ───────────────────────────────────────────────────────────

  describe('convertEnergy', () => {
    it('should return kcal rounded when unit is kcal', () => {
      expect(service.convertEnergy(200, 'kcal')).toBe(200);
    });

    it('should convert kcal to kJ and round', () => {
      // 240 * 4.184 = 1004.16 → 1004
      expect(service.convertEnergy(240, 'kj')).toBe(1004);
    });

    it('should return 0 for 0 kcal', () => {
      expect(service.convertEnergy(0, 'kcal')).toBe(0);
      expect(service.convertEnergy(0, 'kj')).toBe(0);
    });

    it('should round fractional kcal values', () => {
      expect(service.convertEnergy(100.7, 'kcal')).toBe(101);
    });
  });

  // ─── convertWater ────────────────────────────────────────────────────────────

  describe('convertWater', () => {
    it('should convert ml to liters rounded to 2 decimals', () => {
      expect(service.convertWater(1000, 'l')).toBe(1);
      expect(service.convertWater(500, 'l')).toBe(0.5);
      expect(service.convertWater(250, 'l')).toBe(0.25);
    });

    it('should convert ml to fl_oz rounded to 2 decimals', () => {
      // 1000ml → 1L → 33.814 fl_oz
      expect(service.convertWater(1000, 'fl_oz')).toBe(33.81);
    });

    it('should return 0 for 0 ml', () => {
      expect(service.convertWater(0, 'l')).toBe(0);
      expect(service.convertWater(0, 'fl_oz')).toBe(0);
    });

    it('should handle large values (2600ml default goal)', () => {
      expect(service.convertWater(2600, 'l')).toBe(2.6);
    });
  });

  // ─── convertWeight ───────────────────────────────────────────────────────────

  describe('convertWeight', () => {
    it('should return kg rounded to 1 decimal', () => {
      expect(service.convertWeight(70, 'kg')).toBe(70);
      expect(service.convertWeight(70.55, 'kg')).toBe(70.6);
    });

    it('should convert kg to lbs rounded to 1 decimal', () => {
      // 70 * 2.20462 = 154.3234 → 154.3
      expect(service.convertWeight(70, 'lbs')).toBe(154.3);
    });

    it('should return 0 for 0 kg', () => {
      expect(service.convertWeight(0, 'kg')).toBe(0);
      expect(service.convertWeight(0, 'lbs')).toBe(0);
    });
  });
});
