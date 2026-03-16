import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [UnitsModule],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
