import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UnitsModule } from './units/units.module';
import { ProfileModule } from './profile/profile.module';
import { MealsModule } from './meals/meals.module';
import { DiaryModule } from './diary/diary.module';
import { HydrationModule } from './hydration/hydration.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WeightModule } from './weight/weight.module';
import { R2Module } from './r2/r2.module';
import { AchievementsModule } from './achievements/achievements.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { DevicesModule } from './devices/devices.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UnitsModule,
    ProfileModule,
    MealsModule,
    AchievementsModule,
    DiaryModule,
    HydrationModule,
    DashboardModule,
    WeightModule,
    R2Module,
    TournamentsModule,
    DevicesModule,
    OnboardingModule,
  ],
})
export class AppModule {}
