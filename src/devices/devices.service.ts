import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    const record = await this.prisma.devicePushToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
      },
    });

    return {
      token: record.token,
      platform: record.platform,
    };
  }
}
