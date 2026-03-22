import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export enum PushTokenPlatform {
  Ios = 'ios',
  Android = 'android',
}

export class RegisterPushTokenDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push notification token for the device',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    enum: PushTokenPlatform,
    enumName: 'PushTokenPlatform',
    example: PushTokenPlatform.Ios,
    description: 'Operating system of the device',
  })
  @IsEnum(PushTokenPlatform)
  platform: PushTokenPlatform;
}
