import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const [, , { req }] = ctx.getArgs();

    if (!req.userId) {
      // TODO: move to guard
      throw new Error('User must be set!');
    }

    return req.userId;
  }
);
