import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((params) => params),
    GetObjectCommand: jest.fn().mockImplementation((params) => params),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com/photo.jpeg'),
}));

describe('S3Service', () => {
  let service: S3Service;

  const createConfigService = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string | undefined> = {
        AWS_S3_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        ...overrides,
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: ConfigService, useValue: createConfigService() },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw if AWS credentials are missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            S3Service,
            {
              provide: ConfigService,
              useValue: createConfigService({
                AWS_ACCESS_KEY_ID: undefined,
                AWS_SECRET_ACCESS_KEY: undefined,
              }),
            },
          ],
        }).compile(),
      ).rejects.toThrow('AWS credentials are required');
    });
  });

  describe('uploadMealPhoto', () => {
    it('should upload a photo and return the S3 key', async () => {
      mockSend.mockResolvedValue({});

      const key = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('fake-image'),
        'image/jpeg',
      );

      expect(key).toMatch(/^meals\/user-123\/.+\.jpeg$/);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: expect.stringMatching(/^meals\/user-123\/.+\.jpeg$/),
          Body: expect.any(Buffer),
          ContentType: 'image/jpeg',
        }),
      );
    });

    it('should handle PNG files correctly', async () => {
      mockSend.mockResolvedValue({});

      const key = await service.uploadMealPhoto(
        'user-456',
        Buffer.from('fake-png'),
        'image/png',
      );

      expect(key).toMatch(/\.png$/);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/png',
        }),
      );
    });

    it('should generate unique keys for each upload', async () => {
      mockSend.mockResolvedValue({});

      const key1 = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('image-1'),
        'image/jpeg',
      );
      const key2 = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('image-2'),
        'image/jpeg',
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('getSignedPhotoUrl', () => {
    it('should return a presigned URL for a given key', async () => {
      const url = await service.getSignedPhotoUrl('meals/user-123/photo.jpeg');

      expect(url).toBe('https://signed-url.example.com/photo.jpeg');
    });

    it('should pass custom expiration to getSignedUrl', async () => {
      const { getSignedUrl: mockGetSignedUrl } = require('@aws-sdk/s3-request-presigner');

      await service.getSignedPhotoUrl('meals/user-123/photo.jpeg', 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ Key: 'meals/user-123/photo.jpeg' }),
        { expiresIn: 7200 },
      );
    });
  });
});
