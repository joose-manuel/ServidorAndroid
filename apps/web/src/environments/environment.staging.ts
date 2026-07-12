import { Environment } from './environment';

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api-staging.servidorandroid.fly.dev/api',
  supabaseUrl: 'https://staging.supabase.co',
  supabaseAnonKey: '__STAGING_SUPABASE_ANON_KEY__',
  turnServerUrl: 'turn:turn-staging.example.com:3478',
  stunServerUrl: 'stun:stun.l.google.com:19302',
};