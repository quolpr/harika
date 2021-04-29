import { Module } from '@nestjs/common';
import { TransientLogger } from './TransientLogger';

@Module({
  providers: [TransientLogger],
  exports: [TransientLogger],
})
export class CoreModule {}
