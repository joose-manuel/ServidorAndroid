/**
 * Lightweight wrapper around @supabase/supabase-js that defers the actual
 * instantiation so this library can be loaded server-side (NestJS) without
 * pulling browser-only deps, and from Angular without pulling node-only deps.
 *
 * Concrete clients live in apps/web/src/app/core/supabase/ (browser) and
 * apps/api/src/infra/supabase/ (server, admin key).
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env['SUPABASE_URL'];
  const anonKey = env['SUPABASE_ANON_KEY'] ?? env['PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !anonKey) {
    throw new Error('Supabase config missing: SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  return {
    url,
    anonKey,
    serviceRoleKey: env['SUPABASE_SERVICE_ROLE_KEY'],
  };
}