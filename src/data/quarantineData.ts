import {
  MediaPembawaRecord,
  RiskLevel,
  QuarantineCategory,
  ApplicantProfile,
  CommodityProfile,
  CountryProfile,
  TradeActivityType,
  CompanyContactInfo,
} from '../types';
import { extractCompanyCoreName } from './companyNormalizer';
import {
  getCountryDiseaseSuspects,
  getWatchlistCountryItem,
  isCountryInWatchlist,
  getAllWatchlistCountries,
} from './watchlistData';
import rawDataset from './quarantineDataset.json';

// Export dataset populated from dataset JSON, ensuring valid defaults
export const INITIAL_QUARANTINE_DATA: MediaPembawaRecord[] = (rawDataset as any[]).map((r) => ({
  ...r,
  jenisKegiatan: (r.jenisKegiatan || 'IMPOR') as TradeActivityType,
}));


// Helper to determine automatic risk level based on commodity & origin characteristics
export function calculateAutomaticRisk(
  kategori: QuarantineCategory,
  komoditas: string,
  asal: string[]
): { riskLevel: RiskLevel; riskScore: number } {
  const komoditasLower = komoditas.toLowerCase();
  const asalJoined = asal.join(' ').toLowerCase();

  // High risk commodities (live animals, uncooked meats, biological items, vaccines, fresh plants)
  if (
    komoditasLower.includes('daging') ||
    komoditasLower.includes('jerohan') ||
    komoditasLower.includes('lidah') ||
    komoditasLower.includes('sapi') ||
    komoditasLower.includes('hati') ||
    komoditasLower.includes('bahan biologis') ||
    komoditasLower.includes('vaksin') ||
    komoditasLower.includes('hidup') ||
    komoditasLower.includes('benih') ||
    komoditasLower.includes('bibit') ||
    komoditasLower.includes('daging olahan babi')
  ) {
    if (
      asalJoined.includes('china') ||
      asalJoined.includes('india') ||
      asalJoined.includes('brasil') ||
      asalJoined.includes('vietnam')
    ) {
      return { riskLevel: 'SANGAT TINGGI', riskScore: 88 };
    }
    return { riskLevel: 'TINGGI', riskScore: 78 };
  }

  // Medium risk (Dairy, Cheese, Whey, Fish, Squid, Poultry Meal, Animal Feed)
  if (
    komoditasLower.includes('susu') ||
    komoditasLower.includes('keju') ||
    komoditasLower.includes('mentega') ||
    komoditasLower.includes('whey') ||
    komoditasLower.includes('pakan') ||
    komoditasLower.includes('tepung') ||
    komoditasLower.includes('tuna') ||
    komoditasLower.includes('salmon') ||
    komoditasLower.includes('cumi') ||
    komoditasLower.includes('makarel') ||
    komoditasLower.includes('gelatin') ||
    komoditasLower.includes('bulu')
  ) {
    return { riskLevel: 'SEDANG', riskScore: 52 };
  }

  // Low risk (Processed goods, dried products, diagnostic reagents, seaweed)
  return { riskLevel: 'RENDAH', riskScore: 28 };
}

// Function to split raw text by comma, newline, or multiple spaces
export function parseList(input: string): string[] {
  if (!input) return [];
  return input
    .replace(/"/g, '')
    .split(/[\n,\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !item.match(/^\d+\.\s*$/));
}

// Utility functions below

export function getUniquePemohonList(data: MediaPembawaRecord[]): string[] {
  const set = new Set<string>();
  data.forEach((item) => {
    if (item.pemohon) set.add(item.pemohon);
  });
  return Array.from(set).sort();
}

export function getUniqueKomoditasList(data: MediaPembawaRecord[]): string[] {
  const set = new Set<string>();
  data.forEach((item) => {
    if (item.komoditas) set.add(item.komoditas);
  });
  return Array.from(set).sort();
}

export function getUniqueOrigins(data: MediaPembawaRecord[]): string[] {
  const set = new Set<string>();
  data.forEach((item) => {
    item.asal.forEach((c) => set.add(c));
  });
  return Array.from(set).sort();
}

export function getUniqueInspectionSites(data: MediaPembawaRecord[]): string[] {
  const set = new Set<string>();
  data.forEach((item) => {
    item.tempatPeriksa.forEach((site) => set.add(site));
  });
  return Array.from(set).sort();
}

export function getUniqueTradeActivities(): TradeActivityType[] {
  return ['IMPOR', 'EKSPOR', 'DOMESTIK MASUK', 'DOMESTIK KELUAR'];
}

export function getApplicantProfile(
  data: MediaPembawaRecord[],
  pemohonName: string,
  tradeActivityFilter?: TradeActivityType | 'ALL',
  companyContacts?: Record<string, CompanyContactInfo>,
  categoryFilter?: QuarantineCategory | 'ALL'
): ApplicantProfile | null {
  const allRecords = data.filter(
    (item) => item.pemohon.toLowerCase() === pemohonName.toLowerCase()
  );

  if (allRecords.length === 0) return null;

  // Breakdown across all activities for this applicant
  const tradeActivitiesBreakdown: Record<TradeActivityType, number> = {
    'IMPOR': 0,
    'EKSPOR': 0,
    'DOMESTIK MASUK': 0,
    'DOMESTIK KELUAR': 0,
  };
  const tradeActivitiesSet = new Set<TradeActivityType>();

  // Breakdown across all 3 quarantine categories (Hewan, Ikan, Tumbuhan) for this applicant
  const categoriesBreakdown: Record<QuarantineCategory, number> = {
    HEWAN: 0,
    IKAN: 0,
    TUMBUHAN: 0,
  };
  const allCategoriesSet = new Set<QuarantineCategory>();

  allRecords.forEach((r) => {
    const activity = (r.jenisKegiatan || 'IMPOR') as TradeActivityType;
    tradeActivitiesSet.add(activity);
    tradeActivitiesBreakdown[activity] = (tradeActivitiesBreakdown[activity] || 0) + 1;

    if (r.kategori) {
      allCategoriesSet.add(r.kategori);
      categoriesBreakdown[r.kategori] = (categoriesBreakdown[r.kategori] || 0) + 1;
    }
  });

  // Filter records by selected trade activity and selected category if specified
  const records = allRecords.filter((r) => {
    const matchActivity =
      !tradeActivityFilter ||
      tradeActivityFilter === 'ALL' ||
      (r.jenisKegiatan || 'IMPOR') === tradeActivityFilter;
    const matchCategory =
      !categoryFilter ||
      categoryFilter === 'ALL' ||
      r.kategori === categoryFilter;
    return matchActivity && matchCategory;
  });

  const evaluationRecords = records;

  const commoditiesSet = new Set<string>();
  const originsSet = new Set<string>();
  const sitesSet = new Set<string>();
  const hsCodesSet = new Set<string>();

  let totalScore = 0;

  evaluationRecords.forEach((r) => {
    commoditiesSet.add(r.komoditas);
    r.asal.forEach((a) => originsSet.add(a));
    r.tempatPeriksa.forEach((s) => sitesSet.add(s));
    r.kodeHs.forEach((h) => hsCodesSet.add(h));

    const { riskScore } = calculateAutomaticRisk(r.kategori, r.komoditas, r.asal);
    totalScore += riskScore;
  });

  let avgRiskScore = 0;
  if (evaluationRecords.length > 0) {
    avgRiskScore = Math.round(totalScore / evaluationRecords.length);
  } else {
    let fallbackScore = 0;
    allRecords.forEach((r) => {
      fallbackScore += calculateAutomaticRisk(r.kategori, r.komoditas, r.asal).riskScore;
    });
    avgRiskScore = Math.round(fallbackScore / allRecords.length);
  }

  let overallRisk: RiskLevel = 'SEDANG';
  if (avgRiskScore >= 80) overallRisk = 'SANGAT TINGGI';
  else if (avgRiskScore >= 65) overallRisk = 'TINGGI';
  else if (avgRiskScore >= 40) overallRisk = 'SEDANG';
  else overallRisk = 'RENDAH';

  const keyRiskFactors: string[] = [];
  if (originsSet.has('CHINA') || originsSet.has('BRASIL') || originsSet.has('INDIA')) {
    keyRiskFactors.push('Kegiatan lalu lintas komoditas dari/ke negara berisiko tinggi (Endemis PMK / ASF / Avian Influenza)');
  }
  if (Array.from(commoditiesSet).some((c) => c.toLowerCase().includes('daging') || c.toLowerCase().includes('jerohan'))) {
    keyRiskFactors.push('Komoditas Pangan Segar Asal Hewan membutuhkan penyimpanan Rantai Dingin (Cold Chain) ketat');
  }
  if (Array.from(commoditiesSet).some((c) => c.toLowerCase().includes('biologis') || c.toLowerCase().includes('vaksin'))) {
    keyRiskFactors.push('Bahan Biologis / Vaksin wajib izin Karantina Pusat & Uji Laboratorium khusus');
  }
  if (keyRiskFactors.length === 0) {
    keyRiskFactors.push('Pemeriksaan standar kesesuaian dokumen & pemeriksaan fisik sampel');
  }

  const recommendedProtocols: string[] = [
    'Verifikasi Dokumen Karantina (Health/Phytosanitary Certificate, Surat Angkut)',
    'Pemeriksaan Fisik Segel Kontainer, Kemasan, dan Suhu Penyimpanan (Cold Storage)',
    'Pengambilan Sampel Uji Laboratorium Karantina (Uji Organoleptik, Mikrobiologi, Bebas Hama/Penyakit)',
    'Penetapan Tindakan Karantina Pembebasan / Pengeluaran (Sertifikat Pelepasan)',
  ];

  // Ordered multi-category & multi-activity arrays across the company
  const orderedCategories = (['HEWAN', 'IKAN', 'TUMBUHAN'] as QuarantineCategory[]).filter((cat) =>
    allCategoriesSet.has(cat)
  );
  const orderedTradeActivities = (
    ['IMPOR', 'EKSPOR', 'DOMESTIK MASUK', 'DOMESTIK KELUAR'] as TradeActivityType[]
  ).filter((act) => tradeActivitiesSet.has(act));

  let primaryCategory: QuarantineCategory = orderedCategories[0] || 'HEWAN';
  let topCount = -1;
  (['HEWAN', 'IKAN', 'TUMBUHAN'] as QuarantineCategory[]).forEach((cat) => {
    if (categoriesBreakdown[cat] > topCount) {
      topCount = categoriesBreakdown[cat];
      primaryCategory = cat;
    }
  });

  const canonicalName = allRecords[0].pemohon;
  const coreKey = extractCompanyCoreName(canonicalName) || canonicalName.toUpperCase();
  const contactFromMap = companyContacts
    ? companyContacts[coreKey] || companyContacts[canonicalName.toUpperCase()]
    : undefined;
  const pemilikFromRecords = allRecords.find((r) => r.pemilik && r.pemilik.trim())?.pemilik || '';
  const emailFromRecords = allRecords.find((r) => r.email && r.email.trim())?.email || '';

  return {
    name: canonicalName,
    pemilik: contactFromMap?.pemilik || pemilikFromRecords || '',
    email: contactFromMap?.email || emailFromRecords || '',
    totalDeclarations: records.length,
    categories: orderedCategories.length > 0 ? orderedCategories : [primaryCategory],
    categoriesBreakdown,
    primaryCategory,
    tradeActivities: orderedTradeActivities.length > 0 ? orderedTradeActivities : Array.from(tradeActivitiesSet),
    tradeActivitiesBreakdown,
    commodities: Array.from(commoditiesSet),
    origins: Array.from(originsSet),
    inspectionSites: Array.from(sitesSet),
    hsCodes: Array.from(hsCodesSet),
    riskLevel: overallRisk,
    riskScore: avgRiskScore,
    keyRiskFactors,
    recommendedProtocols,
  };
}

export function getCommodityProfile(
  data: MediaPembawaRecord[],
  commodityName: string,
  tradeActivityFilter?: TradeActivityType | 'ALL'
): CommodityProfile | null {
  const allRecords = data.filter(
    (item) => item.komoditas.toLowerCase() === commodityName.toLowerCase()
  );

  if (allRecords.length === 0) return null;

  // Breakdown across all activities for this commodity
  const tradeActivitiesBreakdown: Record<TradeActivityType, number> = {
    'IMPOR': 0,
    'EKSPOR': 0,
    'DOMESTIK MASUK': 0,
    'DOMESTIK KELUAR': 0,
  };
  const tradeActivitiesSet = new Set<TradeActivityType>();

  allRecords.forEach((r) => {
    const activity = (r.jenisKegiatan || 'IMPOR') as TradeActivityType;
    tradeActivitiesSet.add(activity);
    tradeActivitiesBreakdown[activity] = (tradeActivitiesBreakdown[activity] || 0) + 1;
  });

  // Filter records by selected trade activity if specified
  const records = (!tradeActivityFilter || tradeActivityFilter === 'ALL')
    ? allRecords
    : allRecords.filter((r) => (r.jenisKegiatan || 'IMPOR') === tradeActivityFilter);

  const evaluationRecords = records.length > 0 ? records : allRecords;

  // Build granular importer details
  const importerMap = new Map<string, { count: number; tradeActivities: Set<TradeActivityType>; origins: Set<string> }>();
  const originMap = new Map<string, { count: number; companies: Set<string> }>();
  const sitesSet = new Set<string>();
  const hsCodesSet = new Set<string>();

  evaluationRecords.forEach((r) => {
    const activity = (r.jenisKegiatan || 'IMPOR') as TradeActivityType;

    if (r.pemohon) {
      const imp = importerMap.get(r.pemohon) || {
        count: 0,
        tradeActivities: new Set<TradeActivityType>(),
        origins: new Set<string>(),
      };
      imp.count += 1;
      imp.tradeActivities.add(activity);
      r.asal.forEach((a) => imp.origins.add(a));
      importerMap.set(r.pemohon, imp);
    }

    r.asal.forEach((a) => {
      const orig = originMap.get(a) || { count: 0, companies: new Set<string>() };
      orig.count += 1;
      if (r.pemohon) orig.companies.add(r.pemohon);
      originMap.set(a, orig);
    });

    r.tempatPeriksa.forEach((s) => sitesSet.add(s));
    r.kodeHs.forEach((h) => hsCodesSet.add(h));
  });

  const importerDetails = Array.from(importerMap.entries()).map(([pemohon, info]) => ({
    pemohon,
    count: info.count,
    tradeActivities: Array.from(info.tradeActivities),
    origins: Array.from(info.origins),
  })).sort((a, b) => b.count - a.count);

  const originDetails = Array.from(originMap.entries()).map(([country, info]) => ({
    country,
    count: info.count,
    companies: Array.from(info.companies),
  })).sort((a, b) => b.count - a.count);

  const sample = evaluationRecords[0];
  const originsArray = originDetails.map((o) => o.country);
  const { riskLevel } = calculateAutomaticRisk(sample.kategori, sample.komoditas, originsArray);

  const requiredDocuments = [
    'Sertifikat Kesehatan / Health Certificate / Phytosanitary Certificate dari Pejabat Berwenang',
    'Surat Persetujuan Perdagangan / Rekomendasi Instansi Teknis',
    'Bill of Lading (B/L) / Airway Bill / Resi Muatan & Invoice / Packing List',
    'Surat Kuasa Pengurusan Karantina (PPJK / JPT)',
  ];

  const inspectionProcedures = [
    'Pemeriksaan Kelengkapan & Keabsahan Dokumen Karantina',
    'Pemeriksaan Fisik Media Pembawa di Tempat Pemeriksaan Karantina',
    'Pengambilan Sampel Uji Organoleptik dan Mikrobiologi di Lab Karantina',
    'Tindakan Perlakuan (Fumigasi/Desinfeksi/Vaksinasi) jika ditemukan hama berisiko',
  ];

  return {
    name: sample.komoditas,
    kategori: sample.kategori,
    totalDeclarations: records.length,
    tradeActivities: Array.from(tradeActivitiesSet),
    tradeActivitiesBreakdown,
    importers: importerDetails.map((i) => i.pemohon),
    importerDetails,
    origins: originsArray,
    originDetails,
    inspectionSites: Array.from(sitesSet),
    hsCodes: Array.from(hsCodesSet),
    riskLevel,
    requiredDocuments,
    inspectionProcedures,
  };
}


/**
 * Returns sorted list of all unique countries found in records,
 * combined with any countries defined in the priority watchlist.
 */
export function getUniqueCountryList(data: MediaPembawaRecord[]): string[] {
  const set = new Set<string>();

  // Extract from uploaded data
  data.forEach((item) => {
    if (Array.isArray(item.asal)) {
      item.asal.forEach((c) => {
        const clean = c.trim().toUpperCase();
        if (clean && clean !== '-' && clean !== 'INDONESIA') {
          set.add(clean);
        } else if (clean === 'INDONESIA') {
          // Keep Indonesia if domestic trade exists
          set.add(clean);
        }
      });
    }
    if (item.asalRaw) {
      const parts = item.asalRaw.split(/[,;\n/]+/).map((s) => s.trim().toUpperCase());
      parts.forEach((p) => {
        if (p && p.length > 1 && !p.startsWith('KP') && !p.startsWith('WIL')) {
          set.add(p);
        }
      });
    }
  });

  // Also include countries in the manual Priority Watchlist so officers can profile them immediately
  const watchlistCountries = getAllWatchlistCountries();
  watchlistCountries.forEach((w) => {
    if (w.countryName) set.add(w.countryName.trim().toUpperCase());
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Builds a comprehensive Country Profile for a given country name,
 * matching records where the country is an origin/destination.
 */
export function getCountryProfile(
  data: MediaPembawaRecord[],
  countryName: string
): CountryProfile | null {
  if (!countryName) return null;
  const upperCountry = countryName.trim().toUpperCase();

  // Find all records matching this country in asal or asalRaw
  const matchingRecords = data.filter((r) => {
    if (Array.isArray(r.asal) && r.asal.some((a) => a.trim().toUpperCase() === upperCountry)) {
      return true;
    }
    if (r.asalRaw && r.asalRaw.toUpperCase().includes(upperCountry)) {
      return true;
    }
    return false;
  });

  const companiesSet = new Set<string>();
  const commodityMap = new Map<string, { category: QuarantineCategory; count: number }>();
  const tradeActivitiesSet = new Set<TradeActivityType>();
  const tradeActivitiesBreakdown: Record<TradeActivityType, number> = {
    'IMPOR': 0,
    'EKSPOR': 0,
    'DOMESTIK MASUK': 0,
    'DOMESTIK KELUAR': 0,
  };
  const sitesSet = new Set<string>();
  const hsCodesSet = new Set<string>();

  matchingRecords.forEach((r) => {
    if (r.pemohon) companiesSet.add(r.pemohon);

    const commName = r.komoditas.trim();
    if (commName) {
      const existing = commodityMap.get(commName);
      if (existing) {
        existing.count += 1;
      } else {
        commodityMap.set(commName, {
          category: r.kategori,
          count: 1,
        });
      }
    }

    const activity = (r.jenisKegiatan || 'IMPOR') as TradeActivityType;
    tradeActivitiesSet.add(activity);
    tradeActivitiesBreakdown[activity] = (tradeActivitiesBreakdown[activity] || 0) + 1;

    r.tempatPeriksa.forEach((s) => sitesSet.add(s));
    r.kodeHs.forEach((h) => hsCodesSet.add(h));
  });

  const commodities = Array.from(commodityMap.entries()).map(([name, val]) => ({
    name,
    category: val.category,
    count: val.count,
  }));

  const watchItem = getWatchlistCountryItem(upperCountry);
  const isWatch = isCountryInWatchlist(upperCountry);

  // Derive suspect diseases based on country + commodities from uploaded data + officer watchlist
  const commodityNames = commodities.map((c) => c.name);
  const suspectDiseases = getCountryDiseaseSuspects(upperCountry, commodityNames, watchItem);

  return {
    countryName: upperCountry,
    totalDeclarations: matchingRecords.length,
    companies: Array.from(companiesSet),
    commodities,
    tradeActivities: Array.from(tradeActivitiesSet),
    tradeActivitiesBreakdown,
    suspectDiseases,
    inspectionSites: Array.from(sitesSet),
    hsCodes: Array.from(hsCodesSet),
    isWatchlist: isWatch,
    watchItem,
  };
}

