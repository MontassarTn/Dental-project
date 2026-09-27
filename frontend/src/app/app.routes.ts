import { Routes } from '@angular/router';
import { PatientComponent } from './patient/patient.component';
import { DentalChartComponent } from './dental-chart/dental-chart.component';

export const routes: Routes = [
  { path: '', component: PatientComponent },
  { path: 'chart/:patientId', component: DentalChartComponent },
  { path: '**', redirectTo: '' },
];
