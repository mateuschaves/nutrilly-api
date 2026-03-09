import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FoodsModule } from './foods/foods.module';
import { MealsModule } from './meals/meals.module';
import { WaterModule } from './water/water.module';
import { GoalsModule } from './goals/goals.module';
import { StreaksModule } from './streaks/streaks.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    FoodsModule,
    MealsModule,
    WaterModule,
    GoalsModule,
    StreaksModule,
    DashboardModule,
  ],
})
export class AppModule {}
