export enum PdfType {
  RESUME = 'RESUME',
  LINKEDIN = 'LINKEDIN',
  PORTFOLIO = 'PORTFOLIO'
}

export interface CareerSnapshot {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  summary: string;
}

export interface AnalysisResult {
  timeline: CareerSnapshot[];
  skillsGrowth: string[];
  recommendedNextSteps: string;
}

export interface UploadedPdf {
  id: string;
  filename: string;
  url: string;
  fileType: PdfType;
  uploadedAt: string;
} 