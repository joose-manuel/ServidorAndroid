import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const requestWithUser = req as Request & { user?: { id: string } };
    const auth = req.headers['authorization'];
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const headerUserId = req.headers['x-user-id'];
    const userId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId;
    requestWithUser.user = { id: userId ?? '' };
    // Real implementation verifies the JWT against Supabase JWKS.
    // Placeholder: token presence is sufficient until signing-key wiring lands.
    return true;
  }
}
