import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequestDto } from '@servidor/shared-dto';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginRequestDto) {
    return this.auth.login(dto);
  }

  @Post('register')
  register(@Body() dto: { email: string; password: string; displayName?: string }) {
    return this.auth.register(dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const user = (req as any).user;
    return { id: user.id, email: user.email, role: user.role };
  }
}
