import { Environment } from './environment';

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://servidorandroid.seenode.app/api',
  supabaseUrl: 'https://app.supabase.co',
  supabaseAnonKey: '__PROD_SUPABASE_ANON_KEY__',
  turnServerUrl: 'turn:turn.example.com:3478',
  stunServerUrl: 'stun:stun.l.google.com:19302',
};
