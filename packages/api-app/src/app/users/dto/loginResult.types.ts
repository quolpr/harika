import { Field, ObjectType } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class LoginResultType {
  @Field()
  authed!: boolean;

  @Field({ nullable: true })
  user?: UserType;
}
