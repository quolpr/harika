import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserInput } from './dto/createUser.input';
import { User, UserDocument } from './schemas/user.schema';
import { compare, hash } from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email });
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const createdUser = new this.userModel({
      email: data.email,
      // TODO: add salt support
      passwordHash: await hash(data.password, 10),
    });

    const result = createdUser.save();

    return result;
  }

  async authUser(email: string, pass: string) {
    const user = await this.findByEmail(email);

    return user && (await compare(pass, user.passwordHash))
      ? user
      : null;
  }
}
