import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';
import { Tooth } from '../models/tooth.model';

const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Holds the open patient's teeth and keeps them in sync with the database:
 * loads them over REST, then applies every change the backend pushes over WebSocket
 * (including changes made by voice dictation).
 */
@Injectable({ providedIn: 'root' })
export class ToothDataService implements OnDestroy {
  private readonly apiUrl = `${environment.backendUrl}/api/teeth`;
  private readonly liveUpdatesUrl = environment.backendUrl.replace(/^http/, 'ws');

  private teethData = new BehaviorSubject<Tooth[]>([]);
  teethData$ = this.teethData.asObservable();

  private socket$?: WebSocketSubject<any>;
  private socketSubscription?: Subscription;
  private currentPatientId: string | null = null;
  private reconnectAttempts = 0;

  constructor(private http: HttpClient) {}

  loadTeeth(patientId: string): Observable<Tooth[]> {
    return this.http
      .get<Tooth[]>(`${this.apiUrl}?patientId=${encodeURIComponent(patientId)}`)
      .pipe(tap(teeth => this.teethData.next(teeth.map(normalizeTooth))));
  }

  /** Create the 64 tooth records (32 teeth x buccal/lingual side) for a new patient. */
  createTeeth(teeth: Tooth[]): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/initialize`, { teeth });
  }

  updateTooth(tooth: Tooth): void {
    if (!this.currentPatientId) {
      console.error('Cannot update tooth - no patient selected');
      return;
    }
    const body = { ...tooth, patientId: this.currentPatientId };
    this.http.put(`${this.apiUrl}/${encodeURIComponent(tooth.number)}`, body).subscribe({
      error: error => console.error('Error updating tooth:', error),
    });
  }

  /** Start receiving live updates for this patient (replaces any previous connection). */
  watchPatient(patientId: string): void {
    this.currentPatientId = patientId;
    this.reconnectAttempts = 0;
    this.connect();
  }

  private connect(): void {
    if (!this.currentPatientId) return;
    this.disconnect();

    this.socket$ = webSocket({
      url: `${this.liveUpdatesUrl}?patientId=${encodeURIComponent(this.currentPatientId)}`,
      openObserver: { next: () => (this.reconnectAttempts = 0) },
    });
    this.socketSubscription = this.socket$.subscribe({
      next: message => this.handleMessage(message),
      error: () => this.scheduleReconnect(),
      complete: () => this.scheduleReconnect(),
    });
  }

  /** Close the current connection on purpose (unsubscribing first, so it doesn't trigger a reconnect). */
  private disconnect(): void {
    this.socketSubscription?.unsubscribe();
    this.socket$?.complete();
    this.socketSubscription = undefined;
    this.socket$ = undefined;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Live updates disconnected - max reconnection attempts reached');
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), Math.min(1000 * this.reconnectAttempts, 5000));
  }

  private handleMessage(message: any): void {
    if (message.type === 'INITIAL_DATA') {
      this.teethData.next(message.data.map(normalizeTooth));
    } else if (message.type === 'DB_UPDATE') {
      this.applyUpdate(message.operation, message.data);
    }
  }

  private applyUpdate(operation: string, changed: Tooth): void {
    const teeth = this.teethData.value;
    const isSame = (t: Tooth) => t.number === changed.number && t.patientId === changed.patientId;

    switch (operation) {
      case 'insert':
        this.teethData.next([...teeth, normalizeTooth(changed)]);
        break;
      case 'update':
        this.teethData.next(teeth.map(t => (isSame(t) ? normalizeTooth({ ...t, ...changed }) : t)));
        break;
      case 'delete':
        this.teethData.next(teeth.filter(t => !isSame(t)));
        break;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

function normalizeTooth(tooth: Tooth): Tooth {
  return {
    ...tooth,
    bleeding: tooth.bleeding ?? { mesial: false, mid: false, distal: false },
    plaque: tooth.plaque ?? { mesial: false, mid: false, distal: false },
    gingivalMargin: tooth.gingivalMargin ?? { mesial: 0, mid: 0, distal: 0 },
    probingDepth: tooth.probingDepth ?? { mesial: 0, mid: 0, distal: 0 },
  };
}
