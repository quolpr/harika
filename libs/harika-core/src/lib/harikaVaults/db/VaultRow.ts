import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';
import { VaultsTableNames } from './schema';

export class VaultRow extends Model {
  static table = VaultsTableNames.VAULTS;
  @field('name') name!: string;

  @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
