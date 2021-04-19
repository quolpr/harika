import { Injectable } from '@nestjs/common';
import { compare } from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(username: string, pass: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(username);

    return Boolean(user && (await compare(pass, user.passwordHash)));
  }
}
