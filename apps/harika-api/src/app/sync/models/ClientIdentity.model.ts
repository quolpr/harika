import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('sync_client_identities')
@Unique(['clientIdentity'])
export class ClientIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  clientIdentity!: string;

  @Column()
  lastRev!: number;
}
