import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MealsService } from '../meals/meals.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };

  const mockMealsService = {
    seedDefaultMeals: jest.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-config-value'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MealsService, useValue: mockMealsService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ name: 'John', email: 'john@example.com', password: 'pass123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user, seed default meals, and return token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'John',
      });
      mockMealsService.seedDefaultMeals.mockResolvedValue(undefined);

      const result = await service.register({
        name: 'John',
        email: 'john@example.com',
        password: 'pass123',
      });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('john@example.com');
      expect(mockMealsService.seedDefaultMeals).toHaveBeenCalledWith('user-1');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@example.com', password: 'pass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'john@example.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return token on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'John',
        passwordHash: 'hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'john@example.com',
        password: 'pass123',
      });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should throw UnauthorizedException if user has no password (social login user)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'John',
        passwordHash: null,
        googleId: 'google-123',
      });

      await expect(
        service.login({ email: 'john@example.com', password: 'pass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    it('should return token for existing user with Google ID and preserve user name', async () => {
      const mockTicket = {
        getPayload: () => ({
          sub: 'google-123',
          email: 'john@example.com',
          name: 'Google Name',
        }),
      };
      jest
        .spyOn(service['googleClient'], 'verifyIdToken')
        .mockResolvedValue(mockTicket as never);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'Custom Name',
        googleId: 'google-123',
      });

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('john@example.com');
      expect(result.user.name).toBe('Custom Name');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should link Google account to existing user with same email and preserve user name', async () => {
      const mockTicket = {
        getPayload: () => ({
          sub: 'google-123',
          email: 'john@example.com',
          name: 'Google Name',
        }),
      };
      jest
        .spyOn(service['googleClient'], 'verifyIdToken')
        .mockResolvedValue(mockTicket as never);

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId search
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'john@example.com',
          name: 'Custom Name',
        }); // email search

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'Custom Name',
        googleId: 'google-123',
      });

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleId: 'google-123' },
      });
      expect(result.user.name).toBe('Custom Name');
      expect(result.access_token).toBe('mock-token');
    });

    it('should create new user for Google sign-in with new email and seed meals', async () => {
      const mockTicket = {
        getPayload: () => ({
          sub: 'google-123',
          email: 'newuser@example.com',
          name: 'New User',
        }),
      };
      jest
        .spyOn(service['googleClient'], 'verifyIdToken')
        .mockResolvedValue(mockTicket as never);

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // googleId search
        .mockResolvedValueOnce(null); // email search

      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'newuser@example.com',
        name: 'New User',
        googleId: 'google-123',
      });
      mockMealsService.seedDefaultMeals.mockResolvedValue(undefined);

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          googleId: 'google-123',
        },
      });
      expect(mockMealsService.seedDefaultMeals).toHaveBeenCalledWith('new-user-1');
      expect(result.access_token).toBe('mock-token');
    });

    it('should throw UnauthorizedException for invalid Google token', async () => {
      jest.spyOn(service['googleClient'], 'verifyIdToken').mockRejectedValue(new Error('Invalid token') as never);

      await expect(
        service.googleLogin({ idToken: 'invalid-token' }),
      ).rejects.toThrow();
    });
  });
});
