import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ServerConfigService } from '../config/server-config.service';
import { tap, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';

const TOKEN_KEY = 'web_auth_token';
const USER_KEY = 'web_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(null);
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.token() && !!this.user());
  readonly isLoggingIn = signal(false);

  constructor() {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        this.token.set(savedToken);
        this.user.set(JSON.parse(savedUser));
      } catch {
        this.clear();
      }
    }
  }

  login(email: string, password: string): Observable<AuthUser> {
    this.isLoggingIn.set(true);
    return this.http.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      `${this.server.apiBaseUrl()}/auth/login`,
      { email, password },
    ).pipe(
      tap((res) => {
        this.token.set(res.accessToken);
        localStorage.setItem(TOKEN_KEY, res.accessToken);
      }),
      switchMap(() => this.fetchMe()),
      tap({
        next: () => this.isLoggingIn.set(false),
        error: () => this.isLoggingIn.set(false),
      }),
    );
  }

  register(email: string, password: string, displayName?: string): Observable<{ id: string }> {
    return this.http.post<{ id: string; email: string }>(
      `${this.server.apiBaseUrl()}/auth/register`,
      { email, password, displayName },
    );
  }

  fetchMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.server.apiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${this.token()}` },
    }).pipe(
      tap((u) => {
        this.user.set(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }),
    );
  }

  logout(): void {
    this.clear();
    this.router.navigate(['/login']);
  }

  private clear(): void {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
