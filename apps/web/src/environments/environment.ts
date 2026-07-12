export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnServerUrl: string;
  stunServerUrl: string;
}

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  supabaseUrl: 'http://localhost:54321',
  supabaseAnonKey: '',
  turnServerUrl: 'turn:localhost:3478',
  stunServerUrl: 'stun:stun.l.google.com:19302',
};