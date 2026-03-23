import { Module } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsAnalysisService } from './meals-analysis.service';
import { MealsController } from './meals.controller';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [UnitsModule],
  providers: [MealsService, MealsAnalysisService],
  controllers: [MealsController],
  exports: [MealsService],
})
export class MealsModule {}
