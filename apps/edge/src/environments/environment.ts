export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  modemDefaultIp: string;
}

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'https://servidorandroid.seenode.app/api',
  modemDefaultIp: '192.168.1.1',
};