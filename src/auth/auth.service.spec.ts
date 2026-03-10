import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    streak: { create: jest.fn() },
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

    it('should create user, create streak record, and return token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'John',
      });
      mockPrisma.streak.create.mockResolvedValue({});

      const result = await service.register({
        name: 'John',
        email: 'john@example.com',
        password: 'pass123',
      });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('john@example.com');
      expect(mockPrisma.streak.create).toHaveBeenCalledWith({
        data: { user_id: 'user-1' },
      });
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
        password_hash: 'hash',
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
        password_hash: 'hash',
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
        password_hash: null,
        google_id: 'google-123',
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
          name: 'Google Name', // Google returns a different name
        }),
      };
      jest
        .spyOn(service['googleClient'], 'verifyIdToken')
        .mockResolvedValue(mockTicket as never);

      // User has edited their name in the app to "Custom Name"
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'Custom Name',
        google_id: 'google-123',
      });

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      expect(result.access_token).toBe('mock-token');
      expect(result.user.email).toBe('john@example.com');
      // Name should be preserved from DB, not overwritten by Google's name
      expect(result.user.name).toBe('Custom Name');
      // user.update should NOT be called for existing users
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should link Google account to existing user with same email and preserve user name', async () => {
      const mockTicket = {
        getPayload: () => ({
          sub: 'google-123',
          email: 'john@example.com',
          name: 'Google Name', // Google returns a different name
        }),
      };
      jest
        .spyOn(service['googleClient'], 'verifyIdToken')
        .mockResolvedValue(mockTicket as never);

      // First call: no user with Google ID
      // Second call: user exists with email (user has custom name)
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // google_id search
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'john@example.com',
          name: 'Custom Name',
        }); // email search

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        name: 'Custom Name',
        google_id: 'google-123',
      });

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      // Should only update google_id, NOT name
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { google_id: 'google-123' },
      });
      // Name should be preserved
      expect(result.user.name).toBe('Custom Name');
      expect(result.access_token).toBe('mock-token');
    });

    it('should create new user for Google sign-in with new email', async () => {
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

      // No existing users
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // google_id search
        .mockResolvedValueOnce(null); // email search

      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'newuser@example.com',
        name: 'New User',
        google_id: 'google-123',
      });
      mockPrisma.streak.create.mockResolvedValue({});

      const result = await service.googleLogin({ idToken: 'valid-google-token' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          google_id: 'google-123',
        },
      });
      expect(mockPrisma.streak.create).toHaveBeenCalledWith({
        data: { user_id: 'new-user-1' },
      });
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
