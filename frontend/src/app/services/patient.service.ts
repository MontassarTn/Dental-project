import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Patient } from '../models/patient.model';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly apiUrl = `${environment.backendUrl}/api/patients`;

  /** The patient whose chart is open; tooth components read their patient ID from here. */
  private currentPatient = new BehaviorSubject<Patient | null>(null);
  currentPatient$ = this.currentPatient.asObservable();

  constructor(private http: HttpClient) {}

  /** The patient, or null if no patient has this ID. */
  findPatient(patientId: string): Observable<Patient | null> {
    return this.getPatient(patientId).pipe(
      catchError(error => {
        if (error.status === 404) return of(null);
        throw error;
      })
    );
  }

  getPatient(patientId: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/${encodeURIComponent(patientId)}`);
  }

  createPatient(patient: Patient): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, patient);
  }

  setCurrentPatient(patient: Patient | null): void {
    this.currentPatient.next(patient);
  }
}
