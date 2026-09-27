import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ServerStatusComponent } from './server-status/server-status.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ServerStatusComponent],
  template: '<app-server-status /><router-outlet />',
})
export class AppComponent {}
