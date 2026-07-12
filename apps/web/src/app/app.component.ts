import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { ContentService } from './core/content/content.service';
import { PairingStoreService } from './core/pairing/pairing-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './app.component.scss',
  template: `
    @if (auth.isAuthenticated()) {
      <div class="shell">
        <aside class="shell__sidebar">
          <div class="shell__brand">
            <span class="shell__kicker">></span>
            <span class="shell__title">{{ content.t('app', 'brand', 'edge-ctrl') }}</span>
          </div>
          <nav class="shell__nav">
            <a class="shell__link" routerLink="/dashboard" routerLinkActive="shell__link--active">{{ content.t('nav', 'dashboard', 'Dashboard') }}</a>
            <a class="shell__link" routerLink="/modem" routerLinkActive="shell__link--active">{{ content.t('nav', 'modem', 'Control de módem') }}</a>
            <a class="shell__link" routerLink="/audit" routerLinkActive="shell__link--active">{{ content.t('nav', 'audit', 'Auditoría de red') }}</a>
            <a class="shell__link" routerLink="/camera" routerLinkActive="shell__link--active">{{ content.t('nav', 'camera', 'Cámara') }}</a>
            <a class="shell__link" routerLink="/intercom" routerLinkActive="shell__link--active">{{ content.t('nav', 'intercom', 'Intercom') }}</a>
            <a class="shell__link" routerLink="/alerts" routerLinkActive="shell__link--active">{{ content.t('nav', 'alerts', 'Alertas') }}</a>
            <a class="shell__link" routerLink="/settings" routerLinkActive="shell__link--active">{{ content.t('nav', 'settings', 'Ajustes') }}</a>
          </nav>
          <div class="shell__footer">
            <span class="shell__user">{{ auth.user()?.email }}</span>
            <a class="shell__link shell__link--logout" (click)="auth.logout()" href="javascript:void(0)">{{ content.t('nav', 'logout', 'Cerrar sesión') }}</a>
          </div>
        </aside>
        <main class="shell__main">
          <router-outlet />
        </main>
      </div>
    } @else {
      <div class="shell--auth">
        <router-outlet />
      </div>
    }
  `,
})
export class AppComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly content = inject(ContentService);
  private readonly pairing = inject(PairingStoreService);

  ngOnInit(): void {
    this.content.load();
    void this.pairing.syncFromBackend();
  }
}
