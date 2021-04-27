import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vault } from './models/vault.model';

@Injectable()
export class VaultsService {
  constructor(
    @InjectRepository(Vault)
    private vaultRepo: Repository<Vault>
  ) {}
  async createVault(id: string, userId: string, name: string) {
    return this.vaultRepo.save(this.vaultRepo.create({ id, userId, name }));
  }
}
