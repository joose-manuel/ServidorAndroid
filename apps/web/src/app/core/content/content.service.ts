import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ServerConfigService } from '../config/server-config.service';

export interface AppContent {
  app: { brand: string; tagline: string };
  nav: Record<string, string>;
  auth: Record<string, string>;
  dashboard: Record<string, string>;
  modem: Record<string, string>;
  audit: Record<string, string>;
  camera: Record<string, string>;
  intercom: Record<string, string>;
  alerts: Record<string, string>;
  settings: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);

  readonly data = signal<AppContent | null>(null);
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const base = this.server.apiBaseUrl();
    if (!base) return;
    this.http.get<AppContent>(`${base}/content`).subscribe({
      next: (c) => this.data.set(c),
      error: () => {},
    });
  }

  t(section: keyof AppContent, key: string, fallback = ''): string {
    const content = this.data();
    if (!content) return fallback;
    const sec = content[section] as Record<string, string> | undefined;
    if (!sec) return fallback;
    return sec[key] ?? fallback;
  }
}
