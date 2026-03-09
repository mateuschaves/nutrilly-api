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
  };
});

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
    it('should upload a photo and return the S3 URL', async () => {
      mockSend.mockResolvedValue({});

      const url = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('fake-image'),
        'image/jpeg',
      );

      expect(url).toMatch(
        /^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com\/meals\/user-123\/.+\.jpeg$/,
      );
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

      const url = await service.uploadMealPhoto(
        'user-456',
        Buffer.from('fake-png'),
        'image/png',
      );

      expect(url).toMatch(/\.png$/);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/png',
        }),
      );
    });

    it('should generate unique keys for each upload', async () => {
      mockSend.mockResolvedValue({});

      const url1 = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('image-1'),
        'image/jpeg',
      );
      const url2 = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('image-2'),
        'image/jpeg',
      );

      expect(url1).not.toBe(url2);
    });

    it('should use UUID in the S3 key to prevent enumeration', async () => {
      mockSend.mockResolvedValue({});

      const url = await service.uploadMealPhoto(
        'user-123',
        Buffer.from('fake-image'),
        'image/jpeg',
      );

      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
      expect(url).toMatch(uuidRegex);
    });
  });
});
