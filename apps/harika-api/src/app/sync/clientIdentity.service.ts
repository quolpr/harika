import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientIdentity } from './models/ClientIdentity.model';

export class ClientIdentityService {
  constructor(
    @InjectRepository(ClientIdentity)
    private clientIdentityRepo: Repository<ClientIdentity>
  ) {}

  async getLastRev(identity: string) {
    return (
      (await this.clientIdentityRepo.findOne({ clientIdentity: identity }))
        ?.lastRev || 0
    );
  }

  async setNewRev(identity: string, rev: number) {
    await this.clientIdentityRepo
      .createQueryBuilder()
      .insert()
      .values({ clientIdentity: identity, lastRev: rev })

      .onConflict(`("clientIdentity") DO UPDATE SET "lastRev" = :lastRev`)
      .setParameter('lastRev', rev)
      .execute();
  }
}
