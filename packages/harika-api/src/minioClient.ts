import { Client } from 'minio';

export const minioClient = new Client({
  endPoint: process.env.S3_ENDPOINT,
  port: parseInt(process.env.S3_PORT, 10) || 443,
  accessKey: process.env.S3_ACCESS_TOKEN,
  secretKey: process.env.S3_SECRET_KEY,
});
