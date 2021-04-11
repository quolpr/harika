import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  id!: string;
  @Prop({ required: true })
  email!: string;
  @Prop({ required: true })
  passwordHash!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
