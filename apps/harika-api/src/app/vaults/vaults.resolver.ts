import {
  Args,
  Context,
  GraphQLExecutionContext,
  Mutation,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUserId } from '../app.decorators';
import { VaultType } from './dto/vault.type';
import { VaultsService } from './vaults.service';

@Resolver()
export class VaultsResolver {
  constructor(private readonly vaultsService: VaultsService) {}

  @Mutation(() => VaultType)
  async createVault(
    @CurrentUserId() userId: string,
    @Context() context: GraphQLExecutionContext & { req: Request },
    @Args('id') id: string,
    @Args('name') name: string
  ) {
    return (await this.vaultsService.createVault(id, userId, name)).toGraphql();
  }
}
