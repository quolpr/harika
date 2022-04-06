import { Client } from 'minio';

export const minioClient = new Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'FAOYW3CI7HL4ZXRJ00H4',
  secretKey: '0x6h5JBDS4rvE95ewppktmgA9+xLzL95CzhgxnJ4',
});
