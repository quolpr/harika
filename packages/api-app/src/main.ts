/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';

import { AppModule } from './app/app.module';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,

    {
      logger: ['error', 'warn', 'debug'],
    },
  );

  app.enableCors({
    credentials: true,
    origin: [
      'http://localhost:8080',
      'http://localhost:3333',
      'http://192.168.1.41:8080',
      'ionic://localhost',
      'http://localhost',
      'capacitor://localhost',
    ],
  });

  app.use(cookieParser());

  app.use((req: Request, _res: Response, next: () => void) => {
    const { harikaAuthToken } = req.cookies;

    if (harikaAuthToken) {
      const { userId } = jwt.verify(
        harikaAuthToken,
        process.env.AUTH_SECRET as string,
      ) as {
        userId: string;
      };
      // add the user to future requests
      req.userId = userId;
    }
    next();
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3333;
  await app.listen(port, () => {
    Logger.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
