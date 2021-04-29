import { Injectable, Logger, Scope } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to harika-api!' };
  }
}
