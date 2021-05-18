import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientIdentity } from './models/ClientIdentity.model';

// TODO: remove
export class ClientIdentityService {
  constructor(
    @InjectRepository(ClientIdentity)
    private clientIdentityRepo: Repository<ClientIdentity>
  ) {}

  async getLastRev(ownerId: string, identity: string) {
    return (
      (
        await this.clientIdentityRepo.findOne({
          clientIdentity: identity,
          ownerId,
        })
      )?.lastRev || 0
    );
  }

  async setNewRev(ownerId: string, identity: string, rev: number) {
    await this.clientIdentityRepo
      .createQueryBuilder()
      .insert()
      .values({ clientIdentity: identity, ownerId, lastRev: rev })

      .onConflict(
        `("clientIdentity", "ownerId") DO UPDATE SET "lastRev" = :lastRev`
      )
      .setParameter('lastRev', rev)
      .execute();
  }
}
