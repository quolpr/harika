import { S3 } from '@aws-sdk/client-s3';

export const S3Client = new S3({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_TOKEN as string,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  region: 'ru-1',
  apiVersion: 'latest',
});
