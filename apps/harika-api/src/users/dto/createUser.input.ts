import { Field, InputType } from '@nestjs/graphql';
import { MinLength } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  email!: string;

  @Field({ nullable: true })
  @MinLength(6)
  password?: string;
}
