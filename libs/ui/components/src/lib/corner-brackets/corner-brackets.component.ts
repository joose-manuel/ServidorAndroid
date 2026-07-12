import { Component, Input } from '@angular/core';

@Component({
  selector: 'corner-brackets',
  standalone: true,
  template: `
    <span class="brackets" [style.--accent]="color">
      <span class="bracket tl"></span>
      <span class="bracket tr"></span>
      <span class="bracket bl"></span>
      <span class="bracket br"></span>
    </span>
  `,
  styleUrls: ['./corner-brackets.component.scss'],
})
export class CornerBracketsComponent {
  @Input() color = 'var(--accent, #FF7A1A)';
}