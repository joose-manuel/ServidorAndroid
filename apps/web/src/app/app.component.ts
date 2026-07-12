import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './app.component.scss',
  template: `
    <div class="shell">
      <aside class="shell__sidebar">
        <div class="shell__brand">
          <span class="shell__kicker">></span>
          <span class="shell__title">edge-ctrl</span>
        </div>
        <nav class="shell__nav">
          <a class="shell__link" routerLink="/dashboard" routerLinkActive="shell__link--active">Dashboard</a>
          <a class="shell__link" routerLink="/modem" routerLinkActive="shell__link--active">Control de módem</a>
          <a class="shell__link" routerLink="/audit" routerLinkActive="shell__link--active">Auditoría de red</a>
          <a class="shell__link" routerLink="/camera" routerLinkActive="shell__link--active">Cámara</a>
          <a class="shell__link" routerLink="/intercom" routerLinkActive="shell__link--active">Intercom</a>
          <a class="shell__link" routerLink="/alerts" routerLinkActive="shell__link--active">Alertas</a>
          <a class="shell__link" routerLink="/settings" routerLinkActive="shell__link--active">Ajustes</a>
          <a class="shell__link shell__link--pair" routerLink="/pair" routerLinkActive="shell__link--active">Vincular nodo</a>
        </nav>
      </aside>
      <main class="shell__main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {}