import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PatientService } from '../services/patient.service';
import { ToothDataService } from '../services/tooth-data.service';
import { Patient } from '../models/patient.model';
import { ToothDisplayComponent } from '../tooth-display/tooth-display.component';
import { VoiceDictationComponent } from '../voice-dictation/voice-dictation.component';

/** Chart page: patient details, voice dictation and the full periodontal chart. */
@Component({
  selector: 'app-dental-chart',
  standalone: true,
  imports: [DatePipe, RouterLink, ToothDisplayComponent, VoiceDictationComponent],
  templateUrl: './dental-chart.component.html',
  styleUrls: ['./dental-chart.component.scss'],
})
export class DentalChartComponent implements OnInit {
  // FDI tooth numbers in chart order (left to right); "_L" = palatal/lingual side
  leftUpperTeeth = ['18', '17', '16', '15', '14', '13', '12', '11'];
  rightUpperTeeth = ['21', '22', '23', '24', '25', '26', '27', '28'];
  leftLowerTeeth = ['48', '47', '46', '45', '44', '43', '42', '41'];
  rightLowerTeeth = ['31', '32', '33', '34', '35', '36', '37', '38'];
  leftUpperTeeth_L = this.leftUpperTeeth.map(n => `${n}_L`);
  rightUpperTeeth_L = this.rightUpperTeeth.map(n => `${n}_L`);
  leftLowerTeeth_L = this.leftLowerTeeth.map(n => `${n}_L`);
  rightLowerTeeth_L = this.rightLowerTeeth.map(n => `${n}_L`);

  patientId = '';
  patientData: Patient | null = null;

  zoomLevel = 70; // percent
  readonly minZoom = 60;
  readonly maxZoom = 150;
  readonly zoomStep = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private patientService: PatientService,
    private toothDataService: ToothDataService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.patientId = params['patientId'];
      this.loadChart();
    });
  }

  private async loadChart(): Promise<void> {
    try {
      this.patientData = await firstValueFrom(this.patientService.getPatient(this.patientId));
      this.patientService.setCurrentPatient(this.patientData);
      await firstValueFrom(this.toothDataService.loadTeeth(this.patientId));
      this.toothDataService.watchPatient(this.patientId);
    } catch (error) {
      console.error('Could not load the chart for patient', this.patientId, error);
      this.router.navigate(['/']);
    }
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomStep);
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomStep);
  }
}
