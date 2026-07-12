import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cmd-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="cmd"
      [class.cmd--primary]="primary"
      [class.cmd--danger]="danger"
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      <span class="cmd__prefix">&gt;</span>
      <span class="cmd__label">
        <ng-content />
      </span>
    </button>
  `,
  styleUrls: ['./cmd-button.component.scss'],
})
export class CmdButtonComponent {
  @Input() primary = false;
  @Input() danger = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() readonly cmdClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.cmdClick.emit(event);
    }
  }
}