import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserType } from '../dto/user.type';

export type UserDocument = User & Document;

@Schema()
export class User extends Document {
  @Prop({ required: true, unique: true })
  email!: string;
  @Prop({ required: true })
  passwordHash!: string;

  toGraphql!: () => UserType;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.methods.toGraphql = function () {
  const user = new UserType();

  user.id = this._id;
  user.email = this.email;

  return user;
};
