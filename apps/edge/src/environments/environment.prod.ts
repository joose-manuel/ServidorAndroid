interface Environment {
  production: boolean;
  apiBaseUrl: string;
  modemDefaultIp: string;
}

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api.servidorandroid.fly.dev/api',
  modemDefaultIp: '192.168.1.1',
};
