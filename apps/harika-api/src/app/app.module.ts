import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/schemas/user.schema';
import { UserEntitySchema } from './users/schemas/userEntity.schema';
import { UserEntityChangeSchema } from './users/schemas/userEntityChange.schema';
import { UsersModule } from './users/users.module';
import { Vault } from './vaults/models/vault.model';
import { VaultEntitySchema } from './vaults/schemas/vaultEntity.schema';
import { VaultEntityChangeSchema } from './vaults/schemas/vaultEntityChange.schema';
import { VaultsModule } from './vaults/vaults.module';

@Module({
  imports: [
    UsersModule,
    VaultsModule,
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
      path: '/api/graphql',
      context: ({ req }) => ({ req }),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'harika',
      entities: [
        User,
        Vault,
        VaultEntityChangeSchema,
        VaultEntitySchema,
        UserEntitySchema,
        UserEntityChangeSchema,
      ],
      synchronize: true,
      logging: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
