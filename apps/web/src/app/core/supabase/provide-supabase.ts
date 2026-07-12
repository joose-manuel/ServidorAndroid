import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseInit {
  url: string;
  anonKey: string;
}

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export function provideSupabase(init: SupabaseInit): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => createClient(init.url, init.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    },
  ]);
}