import { Injectable } from '@nestjs/common';
import { LoginRequestDto, LoginResponseDto } from '@servidor/shared-dto';

@Injectable()
export class AuthService {
  async login(_dto: LoginRequestDto): Promise<LoginResponseDto> {
    // Real implementation proxies to Supabase Auth via SupabaseModule.
    throw new Error('AuthService.login not implemented yet');
  }
}