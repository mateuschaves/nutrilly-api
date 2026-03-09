import { Module } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { OpenAIModule } from '../openai/openai.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [OpenAIModule, S3Module],
  providers: [MealsService],
  controllers: [MealsController],
  exports: [MealsService],
})
export class MealsModule {}
