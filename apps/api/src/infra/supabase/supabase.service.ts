import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private _admin: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  admin(): SupabaseClient {
    if (this._admin) return this._admin;
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error('Supabase admin client not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
    }
    this._admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return this._admin;
  }
}