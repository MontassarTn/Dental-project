import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ToothDataService } from '../services/tooth-data.service';
import { PatientService } from '../services/patient.service';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SiteMeasurement, SiteStatus, Tooth } from '../models/tooth.model';

/** One column of the chart: a tooth side ("16" buccal or "16_L" palatal/lingual) with its image and controls. */

@Component({
  selector: 'app-tooth-display',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tooth-display.component.html',
  styleUrls: ['./tooth-display.component.scss']
})
export class ToothDisplayComponent implements OnInit, OnDestroy {
  @Input() toothNumber: string = '11';
  isMissing: boolean = false;
  isImplant: boolean = false;
  mobilityLevel: number = 0;
  furcationLevel: number = 0;
  furcation_mesial: number = 0;
  furcation_distal: number = 0;
  isLingual: boolean = false;
  bleeding: SiteStatus = { mesial: false, mid: false, distal: false };
  plaque: SiteStatus = { mesial: false, mid: false, distal: false };
  gingivalMargin: SiteMeasurement = { mesial: 0, mid: 0, distal: 0 };
  probingDepth: SiteMeasurement = { mesial: 0, mid: 0, distal: 0 };

  private dataSubscription!: Subscription;
  private patientSubscription!: Subscription;
  private currentPatientId: string | null = null;


  constructor(
    private toothDataService: ToothDataService,
    private patientService: PatientService
  ) {}

  ngOnInit(): void {
    this.isLingual = this.toothNumber.endsWith('_L');
    this.patientSubscription = this.patientService.currentPatient$.subscribe(patient => {
      if (!patient) {
        console.error('No patient selected');
        this.resetToDefaultValues();
        return;
      }

      this.currentPatientId = patient.patientId;
      this.setupTeethDataSubscription();
    });    
  }

  private setupTeethDataSubscription(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }

    this.dataSubscription = this.toothDataService.teethData$.subscribe(teeth => {
      if (!teeth || !this.currentPatientId) {
        this.resetToDefaultValues();
        return;
      }

      const toothData = teeth.find(t => 
        t.number === this.toothNumber && t.patientId === this.currentPatientId
      );

      if (toothData) {
        this.updateLocalState(toothData);
      } else {
        this.resetToDefaultValues();
      }
    });
  }

  selectAll(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  private updateLocalState(toothData: Tooth): void {
    this.isMissing = toothData.missing ?? false;
    this.isImplant = toothData.implant ?? false;
    this.mobilityLevel = toothData.mobility ?? 0;
    
    if (this.isLingual) {
      this.furcation_mesial = toothData.furcation_mesial ?? toothData.furcation ?? 0;
      this.furcation_distal = toothData.furcation_distal ?? toothData.furcation ?? 0;
    } else {
      this.furcationLevel = toothData.furcation ?? 0;
    }
    
    this.bleeding = toothData.bleeding ?? { mesial: false, mid: false, distal: false };
    this.plaque = toothData.plaque ?? { mesial: false, mid: false, distal: false };
    this.gingivalMargin = toothData.gingivalMargin ?? { mesial: 0, mid: 0, distal: 0 };
    this.probingDepth = toothData.probingDepth ?? { mesial: 0, mid: 0, distal: 0 };
  }

  private resetToDefaultValues(): void {
    this.isMissing = false;
    this.isImplant = false;
    this.mobilityLevel = 0;
    this.furcationLevel = 0;
    this.furcation_mesial = 0;
    this.furcation_distal = 0;
    this.bleeding = { mesial: false, mid: false, distal: false };
    this.plaque = { mesial: false, mid: false, distal: false };
    this.gingivalMargin = { mesial: 0, mid: 0, distal: 0 };
    this.probingDepth = { mesial: 0, mid: 0, distal: 0 };
  }

  onProbingDepthChange(): void {
    this.probingDepth = {
      mesial: this.clampValue(this.probingDepth.mesial, 0, 15),
      mid: this.clampValue(this.probingDepth.mid, 0, 15),
      distal: this.clampValue(this.probingDepth.distal, 0, 15)
    };
    this.updateToothData();
  }

  onGingivalMarginChange(): void {
    this.gingivalMargin = {
      mesial: this.clampValue(this.gingivalMargin.mesial),
      mid: this.clampValue(this.gingivalMargin.mid),
      distal: this.clampValue(this.gingivalMargin.distal)
    };
    this.updateToothData();
  }

  private clampValue(value: number, min: number = 0, max: number = 10): number {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  toggleMissingStatus(event: MouseEvent): void {
    event.stopPropagation();
    this.isMissing = !this.isMissing;
    if (this.isMissing) {
      this.isImplant = false;
      this.furcationLevel = 0;
      this.furcation_mesial = 0;
      this.furcation_distal = 0;
      this.bleeding = { mesial: false, mid: false, distal: false };
      this.plaque = { mesial: false, mid: false, distal: false };
    }
    this.updateToothData();
  }

  toggleImplant(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing && !this.isLingual) {
      this.isImplant = !this.isImplant;
      if (this.isImplant) {
        this.isMissing = false;
        this.furcationLevel = 0;
        this.furcation_mesial = 0;
        this.furcation_distal = 0;
      }
      this.updateToothData();
    }
  }
  get showMesialDistalFurcation(): boolean {
    const specificMolars = ['18_L', '17_L', '16_L','14_L' ,'24_L','26_L', '27_L', '28_L'];
    return this.isLingual && specificMolars.includes(this.toothNumber);
  }
  cycleFurcation(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing && !this.isImplant && !this.isLingual) {
      this.furcationLevel = (this.furcationLevel + 1) % 4;
      this.updateToothData();
    }
  }

  cycleFurcationMesial(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing && !this.isImplant && this.isLingual) {
      this.furcation_mesial = (this.furcation_mesial + 1) % 4;
      this.updateToothData();
    }
  }

  cycleFurcationDistal(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing && !this.isImplant && this.isLingual) {
      this.furcation_distal = (this.furcation_distal + 1) % 4;
      this.updateToothData();
    }
  }

  cycleMobility(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing && !this.isLingual) {
      this.mobilityLevel = (this.mobilityLevel + 1) % 4;
      this.updateToothData();
    }
  }

  toggleBleeding(type: keyof SiteStatus, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing) {
      this.bleeding = {
        ...this.bleeding,
        [type]: !this.bleeding[type]
      };
      this.updateToothData();
    }
  }

  togglePlaque(type: keyof SiteStatus, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isMissing) {
      this.plaque = {
        ...this.plaque,
        [type]: !this.plaque[type]
      };
      this.updateToothData();
    }
  }

  private updateToothData(): void {
    if (!this.currentPatientId) {
      console.error('Cannot update tooth - no patient selected');
      return;
    }

    const toothData: any = {
      number: this.toothNumber,
      patientId: this.currentPatientId,
      missing: this.isMissing,
      implant: this.isImplant,
      mobility: this.mobilityLevel,
      bleeding: this.bleeding,
      plaque: this.plaque,
      gingivalMargin: this.gingivalMargin,
      probingDepth: this.probingDepth
    };

    if (this.isLingual) {
      toothData.furcation_mesial = this.furcation_mesial;
      toothData.furcation_distal = this.furcation_distal;
    } else {
      toothData.furcation = this.furcationLevel;
    }

    this.toothDataService.updateTooth(toothData);
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    if (this.patientSubscription) {
      this.patientSubscription.unsubscribe();
    }
  }
  
  get imageRotation(): string {
    const num = parseInt(this.toothNumber.replace('_L', ''), 10);
  
    if (isNaN(num)) return '';
  
    const isUpper = (num >= 11 && num <= 18) || (num >= 21 && num <= 28);
    const isLower = (num >= 31 && num <= 38) || (num >= 41 && num <= 48);
  
    // Roots point down on the chart: flip lower buccal and upper palatal images
    if ((isLower && !this.isLingual) || (isUpper && this.isLingual)) {
      return 'rotate-180';
    }
  
    return '';
  }
  
}