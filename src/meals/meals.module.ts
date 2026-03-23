import { Module } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsAnalysisService } from './meals-analysis.service';
import { MealsController } from './meals.controller';

@Module({
  providers: [MealsService, MealsAnalysisService],
  controllers: [MealsController],
  exports: [MealsService],
})
export class MealsModule {}
