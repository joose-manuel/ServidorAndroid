import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hud-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hud-panel" [class.has-title]="!!title">
      <header *ngIf="title" class="hud-panel__header">
        <span class="hud-panel__kicker">&gt;</span>
        <span class="hud-panel__title">{{ title }}</span>
      </header>
      <div class="hud-panel__body">
        <ng-content />
      </div>
    </section>
  `,
  styleUrls: ['./hud-panel.component.scss'],
})
export class HudPanelComponent {
  @Input() title?: string;
}