import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ContentService } from '../../core/content/content.service';
import { ServerConfigService } from '../../core/config/server-config.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth">
      <div class="auth__card">
        <div class="auth__header">
          <span class="auth__kicker">></span>
          <span class="auth__title">{{ content.t('auth', 'registerTitle', 'Crear cuenta') }}</span>
        </div>
        <p class="auth__sub">{{ content.t('auth', 'registerSubtitle', '') }}</p>
        <form (ngSubmit)="onSubmit()" class="auth__form">
          <label class="auth__label">{{ content.t('auth', 'displayNameLabel', 'Nombre') }}</label>
          <input
            class="auth__input"
            type="text"
            autocomplete="name"
            [(ngModel)]="displayName"
            name="displayName"
          />
          <label class="auth__label">{{ content.t('auth', 'emailLabel', 'Email') }}</label>
          <input
            class="auth__input"
            type="email"
            autocomplete="email"
            [(ngModel)]="email"
            name="email"
            required
          />
          <label class="auth__label">{{ content.t('auth', 'passwordLabel', 'Contraseña') }}</label>
          <input
            class="auth__input"
            type="password"
            autocomplete="new-password"
            [(ngModel)]="password"
            name="password"
            required
          />
          <label class="auth__label">Confirmar contraseña</label>
          <input
            class="auth__input"
            type="password"
            autocomplete="new-password"
            [(ngModel)]="confirmPassword"
            name="confirmPassword"
            required
          />
          @if (error()) {
            <div class="auth__error">✗ {{ error() }}</div>
          }
          <button class="auth__btn" type="submit" [disabled]="registering()">
            {{ registering() ? content.t('auth', 'registering', 'Registrando…') : content.t('auth', 'registerButton', 'Registrarse') }}
          </button>
        </form>
        <p class="auth__footer">
          {{ content.t('auth', 'haveAccount', '¿Ya tenés cuenta?') }}
          <a routerLink="/login">{{ content.t('auth', 'loginLink', 'Iniciar sesión') }}</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      font-family: 'JetBrains Mono', monospace;
    }
    .auth__card {
      background: #0a0e14;
      border: 1px solid #1c2530;
      padding: 32px;
      width: 100%;
      max-width: 400px;
    }
    .auth__header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .auth__kicker { color: #ff7a1a; font-weight: 700; }
    .auth__title { color: #d7dee3; font-size: 18px; letter-spacing: 0.05em; }
    .auth__sub { color: #5c6773; font-size: 12px; margin: 0 0 24px; line-height: 1.5; }
    .auth__form { display: flex; flex-direction: column; gap: 8px; }
    .auth__label { color: #5c6773; font-size: 11px; text-transform: uppercase; margin-top: 8px; }
    .auth__input {
      background: #05070a;
      border: 1px solid #1c2530;
      color: #39ff88;
      padding: 10px;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }
    .auth__input:focus { border-color: #ff7a1a; }
    .auth__error {
      color: #ff4444;
      font-size: 11px;
      padding: 8px;
      border: 1px solid #ff4444;
      margin-top: 8px;
    }
    .auth__btn {
      background: #ff7a1a;
      color: #05070a;
      border: none;
      padding: 12px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      margin-top: 16px;
    }
    .auth__btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .auth__footer {
      color: #5c6773;
      font-size: 12px;
      text-align: center;
      margin-top: 24px;
    }
    .auth__footer a { color: #ff7a1a; }
  `],
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  readonly content = inject(ContentService);
  private readonly router = inject(Router);
  private readonly server = inject(ServerConfigService);

  email = '';
  password = '';
  confirmPassword = '';
  displayName = '';
  readonly error = signal<string | null>(null);
  readonly registering = signal(false);

  onSubmit(): void {
    this.error.set(null);
    if (!this.email || !this.password) {
      this.error.set('Completá todos los campos');
      return;
    }
    if (this.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.registering.set(true);
    this.auth.register(this.email, this.password, this.displayName || undefined).subscribe({
      next: () => {
        this.registering.set(false);
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const msg = err.status === 409 ? 'El email ya está registrado'
          : err.status === 500 ? 'Error interno del servidor (revisá la DB esté conectada)'
          : err.status ? `Error HTTP ${err.status}`
          : `No se pudo conectar a ${this.server.apiBaseUrl()}/auth/register — ¿el backend está corriendo?`;
        this.error.set(msg);
        this.registering.set(false);
      },
    });
  }
}
