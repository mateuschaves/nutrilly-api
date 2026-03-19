import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { R2Service } from './r2.service';

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockResolvedValue({});
  const S3Client = jest.fn().mockImplementation(() => ({ send }));
  const PutObjectCommand = jest.fn();
  const GetObjectCommand = jest.fn();
  const DeleteObjectCommand = jest.fn();
  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

describe('R2Service', () => {
  let service: R2Service;
  let mockConfigService: Record<string, jest.Mock>;

  const envMap: Record<string, string> = {
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-access-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-secret-key',
    CLOUDFLARE_R2_BUCKET: 'test-bucket',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        if (envMap[key]) return envMap[key];
        throw new Error(`Missing config: ${key}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<R2Service>(R2Service);
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialise the S3 client with R2 endpoint', () => {
      const { S3Client } = jest.requireMock('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalledWith({
        region: 'auto',
        endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should read all required config values', () => {
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'CLOUDFLARE_ACCOUNT_ID',
      );
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'CLOUDFLARE_R2_ACCESS_KEY_ID',
      );
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
      );
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'CLOUDFLARE_R2_BUCKET',
      );
    });
  });

  describe('upload', () => {
    it('should send a PutObjectCommand and return the key', async () => {
      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      const key = 'photos/test.jpg';
      const body = Buffer.from('fake-image');
      const contentType = 'image/jpeg';

      const result = await service.upload(key, body, contentType);

      expect(result).toBe(key);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
        Body: body,
        ContentType: contentType,
      });
    });
  });

  describe('getSignedUrl', () => {
    it('should return a presigned URL', async () => {
      const url = await service.getSignedUrl('photos/test.jpg');
      expect(url).toBe('https://signed-url.example.com');
    });

    it('should pass custom expiresIn', async () => {
      const { getSignedUrl: mockGetSignedUrl } = jest.requireMock(
        '@aws-sdk/s3-request-presigner',
      );
      await service.getSignedUrl('photos/test.jpg', 7200);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 },
      );
    });
  });

  describe('delete', () => {
    it('should send a DeleteObjectCommand', async () => {
      const { DeleteObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      await service.delete('photos/test.jpg');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'photos/test.jpg',
      });
    });
  });
});
