import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './schemas/user.schema';
import { UserEntitySchema } from './schemas/userEntity.schema';
import { UserEntityChangeSchema } from './schemas/userEntityChange.schema';
import { UserDbSyncGateway } from './userDbSync.gateway';
import { UserDbSyncEntitiesService } from './userDbSyncEntities.service';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserEntitySchema, UserEntityChangeSchema]),
  ],
  providers: [
    UsersService,
    UsersResolver,
    UserDbSyncGateway,
    UserDbSyncEntitiesService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
