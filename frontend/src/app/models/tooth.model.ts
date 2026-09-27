/** Per-site yes/no finding (bleeding, plaque). */
export interface SiteStatus {
  mesial: boolean;
  mid: boolean;
  distal: boolean;
}

/** Per-site measurement in mm (gingival margin, probing depth). */
export interface SiteMeasurement {
  mesial: number;
  mid: number;
  distal: number;
}

/**
 * One tooth side of the chart. `number` is the FDI tooth number ("16");
 * a "_L" suffix ("16_L") means the palatal/lingual side of that tooth.
 */
export interface Tooth {
  number: string;
  patientId: string;
  missing: boolean;
  implant: boolean;
  mobility: number;
  furcation: number;
  furcation_mesial?: number;
  furcation_distal?: number;
  bleeding: SiteStatus;
  plaque: SiteStatus;
  gingivalMargin: SiteMeasurement;
  probingDepth: SiteMeasurement;
}
