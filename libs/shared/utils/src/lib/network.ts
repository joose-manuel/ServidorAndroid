const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export function isValidMac(value: string): boolean {
  return MAC_RE.test(value.trim());
}

export function normalizeMac(value: string): string {
  return value.trim().toUpperCase().replace(/-/g, ':');
}

export function isValidIp(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

export function isPrivateIp(value: string): boolean {
  if (!isValidIp(value)) return false;
  const [a, b] = value.split('.').map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function formatBandwidth(bytesPerSec: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let v = bytesPerSec;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}