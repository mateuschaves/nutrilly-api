import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserProfileDto } from './dto/user-profile.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized – missing or invalid bearer token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);
  }
}
