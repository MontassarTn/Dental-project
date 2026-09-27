import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin, retry } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * On free hosting the backend and speech service sleep when unused and take up to a minute
 * to wake up. This banner explains the wait instead of leaving an empty page.
 */
@Component({
  standalone: true,
  selector: 'app-server-status',
  template: `
    @if (state === 'waking') {
      <div class="server-status" role="status">
        <span class="spinner" aria-hidden="true"></span>
        Starting the servers… they sleep when unused, so this can take up to a minute.
      </div>
    } @else if (state === 'failed') {
      <div class="server-status failed" role="alert">
        The servers are not responding. Please refresh the page in a minute.
      </div>
    }
  `,
  styles: `
    .server-status {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: calc(100vw - 32px);
      padding: 10px 18px;
      border: 1px solid var(--primary-soft);
      border-radius: 999px;
      background: var(--primary-tint);
      box-shadow: var(--shadow);
      color: var(--primary);
      font-size: 0.9rem;
      font-weight: 500;
    }

    .server-status.failed {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }

    .spinner {
      flex: none;
      width: 14px;
      height: 14px;
      border: 2px solid var(--primary-soft);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
})
export class ServerStatusComponent implements OnInit, OnDestroy {
  /** checking: first moments, nothing shown; waking: still waiting; ready / failed: done. */
  state: 'checking' | 'waking' | 'ready' | 'failed' = 'checking';

  private readonly http = inject(HttpClient);
  private subscription?: Subscription;
  private showBannerTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // Awake servers answer at once; only show the banner when they don't
    this.showBannerTimer = setTimeout(() => {
      if (this.state === 'checking') this.state = 'waking';
    }, 1500);

    const ping = (url: string) => this.http.get(url).pipe(retry({ count: 30, delay: 3000 }));
    this.subscription = forkJoin([
      ping(`${environment.backendUrl}/api/health`),
      ping(`${environment.speechServiceUrl}/health`),
    ]).subscribe({
      next: () => (this.state = 'ready'),
      error: () => (this.state = 'failed'),
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.showBannerTimer);
    this.subscription?.unsubscribe();
  }
}
