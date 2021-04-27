import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/schemas/user.schema';
import { VaultType } from '../dto/vault.type';

@Entity('vaults')
@Unique(['userId', 'name'])
export class Vault {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User)
  user!: User;

  toGraphql() {
    const vaultType = new VaultType();

    vaultType.name = this.name;
    vaultType.id = this.id;

    return vaultType;
  }
}
