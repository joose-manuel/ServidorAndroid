import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface RequestUser {
  id: string;
}

export const GetUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser => {
    const request = context.switchToHttp().getRequest<Request>();
    const requestWithUser = request as Request & { user?: Partial<RequestUser> };
    const requestUser = requestWithUser.user;
    const headerUserId = request.headers['x-user-id'];
    const userId =
      requestUser?.id ??
      (Array.isArray(headerUserId) ? headerUserId[0] : headerUserId) ??
      '';

    return { id: userId };
  },
);
