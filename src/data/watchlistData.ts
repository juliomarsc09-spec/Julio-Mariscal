import {
  PriorityCommodityWatchItem,
  PriorityCountryWatchItem,
  SuspectDiseaseInfo,
  QuarantineCategory,
  WatchPriorityLevel,
} from '../types';

const COMMODITY_WATCHLIST_KEY = 'priority_watchlist_commodities_v1';
const COUNTRY_WATCHLIST_KEY = 'priority_watchlist_countries_v1';

let commoditiesCache: PriorityCommodityWatchItem[] | null = null;
let countriesCache: PriorityCountryWatchItem[] | null = null;
let isServerHydrated = false;

export function normalizePriorityLevel(val?: string): WatchPriorityLevel {
  const s = String(val || '').toUpperCase().trim();
  if (s === 'LOW' || s === 'RENDAH') return 'LOW';
  if (s === 'MEDIUM' || s === 'SEDANG' || s === 'PENGAWASAN KHUSUS') return 'MEDIUM';
  return 'HIGH';
}

export function formatPriorityLabel(level?: string): string {
  const normalized = normalizePriorityLevel(level);
  if (normalized === 'LOW') return 'Low';
  if (normalized === 'MEDIUM') return 'Medium';
  return 'High';
}

// Initial pre-seeded priority commodities based on national biosecurity priorities
const DEFAULT_PRIORITY_COMMODITIES: PriorityCommodityWatchItem[] = [
  {
    id: 'p-comm-1',
    commodityName: 'Daging Sapi',
    category: 'HEWAN',
    reason: 'Kewaspadaan tinggi terhadap Penyakit Mulut dan Kuku (PMK) dan Lumpy Skin Disease (LSD) dari negara belum bebas.',
    regulationRef: 'SE Kepala Barantin No. 04/SE/K.1/2024 tentang Kewaspadaan PMK & LSD Impor',
    targetActions: [
      'Pemeriksaan fisik segel kontainer & sertifikat halal/veteriner',
      'Uji virologi/RT-PCR PMK jika dari negara zona berisiko',
      'Verifikasi suhu cold chain kontainer -18°C',
    ],
    officerName: 'drh. Hendra K., M.Si (Karantina Hewan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'HIGH',
  },
  {
    id: 'p-comm-2',
    commodityName: 'Jerohan Sapi',
    category: 'HEWAN',
    reason: 'Organ dalam ruminansia memiliki risiko transmisi patogen viral PMK dan mikrobiologis tinggi.',
    regulationRef: 'Permentan No. 25/2020 tentang Pemasukan Karkas dan Jeroan',
    targetActions: [
      'Pemeriksaan organoleptik mikrobiologis',
      'Uji Salmonella, E. coli dan residu antibiotik',
    ],
    officerName: 'drh. Hendra K., M.Si (Karantina Hewan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'MEDIUM',
  },
  {
    id: 'p-comm-3',
    commodityName: 'Gandum',
    category: 'TUMBUHAN',
    reason: 'Risiko kontaminasi kumbang Khapra (Trogoderma granarium) & cendawan Tilletia indica.',
    regulationRef: 'Permentan No. 25/2020 tentang Daftar Jenis OPTK Golongan I',
    targetActions: [
      'Pemeriksaan sampel bulk cargo di palka kapal',
      'Fumigasi Methyl Bromide / Phosphine jika ditemukan OPTK hidup',
    ],
    officerName: 'Ir. Sri Wahyuni, M.P. (Karantina Tumbuhan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'HIGH',
  },
  {
    id: 'p-comm-4',
    commodityName: 'Udang Vannamei',
    category: 'IKAN',
    reason: 'Pengawasan transmisi patogen HPIK Golongan I: WSSV, AHPND, dan EHP.',
    regulationRef: 'Kepmen Kelautan dan Perikanan No. 17/KEPMEN-KP/2021 tentang HPIK',
    targetActions: [
      'Uji Real-Time PCR WSSV & AHPND di Lab Penguji BBKHIT',
      'Isolasi sementara sebelum diterbitkan KI-D11',
    ],
    officerName: 'Bambang Supriyadi, S.St.Pi (Karantina Ikan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'MEDIUM',
  },
];

// Initial pre-seeded priority countries based on WOAH/FAO quarantine alerts
const DEFAULT_PRIORITY_COUNTRIES: PriorityCountryWatchItem[] = [
  {
    id: 'p-coun-1',
    countryName: 'INDIA',
    affectedCategories: ['HEWAN', 'TUMBUHAN'],
    suspectDiseases: [
      'Penyakit Mulut dan Kuku (PMK / FMD)',
      'Lumpy Skin Disease (LSD)',
      'Kumbang Khapra (Trogoderma granarium)',
      'Lalat Buah Karibia (Bactrocera zonata)',
    ],
    reason: 'Status endemis PMK & LSD pada produk ternak serta habitat utama kumbang Khapra pada serealia.',
    regulationRef: 'Surat Edaran Kepala Badan Karantina Indonesia No. 11/2023',
    quarantineMeasures: [
      'Wajib Sertifikat Bebas Hama/Penyakit Resmi Pemerintah Asal',
      'Pengujian PCR PMK dan Pemeriksaan mikroskopis larva OPTK',
      'Tindakan fumigasi wajib untuk komoditas biji-bijian/serealia',
    ],
    officerName: 'drh. Hendra K. & Ir. Sri Wahyuni',
    addedAt: new Date().toISOString(),
    priorityLevel: 'HIGH',
  },
  {
    id: 'p-coun-2',
    countryName: 'CHINA',
    affectedCategories: ['HEWAN', 'IKAN', 'TUMBUHAN'],
    suspectDiseases: [
      'African Swine Fever (ASF)',
      'Highly Pathogenic Avian Influenza (HPAI H5N1)',
      'White Spot Syndrome Virus (WSSV)',
      'Bactrocera dorsalis',
    ],
    reason: 'Laporan epidemiologi WOAH mengenai sirkulasi ASF pada babi dan HPAI pada unggas, serta hama lalat buah pada buah tropis.',
    regulationRef: 'Keputusan Kepala Badan Karantina No. 88/2023',
    quarantineMeasures: [
      'Pemeriksaan fisik 100% pada komoditas daging olahan dan buah segar',
      'Uji Real-Time RT-PCR ASF & HPAI',
      'Cold Treatment selama perjalanan laut untuk buah-buahan',
    ],
    officerName: 'Tim Gabungan Pengawasan Biosecurity BBKHIT',
    addedAt: new Date().toISOString(),
    priorityLevel: 'HIGH',
  },
  {
    id: 'p-coun-3',
    countryName: 'AUSTRALIA',
    affectedCategories: ['HEWAN', 'TUMBUHAN'],
    suspectDiseases: [
      'Bovine Spongiform Encephalopathy (BSE - Atipikal)',
      'Lalat Buah Mediterania (Ceratitis capitata)',
      'Queensland Fruit Fly (Bactrocera tryoni)',
    ],
    reason: 'Protokol ketat impor sapi bakalan, daging sapi dingin, dan buah subtropis asal belahan selatan.',
    regulationRef: 'Protokol Bilateral Karantina RI - DAFF Australia',
    quarantineMeasures: [
      'Inspeksi Premis RPH dan Instalasi Karantina Hewan Sementara (IKHS)',
      'Verifikasi perlakuan karantina dingin (In-transit Cold Treatment) pada buah',
    ],
    officerName: 'drh. Tri Atmojo, M.Sc (Karantina Hewan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'MEDIUM',
  },
  {
    id: 'p-coun-4',
    countryName: 'BRASIL',
    affectedCategories: ['HEWAN'],
    suspectDiseases: [
      'Penyakit Mulut dan Kuku (PMK)',
      'Avian Influenza (HPAI)',
      'Bovine Spongiform Encephalopathy (BSE)',
    ],
    reason: 'Pemeriksaan ketat daging sapi beku dan daging unggas beku dari zona kompartemen bebas penyakit.',
    regulationRef: 'Kepmentan No. 422/KPTS/PK.020/M/06/2023',
    quarantineMeasures: [
      'Pemeriksaan keaslian sertifikat veteriner dari MAPA Brasil',
      'Pengujian residu hormon, antibiotik, dan uji virologi',
    ],
    officerName: 'drh. Hendra K., M.Si (Karantina Hewan)',
    addedAt: new Date().toISOString(),
    priorityLevel: 'LOW',
  },
];

function normalizeCommodityItems(list: any[]): PriorityCommodityWatchItem[] {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    priorityLevel: normalizePriorityLevel(item?.priorityLevel),
  }));
}

function normalizeCountryItems(list: any[]): PriorityCountryWatchItem[] {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    priorityLevel: normalizePriorityLevel(item?.priorityLevel),
  }));
}

export function hydrateWatchlistsFromServer(
  commodities: PriorityCommodityWatchItem[],
  countries: PriorityCountryWatchItem[]
): void {
  isServerHydrated = true;
  commoditiesCache = normalizeCommodityItems(commodities);
  countriesCache = normalizeCountryItems(countries);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COMMODITY_WATCHLIST_KEY, JSON.stringify(commoditiesCache));
      localStorage.setItem(COUNTRY_WATCHLIST_KEY, JSON.stringify(countriesCache));
    } catch (e) {
      console.error('Failed to cache watchlists locally:', e);
    }
    window.dispatchEvent(new CustomEvent('watchlist_updated', { detail: { source: 'cloud' } }));
  }
}

async function persistWatchlistsToServer(
  commodities: PriorityCommodityWatchItem[],
  countries: PriorityCountryWatchItem[],
  log: {
    actionType: 'PENGAWASAN_UTAMA';
    title: string;
    description: string;
    recordsAffected: number;
    officerName: string;
  }
): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/watchlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        commodityWatchlist: commodities,
        countryWatchlist: countries,
        log,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.commodityWatchlist) && Array.isArray(data.countryWatchlist)) {
        isServerHydrated = true;
        commoditiesCache = normalizeCommodityItems(data.commodityWatchlist);
        countriesCache = normalizeCountryItems(data.countryWatchlist);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(COMMODITY_WATCHLIST_KEY, JSON.stringify(commoditiesCache));
            localStorage.setItem(COUNTRY_WATCHLIST_KEY, JSON.stringify(countriesCache));
          } catch (_) {}
          window.dispatchEvent(new CustomEvent('watchlist_updated', { detail: { source: 'cloud' } }));
        }
      }
    }
  } catch (err) {
    console.error('Failed to persist watchlists to server:', err);
  }
}

// --- Priority Commodity Watchlist Operations ---
export function getAllWatchlistCommodities(): PriorityCommodityWatchItem[] {
  if (isServerHydrated && commoditiesCache !== null) {
    return commoditiesCache;
  }
  try {
    const raw = localStorage.getItem(COMMODITY_WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = normalizeCommodityItems(parsed);
        commoditiesCache = normalized;
        return normalized;
      }
    }
  } catch (e) {
    console.error('Failed to get watchlist commodities:', e);
  }
  return DEFAULT_PRIORITY_COMMODITIES;
}

export function saveWatchlistCommodity(item: PriorityCommodityWatchItem): void {
  try {
    const normalizedItem: PriorityCommodityWatchItem = {
      ...item,
      priorityLevel: normalizePriorityLevel(item.priorityLevel),
    };
    const list = [...getAllWatchlistCommodities()];
    const existingIndex = list.findIndex(
      (w) => w.commodityName.toLowerCase() === normalizedItem.commodityName.toLowerCase()
    );
    if (existingIndex >= 0) {
      list[existingIndex] = normalizedItem;
    } else {
      list.unshift(normalizedItem);
    }
    commoditiesCache = list;
    localStorage.setItem(COMMODITY_WATCHLIST_KEY, JSON.stringify(list));
    const logEntry = {
      actionType: 'PENGAWASAN_UTAMA' as const,
      title: `Pengawasan Komoditas: ${normalizedItem.commodityName} (${formatPriorityLabel(normalizedItem.priorityLevel)})`,
      description: `Menetapkan komoditas ${normalizedItem.commodityName} [${normalizedItem.category}] pada prioritas pengawasan ${formatPriorityLabel(normalizedItem.priorityLevel)}.`,
      recordsAffected: 1,
      officerName: normalizedItem.officerName || 'Petugas BBKHIT DKI Jakarta',
    };
    window.dispatchEvent(
      new CustomEvent('watchlist_updated', {
        detail: { source: 'local', log: logEntry },
      })
    );

    void persistWatchlistsToServer(list, getAllWatchlistCountries(), logEntry);
  } catch (e) {
    console.error('Failed to save watchlist commodity:', e);
  }
}

export function removeWatchlistCommodity(commodityName: string): void {
  try {
    const list = getAllWatchlistCommodities().filter(
      (w) => w.commodityName.toLowerCase() !== commodityName.toLowerCase()
    );
    commoditiesCache = list;
    localStorage.setItem(COMMODITY_WATCHLIST_KEY, JSON.stringify(list));
    const logEntry = {
      actionType: 'PENGAWASAN_UTAMA' as const,
      title: `Hapus Pengawasan Komoditas: ${commodityName}`,
      description: `Mengeluarkan komoditas ${commodityName} dari daftar pengawasan utama BBKHIT.`,
      recordsAffected: 1,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    window.dispatchEvent(
      new CustomEvent('watchlist_updated', {
        detail: { source: 'local', log: logEntry },
      })
    );

    void persistWatchlistsToServer(list, getAllWatchlistCountries(), logEntry);
  } catch (e) {
    console.error('Failed to remove watchlist commodity:', e);
  }
}

export function isCommodityInWatchlist(commodityName: string): boolean {
  if (!commodityName) return false;
  const list = getAllWatchlistCommodities();
  return list.some(
    (w) => w.commodityName.toLowerCase() === commodityName.toLowerCase()
  );
}

export function getWatchlistCommodityItem(commodityName: string): PriorityCommodityWatchItem | undefined {
  if (!commodityName) return undefined;
  const list = getAllWatchlistCommodities();
  return list.find(
    (w) => w.commodityName.toLowerCase() === commodityName.toLowerCase()
  );
}

// --- Priority Country Watchlist Operations ---
export function getAllWatchlistCountries(): PriorityCountryWatchItem[] {
  if (isServerHydrated && countriesCache !== null) {
    return countriesCache;
  }
  try {
    const raw = localStorage.getItem(COUNTRY_WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = normalizeCountryItems(parsed);
        countriesCache = normalized;
        return normalized;
      }
    }
  } catch (e) {
    console.error('Failed to get watchlist countries:', e);
  }
  return DEFAULT_PRIORITY_COUNTRIES;
}

export function saveWatchlistCountry(item: PriorityCountryWatchItem): void {
  try {
    const normalizedItem: PriorityCountryWatchItem = {
      ...item,
      priorityLevel: normalizePriorityLevel(item.priorityLevel),
    };
    const list = [...getAllWatchlistCountries()];
    const existingIndex = list.findIndex(
      (w) => w.countryName.toLowerCase() === normalizedItem.countryName.toLowerCase()
    );
    if (existingIndex >= 0) {
      list[existingIndex] = normalizedItem;
    } else {
      list.unshift(normalizedItem);
    }
    countriesCache = list;
    localStorage.setItem(COUNTRY_WATCHLIST_KEY, JSON.stringify(list));
    const logEntry = {
      actionType: 'PENGAWASAN_UTAMA' as const,
      title: `Pengawasan Negara: ${normalizedItem.countryName} (${formatPriorityLabel(normalizedItem.priorityLevel)})`,
      description: `Menetapkan negara ${normalizedItem.countryName} pada prioritas pengawasan ${formatPriorityLabel(normalizedItem.priorityLevel)}.`,
      recordsAffected: 1,
      officerName: normalizedItem.officerName || 'Petugas BBKHIT DKI Jakarta',
    };
    window.dispatchEvent(
      new CustomEvent('watchlist_updated', {
        detail: { source: 'local', log: logEntry },
      })
    );

    void persistWatchlistsToServer(getAllWatchlistCommodities(), list, logEntry);
  } catch (e) {
    console.error('Failed to save watchlist country:', e);
  }
}

export function removeWatchlistCountry(countryName: string): void {
  try {
    const list = getAllWatchlistCountries().filter(
      (w) => w.countryName.toLowerCase() !== countryName.toLowerCase()
    );
    countriesCache = list;
    localStorage.setItem(COUNTRY_WATCHLIST_KEY, JSON.stringify(list));
    const logEntry = {
      actionType: 'PENGAWASAN_UTAMA' as const,
      title: `Hapus Pengawasan Negara: ${countryName}`,
      description: `Mengeluarkan negara ${countryName} dari daftar pengawasan utama BBKHIT.`,
      recordsAffected: 1,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    window.dispatchEvent(
      new CustomEvent('watchlist_updated', {
        detail: { source: 'local', log: logEntry },
      })
    );

    void persistWatchlistsToServer(getAllWatchlistCommodities(), list, logEntry);
  } catch (e) {
    console.error('Failed to remove watchlist country:', e);
  }
}

export function isCountryInWatchlist(countryName: string): boolean {
  if (!countryName) return false;
  const list = getAllWatchlistCountries();
  return list.some(
    (w) => w.countryName.toLowerCase() === countryName.toLowerCase()
  );
}

export function getWatchlistCountryItem(countryName: string): PriorityCountryWatchItem | undefined {
  if (!countryName) return undefined;
  const list = getAllWatchlistCountries();
  return list.find(
    (w) => w.countryName.toLowerCase() === countryName.toLowerCase()
  );
}

// --- Quarantine Epidemiology & Suspect Disease Engine ---
// Reference mapping connecting Country + Traded Commodities to suspect pests & diseases (HPHK, HPIK, OPTK)
const MASTER_DISEASE_KNOWLEDGE_BASE: Array<{
  diseaseName: string;
  scientificName: string;
  type: 'HPHK' | 'HPIK' | 'OPTK';
  countries: string[];
  commodityKeywords: string[];
  riskDescription: string;
  mandatoryLabTests: string[];
  outbreakNotice?: string;
}> = [
  // HEWAN (HPHK)
  {
    diseaseName: 'Penyakit Mulut dan Kuku (PMK)',
    scientificName: 'Foot and Mouth Disease Virus (Aphthovirus)',
    type: 'HPHK',
    countries: ['INDIA', 'BRASIL', 'VIETNAM', 'CHINA', 'THAILAND', 'MALAYSIA', 'PAKISTAN', 'ARGENTINA', 'URUGUAY'],
    commodityKeywords: ['daging', 'sapi', 'kambing', 'domba', 'jerohan', 'kulit mentah', 'susu', 'pakan', 'babi'],
    riskDescription: 'Virus sangat menular pada hewan berkuku belah (ruminansia dan babi). Menyebabkan lepuh pada mulut, moncong, dan kuku.',
    mandatoryLabTests: ['Uji RT-PCR PMK (NSP & SP)', 'Uji ELISA 3ABC', 'Pemeriksaan Organoleptik Karkas'],
    outbreakNotice: 'Status kewaspadaan biosecurity nasional (Kepmentan No. 500.1/2022)',
  },
  {
    diseaseName: 'African Swine Fever (ASF)',
    scientificName: 'African Swine Fever Virus (Asfarviridae)',
    type: 'HPHK',
    countries: ['CHINA', 'VIETNAM', 'FILIPINA', 'RUSIA', 'POLANDIA', 'JERMAN', 'ITALIA', 'THAILAND'],
    commodityKeywords: ['babi', 'daging babi', 'olahan babi', 'pakan babi', 'gelatin', 'kulit'],
    riskDescription: 'Demam hemoragik viral dengan mortalitas mendekati 100% pada babi domestik dan babi hutan.',
    mandatoryLabTests: ['Real-Time PCR ASF', 'Uji Antigen ELISA', 'Pemeriksaan Dekontaminasi Kemasan'],
    outbreakNotice: 'Larangan mutlak pemasukan produk babi dari wilayah belum bebas ASF',
  },
  {
    diseaseName: 'Flu Burung Patogenik Tinggi (HPAI)',
    scientificName: 'Highly Pathogenic Avian Influenza (H5N1, H5N6, H5N8)',
    type: 'HPHK',
    countries: ['CHINA', 'USA', 'AMERIKA SERIKAT', 'VIETNAM', 'BELANDA', 'POLANDIA', 'JEPANG', 'KOREA', 'PRANCIS'],
    commodityKeywords: ['unggas', 'ayam', 'bebek', 'bulu', 'telur', 'daging', 'daging olahan', 'pakan'],
    riskDescription: 'Penyakit viral zoonotik menyerang unggas dengan mortalitas tinggi dan potensi penularan silang ke mamalia/manusia.',
    mandatoryLabTests: ['RT-PCR Matrix & Subtipe H5/H7', 'Uji Hemaglutinasi Inhibisi (HI)'],
    outbreakNotice: 'Sertifikasi Compartmentalisation Bebas AI wajib divalidasi',
  },
  {
    diseaseName: 'Lumpy Skin Disease (LSD)',
    scientificName: 'Lumpy Skin Disease Virus (Capripoxvirus)',
    type: 'HPHK',
    countries: ['INDIA', 'THAILAND', 'MALAYSIA', 'VIETNAM', 'SINGAPURA', 'CHINA', 'MYANMAR'],
    commodityKeywords: ['sapi', 'kerbau', 'kulit mentah', 'daging', 'jerohan'],
    riskDescription: 'Penyakit cacar nodular pada sapi dan kerbau yang ditularkan oleh vektor serangga penghisap darah.',
    mandatoryLabTests: ['Real-Time PCR LSD', 'Pemeriksaan lesi nodular kulit karkas'],
  },
  {
    diseaseName: 'Bovine Spongiform Encephalopathy (BSE)',
    scientificName: 'Prion protein (PrP^Sc)',
    type: 'HPHK',
    countries: ['INGGRIS', 'UK', 'USA', 'AMERIKA SERIKAT', 'KANADA', 'SPANYOL', 'IRLANDIA', 'AUSTRALIA', 'BRASIL'],
    commodityKeywords: ['daging sapi', 'jerohan', 'tulang', 'mbm', 'meat and bone meal', 'gelatin', 'sapi'],
    riskDescription: 'Penyakit neurodegeneratif fatal menular prion pada sapi (Mad Cow Disease). Berisiko vCJD pada manusia.',
    mandatoryLabTests: ['Uji Western Blotting Prion', 'Uji Imunohistokimia (IHC)', 'Verifikasi sertifikat RPH bebas SRM'],
  },
  {
    diseaseName: 'Antraks',
    scientificName: 'Bacillus anthracis',
    type: 'HPHK',
    countries: ['INDIA', 'AFRIKA SELATAN', 'TURKI', 'RUSIA', 'PAKISTAN'],
    commodityKeywords: ['daging', 'kulit', 'tulang', 'bulu', 'sapi', 'kambing'],
    riskDescription: 'Bakteri pembentuk spora yang bertahan puluhan tahun di tanah dan produk hewan, sangat patogenik & zoonosis.',
    mandatoryLabTests: ['Pewarnaan Gram / Kapsul M\'Fadyean', 'Kultur Bakteriologis & PCR Antraks'],
  },

  // IKAN (HPIK)
  {
    diseaseName: 'White Spot Syndrome Virus (WSSV)',
    scientificName: 'Whispovirus (Nimaviridae)',
    type: 'HPIK',
    countries: ['CHINA', 'VIETNAM', 'INDIA', 'EKUADOR', 'THAILAND', 'TAIWAN', 'MALAYSIA'],
    commodityKeywords: ['udang', 'vannamei', 'windu', 'benur', 'ikan', 'pakan udang', 'kepiting'],
    riskDescription: 'HPIK Golongan I mematikan pada udang budidaya. Menimbulkan bercak putih kalsium pada karapas.',
    mandatoryLabTests: ['Two-step Nested PCR WSSV', 'Pemeriksaan histopatologi organ target'],
    outbreakNotice: 'Pengawasan ketat karantina perikanan Kepmen-KP No. 17/2021',
  },
  {
    diseaseName: 'Acute Hepatopancreatic Necrosis Disease (AHPND / EMS)',
    scientificName: 'Vibrio parahaemolyticus (pVA1 plasmid encoding PirAB)',
    type: 'HPIK',
    countries: ['VIETNAM', 'CHINA', 'THAILAND', 'MALAYSIA', 'INDIA', 'MEKSIKO'],
    commodityKeywords: ['udang', 'vannamei', 'windu', 'benur', 'pakan'],
    riskDescription: 'Sindrom mortalitas dini pada udang muda akibat toksin PirA/PirB pada hepatopankreas.',
    mandatoryLabTests: ['PCR Uji Deteksi Gen Toksin pirA/pirB', 'Isolasi Kultur Selektif TCBS'],
  },
  {
    diseaseName: 'Tilapia Lake Virus (TiLV)',
    scientificName: 'Tilapia tilapinevirus (Amnoonviridae)',
    type: 'HPIK',
    countries: ['MESIR', 'ISRAEL', 'THAILAND', 'EKUADOR', 'KOLOMBIA', 'INDIA', 'FILIPINA'],
    commodityKeywords: ['nila', 'tilapia', 'ikan nila', 'ikan air tawar', 'benih ikan'],
    riskDescription: 'Virus menyerang ikan nila dengan gejala erosi kulit, katarak mata, dan mortalitas hingga 90%.',
    mandatoryLabTests: ['Semi-nested RT-PCR TiLV', 'Pemeriksaan histopatologi hati dan otak'],
  },
  {
    diseaseName: 'Koi Herpesvirus (KHV)',
    scientificName: 'Cyprinid herpesvirus 3 (CyHV-3)',
    type: 'HPIK',
    countries: ['JEPANG', 'CHINA', 'TAIWAN', 'ISRAEL', 'JERMAN', 'BELANDA', 'USA'],
    commodityKeywords: ['ikan mas', 'koi', 'cyprinus', 'ikan hias'],
    riskDescription: 'Penyakit viral mematikan pada ikan mas dan koi dengan kerusakan nekrotik insang.',
    mandatoryLabTests: ['PCR KHV OIE Protocol', 'Pemeriksaan insang & organ dalam'],
  },
  {
    diseaseName: 'Infectious Salmon Anaemia (ISA)',
    scientificName: 'Infectious Salmon Anaemia Virus (Isavirus)',
    type: 'HPIK',
    countries: ['NORWEGIA', 'CHILI', 'KANADA', 'SKOTLANDIA', 'INGGRIS'],
    commodityKeywords: ['salmon', 'trout', 'ikan beku', 'fillet'],
    riskDescription: 'Penyakit anemia menular virus pada ikan salmon Atlantik budidaya.',
    mandatoryLabTests: ['Real-Time RT-PCR ISAV', 'Pemeriksaan patologi pembuluh darah'],
  },

  // TUMBUHAN (OPTK)
  {
    diseaseName: 'Kumbang Khapra',
    scientificName: 'Trogoderma granarium Everts',
    type: 'OPTK',
    countries: ['INDIA', 'PAKISTAN', 'MESIR', 'TURKI', 'SUDAN', 'NIGERIA', 'IRAN', 'IRAQ', 'TIMUR TENGAH'],
    commodityKeywords: ['gandum', 'beras', 'jagung', 'kedelai', 'kacang', 'serealia', 'rempah', 'biji', 'tepung'],
    riskDescription: 'OPTK Golongan A1 Kategori 1 paling destruktif pada biji-bijian simpanan di seluruh dunia.',
    mandatoryLabTests: ['Pemeriksaan mikroskopis morfologi larva setae', 'Uji DNA Barcoding COI Khapra', 'Fumigasi wajib jika terdeteksi'],
    outbreakNotice: 'Toleransi 0 (Zero Tolerance) karantina tumbuhan RI',
  },
  {
    diseaseName: 'Lalat Buah Karibia & Mediterania',
    scientificName: 'Bactrocera zonata & Ceratitis capitata',
    type: 'OPTK',
    countries: ['AUSTRALIA', 'AFRIKA SELATAN', 'MESIR', 'SPANYOL', 'CHILI', 'ARGENTINA', 'INDIA'],
    commodityKeywords: ['buah', 'apel', 'jeruk', 'anggur', 'mangga', 'pir', 'lemon', 'sayur'],
    riskDescription: 'Hama lalat buah polifag menyerang ratusan jenis komoditas buah-buahan segar hortikultura.',
    mandatoryLabTests: ['Pemeriksaan tusukan oviposisi buah (Dissecting test)', 'Pemeriksaan sertifikat Cold Treatment'],
  },
  {
    diseaseName: 'Lalat Buah Oriental',
    scientificName: 'Bactrocera dorsalis Hendel',
    type: 'OPTK',
    countries: ['CHINA', 'THAILAND', 'VIETNAM', 'TAIWAN', 'JEPANG', 'FILIPINA'],
    commodityKeywords: ['buah', 'mangga', 'jeruk', 'apel', 'sayur', 'cabai', 'tomat'],
    riskDescription: 'Larva lalat merusak pulpa buah sehingga membusuk dan gugur sebelum dipanen.',
    mandatoryLabTests: ['Inspeksi acak sampel buah di palka', 'Uji rearing larva menjadi imago'],
  },
  {
    diseaseName: 'Layu Bakteri Pisang / Moko Disease',
    scientificName: 'Ralstonia solanacearum race 2',
    type: 'OPTK',
    countries: ['FILIPINA', 'KOLOMBIA', 'EKUADOR', 'BRASIL', 'INDIA'],
    commodityKeywords: ['pisang', 'bibit', 'tanaman hias', 'umbi', 'kentang'],
    riskDescription: 'Bakteri vaskular yang memusnahkan perkebunan musaceae dan solanaceae secara masif.',
    mandatoryLabTests: ['Uji PCR Spesifik Ralstonia', 'Uji Imunostrip Agdia'],
  },
  {
    diseaseName: 'Citrus Greening / Huanglongbing (HLB)',
    scientificName: 'Candidatus Liberibacter asiaticus',
    type: 'OPTK',
    countries: ['CHINA', 'VIETNAM', 'USA', 'AMERIKA SERIKAT', 'BRASIL', 'INDIA'],
    commodityKeywords: ['jeruk', 'citrus', 'lemon', 'bibit jeruk', 'daun jeruk'],
    riskDescription: 'Bakteri floem perusak tanaman jeruk yang ditularkan oleh kutu loncat Diaphorina citri.',
    mandatoryLabTests: ['Real-Time PCR Candidatus Liberibacter', 'Pemeriksaan mikroskop fluoresensi'],
  },
  {
    diseaseName: 'Nematoda Kista Kentang Emas',
    scientificName: 'Globodera rostochiensis',
    type: 'OPTK',
    countries: ['BELANDA', 'JERMAN', 'INGGRIS', 'KANADA', 'USA', 'AUSTRALIA', 'SELANDIA BARU'],
    commodityKeywords: ['kentang', 'umbi', 'benih', 'tanah', 'media tanam'],
    riskDescription: 'Nematoda parasitik pembentuk kista yang dapat bertahan dalam tanah hingga 30 tahun.',
    mandatoryLabTests: ['Metode corong Fenwick ekstraksi kista tanah', 'Uji PCR Gen ITS Nematoda'],
  },
];

/**
 * Correlates Country Name and Traded Commodities from records with epidemiology database and manual watchlist.
 */
export function getCountryDiseaseSuspects(
  countryName: string,
  commoditiesList: string[],
  watchItem?: PriorityCountryWatchItem
): SuspectDiseaseInfo[] {
  if (!countryName) return [];
  const upperCountry = countryName.trim().toUpperCase();
  const lowerCommodities = commoditiesList.map((c) => c.toLowerCase());

  const matched: SuspectDiseaseInfo[] = [];

  // 1. First, check if officer assigned specific suspect diseases in Watchlist
  if (watchItem && Array.isArray(watchItem.suspectDiseases)) {
    watchItem.suspectDiseases.forEach((diseaseStr) => {
      matched.push({
        diseaseName: diseaseStr,
        type: watchItem.affectedCategories.includes('HEWAN')
          ? 'HPHK'
          : watchItem.affectedCategories.includes('IKAN')
          ? 'HPIK'
          : 'OPTK',
        targetCommodities: commoditiesList.slice(0, 4),
        riskDescription: `Target pengawasan khusus pejabat karantina berdasarkan ${watchItem.regulationRef || 'Instruksi Pengawasan'}. Alasan: ${watchItem.reason}`,
        mandatoryLabTests: watchItem.quarantineMeasures || ['Uji Lab Konfirmasi Karantina BBKHIT'],
        outbreakNotice: 'DITETAPKAN DALAM PENGAWASAN UTAMA OLEH PETUGAS',
      });
    });
  }

  // 2. Scan Master Knowledge Base matching Country and/or Commodities
  MASTER_DISEASE_KNOWLEDGE_BASE.forEach((dis) => {
    // Country matches
    const countryMatch = dis.countries.some((c) => upperCountry.includes(c) || c.includes(upperCountry));

    // Commodity matches
    const commodityMatches: string[] = [];
    lowerCommodities.forEach((comm) => {
      const isMatch = dis.commodityKeywords.some((kw) => comm.includes(kw));
      if (isMatch) commodityMatches.push(comm);
    });

    if (countryMatch || (commodityMatches.length > 0 && matched.length < 2)) {
      // Avoid duplicate disease name if already added by watchlist
      const exists = matched.some((m) => m.diseaseName.toLowerCase() === dis.diseaseName.toLowerCase());
      if (!exists) {
        matched.push({
          diseaseName: dis.diseaseName,
          scientificName: dis.scientificName,
          type: dis.type,
          targetCommodities: commodityMatches.length > 0 ? Array.from(new Set(commodityMatches)) : dis.commodityKeywords.slice(0, 3),
          riskDescription: dis.riskDescription,
          mandatoryLabTests: dis.mandatoryLabTests,
          outbreakNotice: dis.outbreakNotice,
        });
      }
    }
  });

  // Fallback if no specific disease mapped (e.g. general inspection)
  if (matched.length === 0) {
    matched.push({
      diseaseName: 'Patogen & Hama Karantina Umum (HPHK / HPIK / OPTK)',
      scientificName: 'Pest and Pathogen of Quarantine Concern',
      type: 'OPTK',
      targetCommodities: commoditiesList.slice(0, 3),
      riskDescription: `Pemeriksaan biosecurity standar untuk komoditas asal ${upperCountry}. Verifikasi bebas cemaran biologi, fisik, dan kimia.`,
      mandatoryLabTests: ['Uji Organoleptik & Visual', 'Pemeriksaan Cemaran Mikrobiologi'],
    });
  }

  return matched;
}
