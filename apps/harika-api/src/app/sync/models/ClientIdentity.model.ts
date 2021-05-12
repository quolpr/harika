import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/schemas/user.schema';

@Entity('syncClientIdentities')
@Unique(['clientIdentity', 'ownerId'])
export class ClientIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  clientIdentity!: string;

  @Column()
  @Index()
  ownerId!: string;

  @ManyToOne(() => User)
  owner!: User;

  // TODO: remove
  @Column()
  lastRev!: number;
}
