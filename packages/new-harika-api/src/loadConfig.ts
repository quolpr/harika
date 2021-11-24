import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(
    __dirname,
    `../.${process.env.NODE_ENV === 'test' ? 'test' : ''}.env`
  ),
});
