import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { STATUS_BADGE_LABELS } from '@servidor/ui-design-tokens';

export type StatusTone = keyof typeof STATUS_BADGE_LABELS;

@Component({
  selector: 'status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="'badge--' + tone">
      <span class="badge__dot"></span>
      <span class="badge__label">{{ label }}</span>
    </span>
  `,
  styleUrls: ['./status-badge.component.scss'],
})
export class StatusBadgeComponent {
  @Input({ required: true }) tone!: StatusTone;

  get label(): string {
    const v = STATUS_BADGE_LABELS[this.tone];
    return v ?? String(this.tone).toUpperCase();
  }
}