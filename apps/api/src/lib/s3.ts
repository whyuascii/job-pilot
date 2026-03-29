// S3-compatible storage client
// Production (ECS): Uses IAM task role credentials (no static keys needed)
// Local dev (MinIO): Set S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function createS3Client(): S3Client {
  const config: S3ClientConfig = {
    region: process.env.S3_REGION || 'us-east-1',
  };

  // MinIO / custom endpoint mode: use static credentials + path-style
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
    if (process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
      config.credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      };
    }
  }
  // Production AWS S3: SDK auto-discovers credentials from IAM task role

  return new S3Client(config);
}

const s3Client = createS3Client();

const BUCKET = process.env.S3_BUCKET || 'job-pilot';

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}

export { s3Client, BUCKET };
