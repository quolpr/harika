import { Mutation, Resolver } from '@nestjs/graphql';
import { UserType } from '../users/dto/user.type';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => UserType)
  async login() {}
}
