import {
  Args,
  Context,
  GraphQLExecutionContext,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { sign } from 'jsonwebtoken';
import { environment } from '../../environments/environment';
import { CreateUserInput } from './dto/createUser.input';
import { UserType } from './dto/user.type';
import { UsersService } from './users.service';
import { Request } from 'express';
import { LoginResultType } from './dto/loginResult.types';
import { LoginInput } from './dto/login.input';

@Resolver()
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserType)
  async viewer(
    @Context() context: GraphQLExecutionContext & { req: Request }
  ): Promise<UserType | null> {
    if (!context.req.userId) {
      throw new Error('not authed');
    }

    const user = await this.usersService.findById(context.req.userId);

    if (!user) {
      throw new Error('user not found');
    }

    return user.toGraphql();
  }

  @Mutation(() => UserType)
  async createUser(
    @Context() context: GraphQLExecutionContext & { req: Request },
    @Args('payload') payload: CreateUserInput
  ): Promise<UserType> {
    const user = (await this.usersService.createUser(payload)).toGraphql();

    this.setCookie(context.req.res, user.id);

    return user;
  }

  @Mutation(() => LoginResultType)
  async login(
    @Context() context: GraphQLExecutionContext & { req: Request },
    @Args('payload') payload: LoginInput
  ): Promise<LoginResultType> {
    const user = await this.usersService.authUser(
      payload.email,
      payload.password
    );

    if (user) {
      this.setCookie(context.req.res, user.id);

      return { authed: true, user: user.toGraphql() };
    } else {
      return { authed: false };
    }
  }

  private setCookie(res: Request['res'], userId: string) {
    const token = sign({ userId: userId }, environment.userSecret);

    res?.cookie('harikaAuthToken', token, {
      // safari WTF?! https://stackoverflow.com/questions/47742807/cookies-dont-work-over-websocket-on-apple-devices
      // Security issues could be here. TODO: Maybe check UA?
      httpOnly: false,
      maxAge: 1000 * 60 * 60 * 24 * 31,
      sameSite: 'strict',
    });
  }
}
