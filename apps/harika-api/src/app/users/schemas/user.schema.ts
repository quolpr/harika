import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { UserType } from '../dto/user.type';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  passwordHash!: string;

  toGraphql(): UserType {
    const user = new UserType();

    user.id = this.id;
    user.email = this.email;

    return user;
  }
}
