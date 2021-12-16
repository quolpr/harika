import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(
      __dirname,
      `../${process.env.NODE_ENV === 'test' ? '.test' : ''}.env`
    ),
  });
}
