import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PatientService } from '../services/patient.service';
import { ToothDataService } from '../services/tooth-data.service';
import { Tooth } from '../models/tooth.model';

/** Start page: opens an existing patient's chart, or creates the patient and an empty chart. */
@Component({
  selector: 'app-patient',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './patient.component.html',
  styleUrls: ['./patient.component.scss'],
})
export class PatientComponent {
  firstName = '';
  lastName = '';
  patientId = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private patientService: PatientService,
    private toothDataService: ToothDataService,
    private router: Router
  ) {}

  async handleSubmit(): Promise<void> {
    if (!this.firstName || !this.lastName || !this.patientId) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    try {
      const existing = await firstValueFrom(this.patientService.findPatient(this.patientId));
      if (!existing) {
        await this.createPatientWithEmptyChart();
      }
      await this.router.navigate(['/chart', this.patientId]);
    } catch (error) {
      console.error('Patient processing error:', error);
      this.errorMessage = getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  private async createPatientWithEmptyChart(): Promise<void> {
    const { firstName, lastName, patientId } = this;
    await firstValueFrom(this.patientService.createPatient({ firstName, lastName, patientId }));
    await firstValueFrom(this.toothDataService.createTeeth(emptyChart(patientId)));
  }
}

/** 32 teeth (FDI 11-48), each with a buccal side ("16") and a lingual/palatal side ("16_L"). */
function emptyChart(patientId: string): Tooth[] {
  const teeth: Tooth[] = [];
  for (let quadrant = 1; quadrant <= 4; quadrant++) {
    for (let position = 1; position <= 8; position++) {
      for (const side of ['', '_L']) {
        teeth.push({
          number: `${quadrant}${position}${side}`,
          patientId,
          missing: false,
          implant: false,
          mobility: 0,
          furcation: 0,
          plaque: { mesial: false, mid: false, distal: false },
          bleeding: { mesial: false, mid: false, distal: false },
          gingivalMargin: { mesial: 0, mid: 0, distal: 0 },
          probingDepth: { mesial: 0, mid: 0, distal: 0 },
        });
      }
    }
  }
  return teeth;
}

function getErrorMessage(error: unknown): string {
  const err = error as { status?: number; message?: string } | null;
  if (err?.status === 0) return 'Cannot reach the server. Is the backend running?';
  if (err?.status === 400) return 'Invalid patient data';
  if (err?.status === 409) return 'Patient already exists';
  return err?.message || 'An unexpected error occurred. Please try again.';
}
