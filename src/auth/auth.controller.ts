import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google' })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Apple' })
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
  }
}
