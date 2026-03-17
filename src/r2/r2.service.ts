import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const accountId = this.config.getOrThrow<string>('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = this.config.getOrThrow<string>(
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
    );
    const secretAccessKey = this.config.getOrThrow<string>(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    );
    this.bucket = this.config.getOrThrow<string>('CLOUDFLARE_R2_BUCKET');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.logger.log('Cloudflare R2 client initialised');
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.debug(`Uploaded ${key} to R2`);
    return key;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.debug(`Deleted ${key} from R2`);
  }
}
