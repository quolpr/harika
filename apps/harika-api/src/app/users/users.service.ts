import { Injectable } from '@nestjs/common';
import { CreateUserInput } from './dto/createUser.input';
import { User } from './schemas/user.schema';
import { compare, hash } from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>
  ) {}

  async findById(id: string): Promise<User | undefined> {
    return this.userRepo.findOne(id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.userRepo.findOne({ email: email });
  }

  async createUser(data: CreateUserInput): Promise<User> {
    return this.userRepo.save(
      this.userRepo.create({
        email: data.email,
        passwordHash: await hash(data.password, 10),
      })
    );
  }

  async authUser(email: string, pass: string) {
    const user = await this.findByEmail(email);

    return user && (await compare(pass, user.passwordHash)) ? user : null;
  }
}
