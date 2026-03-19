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

  describe('appleLogin', () => {
    const buildAppleToken = (payload: object): string => {
      const header = Buffer.from(JSON.stringify({ kid: 'test-key-id', alg: 'RS256' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.fake-signature`;
    };

    const validPayload = {
      iss: 'https://appleid.apple.com',
      aud: 'mock-config-value',
      sub: 'apple-sub-123',
      email: 'apple@example.com',
      email_verified: 'true',
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
    };

    beforeEach(() => {
      jest.spyOn(service as any, 'verifyAppleToken').mockResolvedValue(validPayload);
    });

    it('should return token for existing user with Apple ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'apple@example.com',
        name: 'Existing User',
        appleId: 'apple-sub-123',
      });

      const result = await service.appleLogin({
        identityToken: buildAppleToken(validPayload),
      });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('apple@example.com');
    });

    it('should link Apple ID to existing account with same email', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // appleId lookup
        .mockResolvedValueOnce({ id: 'user-1', email: 'apple@example.com', name: 'Existing User' }); // email lookup

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'apple@example.com',
        name: 'Existing User',
        appleId: 'apple-sub-123',
      });

      const result = await service.appleLogin({
        identityToken: buildAppleToken(validPayload),
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { appleId: 'apple-sub-123' },
      });
      expect(result.access_token).toBe('mock-token');
    });

    it('should create a new user for a new Apple account and seed meals', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // appleId lookup
        .mockResolvedValueOnce(null); // email lookup

      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'apple@example.com',
        name: 'Full Name',
        appleId: 'apple-sub-123',
      });
      mockMealsService.seedDefaultMeals.mockResolvedValue(undefined);

      const result = await service.appleLogin({
        identityToken: buildAppleToken(validPayload),
        fullName: 'Full Name',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'apple@example.com',
          name: 'Full Name',
          appleId: 'apple-sub-123',
        }),
      });
      expect(mockMealsService.seedDefaultMeals).toHaveBeenCalledWith('new-user-1');
      expect(result.access_token).toBe('mock-token');
    });

    it('should use "Apple User" as name when fullName is not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u2',
        email: 'apple@example.com',
        name: 'Apple User',
        appleId: 'apple-sub-123',
      });
      mockMealsService.seedDefaultMeals.mockResolvedValue(undefined);

      await service.appleLogin({ identityToken: buildAppleToken(validPayload) });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Apple User' }),
      });
    });

    it('should throw UnauthorizedException when Apple token has no email', async () => {
      jest.spyOn(service as any, 'verifyAppleToken').mockResolvedValue({ ...validPayload, email: undefined });

      await expect(
        service.appleLogin({ identityToken: buildAppleToken(validPayload) }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for malformed token (not 3 parts)', async () => {
      jest.spyOn(service as any, 'verifyAppleToken').mockRestore();

      await expect(
        service.appleLogin({ identityToken: 'not.valid' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
