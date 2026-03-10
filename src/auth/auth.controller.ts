import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google' })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({ status: 200, description: 'Google authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid or expired Google token' })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Apple' })
  @ApiBody({ type: AppleLoginDto })
  @ApiResponse({ status: 200, description: 'Apple authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid or expired Apple token' })
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto);
  }
}
