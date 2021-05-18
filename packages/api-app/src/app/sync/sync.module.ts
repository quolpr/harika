import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientIdentityService } from './clientIdentity.service';
import { ClientIdentity } from './models/ClientIdentity.model';

@Module({
  imports: [TypeOrmModule.forFeature([ClientIdentity])],
  providers: [ClientIdentityService],
  exports: [ClientIdentityService],
})
export class SyncModule {}
