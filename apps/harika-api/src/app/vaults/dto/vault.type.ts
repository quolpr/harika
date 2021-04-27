import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class VaultType {
  @Field()
  id!: string;

  @Field()
  name!: string;
}
