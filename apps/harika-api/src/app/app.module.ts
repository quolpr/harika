import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      debug: true,
      playground: true,
      cors: {
        credentials: true,
        origin: [
          'http://localhost:3333',
          'http://localhost:4200',
          'http://192.168.1.41:4200',
          'ionic://localhost',
          'http://localhost',
          'capacitor://localhost',
        ],
      },
      context: ({ req }) => ({ req }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
