export type EnergyUnit = 'kcal' | 'kj';
export type WaterUnit = 'l' | 'fl_oz';
export type WeightUnit = 'kg' | 'lbs';
export type HeightUnit = 'cm' | 'ft_in';

export interface UserUnits {
  energy: EnergyUnit;
  water: WaterUnit;
  weight: WeightUnit;
  height: HeightUnit;
}
