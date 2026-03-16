import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return the user when found', async () => {
      const user = { id: 'user-123', email: 'test@example.com', name: 'Test User', created_at: new Date() };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById('user-123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, email: true, name: true, created_at: true },
      });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('should delegate to findById and return the user profile', async () => {
      const user = { id: 'user-123', email: 'test@example.com', name: 'Test User', created_at: new Date() };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(user);
    });
  });
});
