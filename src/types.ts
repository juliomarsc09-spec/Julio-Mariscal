export type QuarantineCategory = 'HEWAN' | 'IKAN' | 'TUMBUHAN';

export type RiskLevel = 'SANGAT TINGGI' | 'TINGGI' | 'SEDANG' | 'RENDAH';

export type TradeActivityType = 'EKSPOR' | 'IMPOR' | 'DOMESTIK MASUK' | 'DOMESTIK KELUAR';

export type ActiveNavTab = 'dashboard' | 'applicant' | 'commodity' | 'country' | 'table';

export interface MediaPembawaRecord {
  id: string;
  no: number;
  kategori: QuarantineCategory; // HEWAN, IKAN, TUMBUHAN
  jenisKegiatan?: TradeActivityType; // EKSPOR, IMPOR, DOMESTIK MASUK, DOMESTIK KELUAR
  pemohon: string;
  komoditas: string;
  tempatPeriksa: string[]; // Normalized array of inspection locations
  tempatPeriksaRaw: string;
  asal: string[]; // Normalized array of origin countries / destination
  asalRaw: string;
  kodeHs: string[]; // Normalized HS Codes
  kodeHsRaw: string;
  tingkatRisiko?: RiskLevel;
  catatanKarantina?: string;
  jenisPerusahaan?: string;
  identitas?: string;
  lingkupAktivitas?: string;
  frekuensi?: number;
  statusKepemilikan?: string;
  pemilik?: string;
  email?: string;
  tanggalRegistrasi?: string;
  statusBlokir?: string;
  createdAt?: string;
}

export interface CompanyContactInfo {
  companyName: string;
  pemilik: string;
  email: string;
  updatedAt: string;
}

export interface ApplicantProfile {
  name: string;
  pemilik?: string;
  email?: string;
  totalDeclarations: number;
  categories: QuarantineCategory[];
  categoriesBreakdown: Record<QuarantineCategory, number>;
  primaryCategory: QuarantineCategory;
  tradeActivities: TradeActivityType[];
  tradeActivitiesBreakdown: Record<TradeActivityType, number>;
  commodities: string[];
  origins: string[];
  inspectionSites: string[];
  hsCodes: string[];
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  complianceScore?: number; // 0-100
  complianceTier?: ComplianceTier; // HIJAU, KUNING, MERAH
  keyRiskFactors: string[];
  recommendedProtocols: string[];
}

export type ComplianceTier = 'HIJAU' | 'KUNING' | 'MERAH';

export interface ScoreAdjustmentLog {
  id: string;
  applicantName: string;
  type: 'PENAMBAHAN' | 'PENGURANGAN';
  points: number; // e.g. -15 or +10
  reason: string;
  referenceNo?: string;
  officerName?: string;
  previousScore: number;
  newScore: number;
  previousTier: ComplianceTier;
  newTier: ComplianceTier;
  timestamp: string;
}

export interface CompanyComplianceData {
  applicantName: string;
  baseScore: number; // default 100
  currentScore: number; // 0-100
  tier: ComplianceTier; // 'HIJAU' (>=80), 'KUNING' (50-79), 'MERAH' (<50)
  logs: ScoreAdjustmentLog[];
  updatedAt: string;
}

export interface CommodityImporterDetail {
  pemohon: string;
  count: number;
  tradeActivities: TradeActivityType[];
  origins: string[];
}

export interface CommodityOriginDetail {
  country: string;
  count: number;
  companies: string[];
}

export interface CommodityProfile {
  name: string;
  kategori: QuarantineCategory;
  totalDeclarations: number;
  tradeActivities: TradeActivityType[];
  tradeActivitiesBreakdown: Record<TradeActivityType, number>;
  importers: string[];
  importerDetails: CommodityImporterDetail[];
  origins: string[];
  originDetails: CommodityOriginDetail[];
  inspectionSites: string[];
  hsCodes: string[];
  riskLevel: RiskLevel;
  requiredDocuments: string[];
  inspectionProcedures: string[];
}

export interface ClearDataCriteria {
  activity: TradeActivityType | 'ALL';
  category: QuarantineCategory | 'ALL';
}


export type ThemeMode = 'day' | 'night';

export type WatchPriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Watchlist Models for Manual Officer Flagging
export interface PriorityCommodityWatchItem {
  id: string;
  commodityName: string;
  category: QuarantineCategory;
  reason: string;
  regulationRef: string;
  targetActions: string[];
  officerName: string;
  addedAt: string;
  priorityLevel: WatchPriorityLevel;
}

export interface PriorityCountryWatchItem {
  id: string;
  countryName: string;
  affectedCategories: QuarantineCategory[];
  suspectDiseases: string[];
  reason: string;
  regulationRef: string;
  quarantineMeasures: string[];
  officerName: string;
  addedAt: string;
  priorityLevel: WatchPriorityLevel;
}

// Biosecurity Suspect Disease Information Model
export interface SuspectDiseaseInfo {
  diseaseName: string;
  scientificName?: string;
  type: 'HPHK' | 'HPIK' | 'OPTK'; // Hama Penyakit Hewan Karantina / Ikan / Tumbuhan
  targetCommodities: string[];
  riskDescription: string;
  mandatoryLabTests: string[];
  outbreakNotice?: string;
}

// Country Profile Model
export interface CountryProfile {
  countryName: string;
  totalDeclarations: number;
  companies: string[]; // Asal perusahaan (pengimpor / pengekspor / pemohon)
  commodities: { name: string; category: QuarantineCategory; count: number }[]; // Jenis komoditas dari negara tersebut
  tradeActivities: TradeActivityType[];
  tradeActivitiesBreakdown: Record<TradeActivityType, number>;
  suspectDiseases: SuspectDiseaseInfo[]; // Suspect penyakit asal negara tersebut
  inspectionSites: string[];
  hsCodes: string[];
  isWatchlist: boolean;
  watchItem?: PriorityCountryWatchItem;
}

export interface FilterState {
  searchQuery: string;
  category: QuarantineCategory | 'ALL';
  jenisKegiatan: TradeActivityType | 'ALL';
  pemohon: string;
  komoditas: string;
  asal: string;
  tempatPeriksa: string;
  riskLevel: RiskLevel | 'ALL';
}

export interface AIRiskAnalysisRequest {
  pemohon: string;
  komoditas: string;
  kategori: QuarantineCategory;
  asal: string;
  tempatPeriksa: string;
  kodeHs: string;
}

export interface AIRiskAnalysisResponse {
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  potentialThreats: string[];
  requiredDocuments: string[];
  quarantineActions: string[];
  recommendationNote: string;
}

export type UpdateActionType =
  | 'DEDUPLIKASI_PERUSAHAAN'
  | 'IMPOR_EXCEL'
  | 'TAMBAH_DATA'
  | 'HAPUS_SELEKTIF'
  | 'PENILAIAN_SKOR'
  | 'PENGAWASAN_UTAMA'
  | 'KONTAK_PERUSAHAAN'
  | 'SINKRONISASI';

export interface DataUpdateLog {
  id: string;
  timestamp: string;
  actionType: UpdateActionType;
  title: string;
  description: string;
  recordsAffected: number;
  officerName: string;
  metadata?: Record<string, any>;
}

export interface SyncState {
  isAutoSyncEnabled: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  status: 'ONLINE' | 'SYNCING' | 'OFFLINE' | 'ERROR';
  pendingChangesCount: number;
}


