import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Http } from '@capacitor/http';
import { environment } from '../../../environments/environment';
import { Modem } from '@servidor/shared-types';

/**
 * Speaks directly to the home modem. Uses @capacitor/http so we bypass
 * the WebView's CORS checks (see Documentacion_Edge_Node.docx, sec 11.2).
 */
@Component({
  selector: 'app-modem-client',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="client">
      <h2 class="client__title">&gt; modem-client</h2>
      <pre class="client__dump">{{ format(state()) }}</pre>
    </div>
  `,
  styles: [
    `
      .client {
        background: #05070a;
        color: #d7dee3;
        padding: 16px;
        font-family: 'JetBrains Mono', monospace;
      }
      .client__title {
        font-size: 16px;
        color: #ff7a1a;
        margin: 0 0 16px;
      }
      .client__dump {
        background: #0a0e14;
        border: 1px solid #1c2530;
        padding: 12px;
        font-size: 12px;
      }
    `,
  ],
})
export class ModemClientComponent {
  readonly state = signal<Modem | null>(null);

  format(m: Modem | null): string {
    return m ? JSON.stringify(m, null, 2) : 'loading…';
  }

  async ping(): Promise<void> {
    try {
      const res = await Http.request({
        method: 'GET',
        url: `http://${environment.modemDefaultIp}/api/sysinfo`,
        connectTimeout: 3000,
        readTimeout: 3000,
      });
      this.state.set({
        id: 'modem-1',
        ip: environment.modemDefaultIp,
        vendor: 'unknown',
        model: 'unknown',
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      });
      console.log('modem response', res.status);
    } catch (err) {
      this.state.set({
        id: 'modem-1',
        ip: environment.modemDefaultIp,
        vendor: 'unknown',
        model: 'unknown',
        status: 'offline',
        lastSeenAt: new Date().toISOString(),
      });
    }
  }
}