import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UnitsModule } from './units/units.module';
import { ProfileModule } from './profile/profile.module';
import { MealsModule } from './meals/meals.module';
import { DiaryModule } from './diary/diary.module';
import { HydrationModule } from './hydration/hydration.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UnitsModule,
    ProfileModule,
    MealsModule,
    DiaryModule,
    HydrationModule,
    DashboardModule,
  ],
})
export class AppModule {}
