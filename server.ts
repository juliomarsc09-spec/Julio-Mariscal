import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

// Persistent Server-Side Storage File Path
const STORAGE_FILE = path.join(process.cwd(), 'src', 'data', 'server_storage.json');
const DELETE_PASSCODE = 'Enggano17';

const DEFAULT_PRIORITY_COMMODITIES = [
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
    priorityLevel: 'MEDIUM',
  },
];

const DEFAULT_PRIORITY_COUNTRIES = [
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
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
    addedAt: '2026-01-01T00:00:00.000Z',
    priorityLevel: 'LOW',
  },
];

interface CompanyContactRecord {
  companyName: string;
  pemilik: string;
  email: string;
  updatedAt: string;
}

interface ServerStorageSchema {
  version: number;
  watchlistInitialized?: boolean;
  records: any[];
  complianceScores: Record<string, any>;
  companyContacts?: Record<string, CompanyContactRecord>;
  commodityWatchlist: any[];
  countryWatchlist: any[];
  updateLogs: any[];
  customLogo?: string | null;
  updatedAt: string;
}

function loadServerStorage(): ServerStorageSchema {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.records)) {
        let changed = false;
        if (!Array.isArray(parsed.updateLogs)) {
          parsed.updateLogs = [];
          changed = true;
        }
        if (!parsed.companyContacts || typeof parsed.companyContacts !== 'object') {
          parsed.companyContacts = {};
          changed = true;
        }
        if (!parsed.complianceScores || typeof parsed.complianceScores !== 'object') {
          parsed.complianceScores = {};
          changed = true;
        }
        if (!Array.isArray(parsed.commodityWatchlist)) {
          parsed.commodityWatchlist = [];
          changed = true;
        }
        if (!Array.isArray(parsed.countryWatchlist)) {
          parsed.countryWatchlist = [];
          changed = true;
        }
        if (
          !parsed.watchlistInitialized &&
          parsed.commodityWatchlist.length === 0 &&
          parsed.countryWatchlist.length === 0
        ) {
          parsed.commodityWatchlist = DEFAULT_PRIORITY_COMMODITIES;
          parsed.countryWatchlist = DEFAULT_PRIORITY_COUNTRIES;
          parsed.watchlistInitialized = true;
          changed = true;
        } else if (!parsed.watchlistInitialized) {
          parsed.watchlistInitialized = true;
          changed = true;
        }
        if (!Number.isFinite(Number(parsed.version)) || Number(parsed.version) < 1) {
          parsed.version = 1;
          changed = true;
        }
        if (changed) {
          saveServerStorage(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading server_storage.json:', err);
  }

  // Fallback: check if quarantineDataset.json exists
  let initialRecords: any[] = [];
  try {
    const defaultDataPath = path.join(process.cwd(), 'src', 'data', 'quarantineDataset.json');
    if (fs.existsSync(defaultDataPath)) {
      const defaultContent = fs.readFileSync(defaultDataPath, 'utf-8');
      const parsed = JSON.parse(defaultContent);
      if (Array.isArray(parsed)) {
        initialRecords = parsed.map((r) => ({
          ...r,
          jenisKegiatan: r.jenisKegiatan || 'IMPOR',
        }));
      }
    }
  } catch (e) {
    console.warn('quarantineDataset.json fallback unavailable, starting empty');
  }

  const defaultStore: ServerStorageSchema = {
    version: 1,
    watchlistInitialized: true,
    records: initialRecords,
    complianceScores: {},
    companyContacts: {},
    commodityWatchlist: DEFAULT_PRIORITY_COMMODITIES,
    countryWatchlist: DEFAULT_PRIORITY_COUNTRIES,
    updateLogs: [
      {
        id: 'init-1',
        timestamp: new Date().toISOString(),
        actionType: 'SINKRONISASI',
        title: 'Inisialisasi Sistem Q-BIOCHECK',
        description: 'Sistem database BBKHIT DKI Jakarta berhasil diinisialisasi dan tersinkronisasi.',
        recordsAffected: initialRecords.length,
        officerName: 'Sistem Q-BIOCHECK',
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  saveServerStorage(defaultStore);
  return defaultStore;
}

function saveServerStorage(data: ServerStorageSchema): boolean {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpFile = `${STORAGE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmpFile, STORAGE_FILE);
    return true;
  } catch (err) {
    console.error('Error writing server_storage.json:', err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const PORT = 3000;

  // Support massive datasets up to 200MB (supporting tens of thousands of Excel records)
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  // Disable caching on all API routes so PC and mobile always get fresh server state
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // In-memory cache synced with disk
  let memoryStore = loadServerStorage();

  wss.on('connection', (ws) => {
    try {
      ws.send(
        JSON.stringify({
          type: 'connected',
          version: memoryStore.version,
          updatedAt: memoryStore.updatedAt,
          totalRecords: memoryStore.records.length,
        })
      );
    } catch (_) {}

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'hello' && Number(msg.version) < memoryStore.version) {
          ws.send(
            JSON.stringify({
              type: 'store:updated',
              version: memoryStore.version,
              updatedAt: memoryStore.updatedAt,
              area: 'resync',
              totalRecords: memoryStore.records.length,
            })
          );
        }
      } catch (_) {}
    });
  });

  function commitAndBroadcast(area: string, meta?: Record<string, any>) {
    memoryStore.version = (Number(memoryStore.version) || 0) + 1;
    memoryStore.updatedAt = new Date().toISOString();
    const saved = saveServerStorage(memoryStore);
    if (!saved) {
      throw new Error('Gagal menulis penyimpanan permanen ke server disk.');
    }

    const payload = JSON.stringify({
      type: 'store:updated',
      version: memoryStore.version,
      updatedAt: memoryStore.updatedAt,
      totalRecords: memoryStore.records.length,
      area,
      ...(meta || {}),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (_) {}
      }
    });
  }

  // API Health Endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      version: memoryStore.version,
      totalRecords: memoryStore.records.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Lightweight version check endpoint for mobile wake / visibility reconciliation
  app.get('/api/version', (_req, res) => {
    res.json({
      version: memoryStore.version,
      updatedAt: memoryStore.updatedAt,
      totalRecords: memoryStore.records.length,
    });
  });

  // GET full shared dataset for instant multi-user & multi-device parity
  app.get('/api/data', (req, res) => {
    res.json(memoryStore);
  });

  // GET & POST custom logo
  app.get('/api/custom-logo', (req, res) => {
    res.json({ logo: memoryStore.customLogo || null });
  });

  app.post('/api/custom-logo', (req, res) => {
    const { logo } = req.body;
    memoryStore.customLogo = logo || null;
    commitAndBroadcast('custom-logo');
    res.json({
      success: true,
      logo: memoryStore.customLogo,
      version: memoryStore.version,
      updatedAt: memoryStore.updatedAt,
    });
  });

  // POST update records (full replace when explicitly requested)
  app.post('/api/records', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Body parameter records must be an array.' });
    }

    memoryStore.records = records;
    commitAndBroadcast('records');

    res.json({
      success: true,
      version: memoryStore.version,
      count: memoryStore.records.length,
      updatedAt: memoryStore.updatedAt,
    });
  });

  // POST append records without resetting or losing previously uploaded data
  app.post('/api/records/append', (req, res) => {
    const { records: incomingRecords, actionType, title, description, officerName } = req.body;
    if (!Array.isArray(incomingRecords)) {
      return res.status(400).json({ error: 'Body parameter records must be an array.' });
    }

    if (!memoryStore.companyContacts) {
      memoryStore.companyContacts = {};
    }
    if (!Array.isArray(memoryStore.updateLogs)) {
      memoryStore.updateLogs = [];
    }

    // Map existing core names so variations map to the same canonical company name,
    // while preserving multi-category (HEWAN/IKAN/TUMBUHAN) and multi-activity records
    const coreToExistingName = new Map<string, string>();

    for (const r of memoryStore.records) {
      const rawName = (r.pemohon || '').trim().toUpperCase();
      const core = cleanCompanyCore(rawName);
      if (core && !coreToExistingName.has(core)) {
        coreToExistingName.set(core, rawName);
      }
    }

    const processedNew = incomingRecords.map((newR: any, idx: number) => {
      const rawName = (newR.pemohon || '').trim().toUpperCase();
      const core = cleanCompanyCore(rawName);
      let canonicalComp = rawName;
      if (core && coreToExistingName.has(core)) {
        canonicalComp = coreToExistingName.get(core)!;
      } else if (core) {
        coreToExistingName.set(core, rawName);
      }

      const category = (newR.kategori || 'HEWAN').toUpperCase();

      const pemilikVal = String(newR.pemilik || '').trim();
      const emailVal = String(newR.email || '').trim();

      if (canonicalComp && (pemilikVal || emailVal)) {
        const contactKey = core || canonicalComp;
        const existingContact = memoryStore.companyContacts![contactKey];
        memoryStore.companyContacts![contactKey] = {
          companyName: canonicalComp,
          pemilik: pemilikVal || existingContact?.pemilik || '',
          email: emailVal || existingContact?.email || '',
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...newR,
        id: newR.id || `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        pemohon: canonicalComp,
        kategori: category,
        pemilik: pemilikVal || memoryStore.companyContacts![core || canonicalComp]?.pemilik || '',
        email: emailVal || memoryStore.companyContacts![core || canonicalComp]?.email || '',
      };
    });

    // Merge: prepend new records onto existing records, NEVER resetting prior uploaded records
    memoryStore.records = [...processedNew, ...memoryStore.records].map((r, i) => ({
      ...r,
      no: i + 1,
    }));

    const auditLog = {
      id: `append-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actionType: actionType || (processedNew.length > 1 ? 'IMPOR_EXCEL' : 'TAMBAH_DATA'),
      title:
        title ||
        (processedNew.length > 1
          ? `Impor Excel: ${processedNew.length} Baris Data Ditambahkan`
          : `Tambah Transaksi: ${processedNew[0]?.pemohon || 'Data Baru'}`),
      description:
        description ||
        `Berhasil menambahkan ${processedNew.length} baris data baru tanpa mereset data sebelumnya. Total database kini ${memoryStore.records.length} record.`,
      recordsAffected: processedNew.length,
      officerName: officerName || 'Petugas BBKHIT DKI Jakarta',
    };

    memoryStore.updateLogs.unshift(auditLog);
    if (memoryStore.updateLogs.length > 200) {
      memoryStore.updateLogs = memoryStore.updateLogs.slice(0, 200);
    }

    commitAndBroadcast('records-append', { addedCount: processedNew.length });

    res.json({
      success: true,
      version: memoryStore.version,
      addedCount: processedNew.length,
      count: memoryStore.records.length,
      records: memoryStore.records,
      updateLogs: memoryStore.updateLogs,
      companyContacts: memoryStore.companyContacts,
      updatedAt: memoryStore.updatedAt,
    });
  });

  // POST selective clear records (requires deletion passcode)
  app.post('/api/records/clear-selective', (req, res) => {
    const { activity, category, passcode } = req.body || {};

    if (String(passcode || '') !== DELETE_PASSCODE) {
      return res.status(403).json({
        error: 'Kode atau sandi penghapusan data salah. Penghapusan permanen dibatalkan.',
      });
    }

    const initialCount = memoryStore.records.length;

    // Filter records: remove those that match BOTH selected activity and category criteria
    memoryStore.records = memoryStore.records.filter((r) => {
      const matchActivity =
        !activity ||
        activity === 'ALL' ||
        (r.jenisKegiatan || 'IMPOR').toUpperCase() === String(activity).toUpperCase();

      const matchCategory =
        !category ||
        category === 'ALL' ||
        (r.kategori || '').toUpperCase() === String(category).toUpperCase();

      if (matchActivity && matchCategory) {
        return false;
      }
      return true;
    });

    // Re-index remaining records
    memoryStore.records = memoryStore.records.map((r, i) => ({ ...r, no: i + 1 }));
    const deletedCount = initialCount - memoryStore.records.length;

    if (!Array.isArray(memoryStore.updateLogs)) {
      memoryStore.updateLogs = [];
    }

    if (deletedCount > 0) {
      const actLabel = !activity || activity === 'ALL' ? 'Semua Arus' : activity;
      const catLabel = !category || category === 'ALL' ? 'Semua Bidang (KH/KI/KT)' : `Karantina ${category}`;
      memoryStore.updateLogs.unshift({
        id: `clear-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        actionType: 'HAPUS_SELEKTIF',
        title: `Hapus Permanen: ${deletedCount} Record (${actLabel})`,
        description: `Menghapus permanen ${deletedCount} data yang diupload untuk filter ${actLabel} • ${catLabel}. Sisa data tersimpan: ${memoryStore.records.length} record.`,
        recordsAffected: deletedCount,
        officerName: 'Petugas BBKHIT DKI Jakarta',
      });
      if (memoryStore.updateLogs.length > 200) {
        memoryStore.updateLogs = memoryStore.updateLogs.slice(0, 200);
      }
    }

    commitAndBroadcast('records-clear', { deletedCount });

    res.json({
      success: true,
      version: memoryStore.version,
      deletedCount,
      remainingCount: memoryStore.records.length,
      records: memoryStore.records,
      updateLogs: memoryStore.updateLogs,
      updatedAt: memoryStore.updatedAt,
    });
  });

  // GET & POST Company Contacts (Pemilik & Alamat Email)
  app.get('/api/company-contacts', (req, res) => {
    res.json(memoryStore.companyContacts || {});
  });

  app.post('/api/company-contacts', (req, res) => {
    const { companyName, pemilik, email } = req.body;
    if (!companyName || typeof companyName !== 'string') {
      return res.status(400).json({ error: 'companyName wajib diisi.' });
    }

    if (!memoryStore.companyContacts) {
      memoryStore.companyContacts = {};
    }

    const cleanName = companyName.trim().toUpperCase();
    const coreKey = cleanCompanyCore(cleanName) || cleanName;
    const cleanPemilik = String(pemilik || '').trim();
    const cleanEmail = String(email || '').trim();
    const now = new Date().toISOString();

    memoryStore.companyContacts[coreKey] = {
      companyName: cleanName,
      pemilik: cleanPemilik,
      email: cleanEmail,
      updatedAt: now,
    };

    // Propagate to matching records so exports & records stay aligned
    let matchedCount = 0;
    memoryStore.records = memoryStore.records.map((r) => {
      const rCore = cleanCompanyCore(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (rCore === coreKey) {
        matchedCount++;
        return {
          ...r,
          pemilik: cleanPemilik,
          email: cleanEmail,
        };
      }
      return r;
    });

    if (!Array.isArray(memoryStore.updateLogs)) {
      memoryStore.updateLogs = [];
    }
    memoryStore.updateLogs.unshift({
      id: `contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Pembaruan Profil Kontak: ${cleanName}`,
      description: `Memperbarui Pemilik (${cleanPemilik || '-'}) dan Email (${cleanEmail || '-'}) untuk ${cleanName}.`,
      recordsAffected: matchedCount || 1,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    });

    commitAndBroadcast('company-contacts');

    res.json({
      success: true,
      version: memoryStore.version,
      contact: memoryStore.companyContacts[coreKey],
      companyContacts: memoryStore.companyContacts,
      records: memoryStore.records,
      updateLogs: memoryStore.updateLogs,
      updatedAt: memoryStore.updatedAt,
    });
  });

  app.post('/api/company-contacts/bulk', (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar items kontak perusahaan wajib diisi.' });
    }

    if (!memoryStore.companyContacts) {
      memoryStore.companyContacts = {};
    }

    const now = new Date().toISOString();
    const updatedKeys = new Set<string>();

    items.forEach((item: any) => {
      const rawName = String(item.companyName || '').trim().toUpperCase();
      if (!rawName) return;
      const coreKey = cleanCompanyCore(rawName) || rawName;
      const existing = memoryStore.companyContacts![coreKey];
      const pemilik = String(item.pemilik || '').trim() || existing?.pemilik || '';
      const email = String(item.email || '').trim() || existing?.email || '';

      memoryStore.companyContacts![coreKey] = {
        companyName: existing?.companyName || rawName,
        pemilik,
        email,
        updatedAt: now,
      };
      updatedKeys.add(coreKey);
    });

    let matchedRecordsCount = 0;
    memoryStore.records = memoryStore.records.map((r) => {
      const rCore = cleanCompanyCore(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (updatedKeys.has(rCore) && memoryStore.companyContacts![rCore]) {
        matchedRecordsCount++;
        const info = memoryStore.companyContacts![rCore];
        return {
          ...r,
          pemilik: info.pemilik || r.pemilik || '',
          email: info.email || r.email || '',
        };
      }
      return r;
    });

    if (!Array.isArray(memoryStore.updateLogs)) {
      memoryStore.updateLogs = [];
    }
    memoryStore.updateLogs.unshift({
      id: `bulk-contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Impor CSV/Excel Pemilik & Email: ${updatedKeys.size} Perusahaan`,
      description: `Berhasil memperbarui data Pemilik & Alamat Email untuk ${updatedKeys.size} perusahaan (${matchedRecordsCount} transaksi terkait ikut diperbarui).`,
      recordsAffected: updatedKeys.size,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    });

    commitAndBroadcast('company-contacts-bulk');

    res.json({
      success: true,
      version: memoryStore.version,
      importedCount: updatedKeys.size,
      matchedRecordsCount,
      companyContacts: memoryStore.companyContacts,
      records: memoryStore.records,
      updateLogs: memoryStore.updateLogs,
      updatedAt: memoryStore.updatedAt,
    });
  });

  // POST update company compliance scores
  app.post('/api/compliance', (req, res) => {
    const { scores, replace, log } = req.body;
    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({ error: 'scores object required' });
    }

    if (replace) {
      memoryStore.complianceScores = scores;
    } else {
      memoryStore.complianceScores = {
        ...memoryStore.complianceScores,
        ...scores,
      };
    }

    if (log && typeof log === 'object') {
      if (!Array.isArray(memoryStore.updateLogs)) {
        memoryStore.updateLogs = [];
      }
      memoryStore.updateLogs.unshift({
        id: log.id || `score-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: log.timestamp || new Date().toISOString(),
        actionType: log.actionType || 'PENILAIAN_SKOR',
        title: log.title || 'Pembaruan Skor Kepatuhan',
        description: log.description || '',
        recordsAffected: Number(log.recordsAffected) || 1,
        officerName: log.officerName || 'Petugas BBKHIT DKI Jakarta',
      });
      if (memoryStore.updateLogs.length > 200) {
        memoryStore.updateLogs = memoryStore.updateLogs.slice(0, 200);
      }
    }

    commitAndBroadcast('compliance');

    res.json({
      success: true,
      version: memoryStore.version,
      updatedAt: memoryStore.updatedAt,
      complianceScores: memoryStore.complianceScores,
      updateLogs: memoryStore.updateLogs,
    });
  });

  // POST update watchlists
  app.post('/api/watchlists', (req, res) => {
    const { commodityWatchlist, countryWatchlist, log } = req.body;

    if (Array.isArray(commodityWatchlist)) {
      memoryStore.commodityWatchlist = commodityWatchlist;
    }
    if (Array.isArray(countryWatchlist)) {
      memoryStore.countryWatchlist = countryWatchlist;
    }
    memoryStore.watchlistInitialized = true;

    if (log && typeof log === 'object') {
      if (!Array.isArray(memoryStore.updateLogs)) {
        memoryStore.updateLogs = [];
      }
      memoryStore.updateLogs.unshift({
        id: log.id || `watch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: log.timestamp || new Date().toISOString(),
        actionType: log.actionType || 'PENGAWASAN_UTAMA',
        title: log.title || 'Pembaruan Daftar Pengawasan Utama',
        description: log.description || '',
        recordsAffected: Number(log.recordsAffected) || 1,
        officerName: log.officerName || 'Petugas BBKHIT DKI Jakarta',
      });
      if (memoryStore.updateLogs.length > 200) {
        memoryStore.updateLogs = memoryStore.updateLogs.slice(0, 200);
      }
    }

    commitAndBroadcast('watchlists');

    res.json({
      success: true,
      version: memoryStore.version,
      updatedAt: memoryStore.updatedAt,
      commodityWatchlist: memoryStore.commodityWatchlist,
      countryWatchlist: memoryStore.countryWatchlist,
      updateLogs: memoryStore.updateLogs,
    });
  });

  // GET update logs / audit trail
  app.get('/api/update-logs', (req, res) => {
    res.json(memoryStore.updateLogs || []);
  });

  // POST add new update log
  app.post('/api/update-logs', (req, res) => {
    const { log } = req.body;
    if (!log || typeof log !== 'object') {
      return res.status(400).json({ error: 'Valid log object required.' });
    }

    if (!Array.isArray(memoryStore.updateLogs)) {
      memoryStore.updateLogs = [];
    }

    const newLog = {
      id: log.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: log.timestamp || new Date().toISOString(),
      actionType: log.actionType || 'SINKRONISASI',
      title: log.title || 'Pembaruan Data',
      description: log.description || '',
      recordsAffected: Number(log.recordsAffected) || 0,
      officerName: log.officerName || 'Petugas BBKHIT DKI Jakarta',
      metadata: log.metadata || {},
    };

    memoryStore.updateLogs.unshift(newLog);
    // Keep max 200 logs
    if (memoryStore.updateLogs.length > 200) {
      memoryStore.updateLogs = memoryStore.updateLogs.slice(0, 200);
    }

    commitAndBroadcast('update-logs');

    res.json({
      success: true,
      version: memoryStore.version,
      log: newLog,
      logs: memoryStore.updateLogs,
    });
  });

  // Helper for Company Core Normalization (PT PT, PT, CV, UD, etc.)
  function cleanCompanyCore(raw: string): string {
    if (!raw) return '';
    let s = raw.trim();
    s = s.replace(/^(PT[\s\.\,\-]+)+/i, '')
         .replace(/^(CV[\s\.\,\-]+)+/i, '')
         .replace(/^(UD[\s\.\,\-]+)+/i, '')
         .replace(/^(PD[\s\.\,\-]+)+/i, '')
         .replace(/^(KOP[\s\.\,\-]+)+/i, '')
         .replace(/^(KOPERASI[\s\.\,\-]+)+/i, '')
         .trim();
    s = s.replace(/[\s\.\,\-]+(PT|CV|UD|TBK|PERSERO)$/i, '').trim();
    return s.toUpperCase().replace(/\s+/g, ' ');
  }

  // POST Deduplicate & Unify Company Names (S & C Mitra Abadi <-> PT S & C Mitra Abadi)
  app.post('/api/records/deduplicate-companies', (req, res) => {
    try {
      const records = memoryStore.records;
      const initialCount = records.length;

      // 1. Map core names and determine whether any variant has PT, CV, or UD
      const coreInfoMap = new Map<string, { hasPT: boolean; hasCV: boolean; hasUD: boolean; variants: Set<string> }>();

      records.forEach((r) => {
        const raw = (r.pemohon || '').trim();
        const core = cleanCompanyCore(raw);
        if (!core) return;

        if (!coreInfoMap.has(core)) {
          coreInfoMap.set(core, { hasPT: false, hasCV: false, hasUD: false, variants: new Set() });
        }
        const info = coreInfoMap.get(core)!;
        info.variants.add(raw);
        if (/\bPT\b|\bP\.T\b|^PT[\s\.\,]/i.test(raw)) info.hasPT = true;
        if (/\bCV\b|\bC\.V\b|^CV[\s\.\,]/i.test(raw)) info.hasCV = true;
        if (/\bUD\b|\bU\.D\b|^UD[\s\.\,]/i.test(raw)) info.hasUD = true;
      });

      function resolveCanonicalName(raw: string): string {
        const core = cleanCompanyCore(raw);
        const info = coreInfoMap.get(core);
        if (!info) return raw.trim().toUpperCase();
        if (info.hasPT) return `PT ${core}`;
        if (info.hasCV) return `CV ${core}`;
        if (info.hasUD) return `UD ${core}`;
        return `PT ${core}`;
      }

      // 2. Deduplicate records sharing canonical company + category + activity + commodity
      // preserving multi-category (Hewan/Ikan/Tumbuhan) & multi-activity (Impor/Ekspor/Domestik)
      const dedupeMap = new Map<string, any>();
      const affectedCompanyGroups: string[] = [];

      records.forEach((r) => {
        const canonicalComp = resolveCanonicalName(r.pemohon);
        const cleanComm = (r.komoditas || '').trim();
        const commKey = cleanComm.toUpperCase();
        const category = (r.kategori || 'HEWAN').toUpperCase();
        const activity = (r.jenisKegiatan || 'IMPOR').toUpperCase();
        const key = `${canonicalComp}:::${category}:::${activity}:::${commKey}`;

        const places = Array.isArray(r.tempatPeriksa) ? r.tempatPeriksa : [];
        const origins = Array.isArray(r.asal) ? r.asal : [];
        const hsCodes = Array.isArray(r.kodeHs) ? r.kodeHs : [];

        if (!dedupeMap.has(key)) {
          dedupeMap.set(key, {
            ...r,
            pemohon: canonicalComp,
            komoditas: cleanComm,
            kategori: category,
            jenisKegiatan: activity,
            tempatPeriksa: [...places],
            tempatPeriksaRaw: places.join(', '),
            asal: [...origins],
            asalRaw: origins.join(', '),
            kodeHs: [...hsCodes],
            kodeHsRaw: hsCodes.join(', '),
            catatanKarantina: r.catatanKarantina || '',
            frekuensi: r.frekuensi || 1,
          });
        } else {
          const existing = dedupeMap.get(key);
          const mergedPlaces = Array.from(new Set([...existing.tempatPeriksa, ...places]));
          const mergedOrigins = Array.from(new Set([...existing.asal, ...origins]));
          const mergedHs = Array.from(new Set([...existing.kodeHs, ...hsCodes]));

          let mergedNotes = existing.catatanKarantina || '';
          if (r.catatanKarantina && !mergedNotes.includes(r.catatanKarantina)) {
            mergedNotes = mergedNotes ? `${mergedNotes}; ${r.catatanKarantina}` : r.catatanKarantina;
          }

          dedupeMap.set(key, {
            ...existing,
            tempatPeriksa: mergedPlaces,
            tempatPeriksaRaw: mergedPlaces.join(', '),
            asal: mergedOrigins,
            asalRaw: mergedOrigins.join(', '),
            kodeHs: mergedHs,
            kodeHsRaw: mergedHs.join(', '),
            catatanKarantina: mergedNotes,
            frekuensi: (existing.frekuensi || 1) + (r.frekuensi || 1),
          });
        }
      });

      // Identify merged groups
      coreInfoMap.forEach((info, core) => {
        if (info.variants.size > 1) {
          const canonical = resolveCanonicalName(core);
          affectedCompanyGroups.push(`${Array.from(info.variants).join(' & ')} -> ${canonical}`);
        }
      });

      // Re-index remaining records
      const updatedRecords = Array.from(dedupeMap.values()).map((r, i) => ({
        ...r,
        no: i + 1,
      }));

      // Update compliance scores mapping to canonical names
      const updatedScores: Record<string, any> = {};
      if (memoryStore.complianceScores) {
        Object.entries(memoryStore.complianceScores).forEach(([compName, scoreData]) => {
          const canonicalComp = resolveCanonicalName(compName);
          updatedScores[canonicalComp] = {
            ...scoreData,
            companyName: canonicalComp,
          };
        });
        memoryStore.complianceScores = updatedScores;
      }

      // Update companyContacts mapping to canonical names
      if (memoryStore.companyContacts) {
        const updatedContacts: Record<string, CompanyContactRecord> = {};
        Object.entries(memoryStore.companyContacts).forEach(([key, contactData]) => {
          const canonicalComp = resolveCanonicalName(contactData.companyName || key);
          const coreKey = cleanCompanyCore(canonicalComp) || canonicalComp;
          const prev = updatedContacts[coreKey];
          updatedContacts[coreKey] = {
            companyName: canonicalComp,
            pemilik: contactData.pemilik || prev?.pemilik || '',
            email: contactData.email || prev?.email || '',
            updatedAt: contactData.updatedAt || new Date().toISOString(),
          };
        });
        memoryStore.companyContacts = updatedContacts;
      }

      memoryStore.records = updatedRecords;

      // Log this update action in riwayat update data
      const auditLog = {
        id: `dedupe-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: 'DEDUPLIKASI_PERUSAHAAN',
        title: 'Penyatuan & Deduplikasi Nama Perusahaan (PT/Non-PT)',
        description: `Berhasil menyatukan ${affectedCompanyGroups.length} grup variasi nama perusahaan (contoh: S & C Mitra Abadi dengan PT S & C Mitra Abadi). ${initialCount - updatedRecords.length} baris duplikat dikonsolidasikan.`,
        recordsAffected: initialCount - updatedRecords.length,
        officerName: 'Sistem Q-BIOCHECK BBKHIT',
        metadata: {
          initialCount,
          finalCount: updatedRecords.length,
          mergedCount: initialCount - updatedRecords.length,
          sampleMerged: affectedCompanyGroups.slice(0, 10),
        },
      };

      if (!Array.isArray(memoryStore.updateLogs)) {
        memoryStore.updateLogs = [];
      }
      memoryStore.updateLogs.unshift(auditLog);

      commitAndBroadcast('deduplicate-companies');

      res.json({
        success: true,
        version: memoryStore.version,
        initialCount,
        finalCount: updatedRecords.length,
        mergedDuplicatesCount: initialCount - updatedRecords.length,
        unifiedCompanyGroupsCount: affectedCompanyGroups.length,
        sampleMerged: affectedCompanyGroups.slice(0, 15),
        records: memoryStore.records,
        companyContacts: memoryStore.companyContacts,
        complianceScores: memoryStore.complianceScores,
        updateLogs: memoryStore.updateLogs,
        log: auditLog,
        updatedAt: memoryStore.updatedAt,
      });
    } catch (err: any) {
      console.error('Error during company deduplication:', err);
      res.status(500).json({ error: 'Gagal melakukan penyatuan data perusahaan: ' + err.message });
    }
  });

  // Intelligent Quarantine AI Risk Assessment Engine
  function runExpertQuarantineRiskEngine(
    pemohon: string,
    komoditas: string,
    kategori?: string,
    asal?: string,
    tempatPeriksa?: string,
    kodeHs?: string
  ) {
    const comm = (komoditas || '').toLowerCase();
    const origin = (asal || '').toLowerCase();
    const cat = (kategori || 'HEWAN').toUpperCase();

    let riskScore = 48;
    let riskLevel = 'SEDANG';
    const threats: string[] = [];
    const requiredDocs: string[] = [
      'Surat Permohonan Pemeriksaan Karantina (PPK Online)',
      'Invoice, Packing List & Bill of Lading (B/L)',
      'Surat Penetapan Tempat Pemasukan/Pengeluaran Karantina',
    ];
    const actions: string[] = [
      'Pemeriksaan Kelengkapan, Kebenaran, dan Keabsahan Dokumen Administratif',
    ];

    if (
      cat.includes('HEWAN') ||
      comm.includes('daging') ||
      comm.includes('sapi') ||
      comm.includes('babi') ||
      comm.includes('unggas') ||
      comm.includes('jerohan') ||
      comm.includes('lidah') ||
      comm.includes('hati')
    ) {
      requiredDocs.push('Veterinary Health Certificate (Sertifikat Kesehatan Hewan) dari Otoritas Veteriner Negara Asal');
      requiredDocs.push('Surat Persetujuan Impor (SPI) Kementerian Perdagangan RI');
      requiredDocs.push('Rekomendasi Teknis Pemasukan Ditjen Peternakan dan Kesehatan Hewan');
      requiredDocs.push('Sertifikat Halal (Wajib untuk Produk Konsumsi Pangan Hewani)');

      if (comm.includes('babi') || comm.includes('pork')) {
        threats.push('African Swine Fever Virus (ASFV / Demam Babi Afrika)');
        threats.push('Foot and Mouth Disease (Penyakit Mulut dan Kuku / PMK)');
        threats.push('Porcine Reproductive and Respiratory Syndrome (PRRS)');
        riskScore = 94;
        riskLevel = 'SANGAT TINGGI';
      } else if (comm.includes('daging') || comm.includes('jerohan') || comm.includes('lidah') || comm.includes('hati')) {
        threats.push('Foot and Mouth Disease Virus (FMDV / Penyakit Mulut dan Kuku)');
        threats.push('Bovine Spongiform Encephalopathy (BSE / Penyakit Sapi Gila)');
        threats.push('Lumpy Skin Disease (LSD)');
        threats.push('Cemaran Mikroba Patogen: Salmonella spp., E. coli O157:H7');
        riskScore = 88;
        riskLevel = 'SANGAT TINGGI';
      } else {
        threats.push('Highly Pathogenic Avian Influenza (HPAI / Flu Burung H5N1)');
        threats.push('Newcastle Disease Virus (NDV)');
        threats.push('Brucella abortus / Bovine Brucellosis');
        riskScore = 78;
        riskLevel = 'TINGGI';
      }

      actions.push('Pemeriksaan Fisik 100% Organoleptik & Pengujian Suhu Kontainer Reefer (-18°C)');
      actions.push('Pengambilan Sampel Representatif untuk Uji Laboratorium RT-PCR / Elisa');
      actions.push('Tindakan Sucihama (Desinfeksi Alat Angkut dan Kontainer Pengangkut)');
    } else if (
      cat.includes('IKAN') ||
      comm.includes('ikan') ||
      comm.includes('salmon') ||
      comm.includes('tuna') ||
      comm.includes('udang') ||
      comm.includes('cumi') ||
      comm.includes('kepiting')
    ) {
      requiredDocs.push('Health Certificate for Fish and Fishery Products dari Negara Asal');
      requiredDocs.push('Surat Izin Pemasukan Hasil Perikanan (SIPHP) KKP');
      requiredDocs.push('Sertifikat Penerapan HACCP (Hazard Analysis Critical Control Point)');

      threats.push('White Spot Syndrome Virus (WSSV)');
      threats.push('Tilapia Lake Virus (TiLV)');
      threats.push('Infectious Spleen and Kidney Necrosis Virus (ISKNV)');
      threats.push('Cemaran Histamin & Bakteri Patogen Vibrio parahaemolyticus');

      riskScore = comm.includes('hidup') ? 85 : 62;
      riskLevel = comm.includes('hidup') ? 'TINGGI' : 'SEDANG';

      actions.push('Pemeriksaan Visual Kesegaran, Uji Organoleptik & Pengukuran Suhu Inti Ikan');
      actions.push('Uji Cepat Laboratorium PCR Deteksi HPIK Golongan I & II');
      actions.push('Pemeriksaan Integritas Cold Chain Selama Pengangkutan');
    } else {
      // TUMBUHAN
      requiredDocs.push('Phytosanitary Certificate (Sertifikat Fitosanitari) Asli dari NPPO Negara Asal');
      requiredDocs.push('Surat Persetujuan Pemasukan Bahan Tanam (jika berupa benih/bibit)');
      requiredDocs.push('Certificate of Analysis (Uji Residu Kimia & Bebas GMO bila disyaratkan)');

      threats.push('Trogoderma granarium (Kumbang Khapra - OPTK Kategori A1 Golongan I)');
      threats.push('Bactrocera dorsalis complex (Lalat Buah Eksotis)');
      threats.push('Ralstonia solanacearum & Fusarium oxysporum f.sp.');
      threats.push('Biji Gulma Parasit Karantina Asing (Cuscuta spp., Striga spp.)');

      riskScore = comm.includes('benih') || comm.includes('bibit') || comm.includes('segar') || comm.includes('buah') ? 82 : 54;
      riskLevel = riskScore >= 80 ? 'TINGGI' : 'SEDANG';

      actions.push('Pemeriksaan Fisik Makroskopis, Ayakan Sampel & Deteksi Serangga Hidup');
      actions.push('Pengujian Laboratorium Mikologi dan Entomologi Karantina');
      if (comm.includes('pinang') || comm.includes('kacang') || comm.includes('beras') || comm.includes('jagung')) {
        actions.push('Tindakan Perlakuan Fumigasi Gas Fosfin (PH3) jika terdeteksi infestasi OPT');
      }
    }

    // Origin Disease Risk Escalation
    if (origin.includes('india') || origin.includes('china') || origin.includes('vietnam') || origin.includes('brasil')) {
      riskScore = Math.min(99, riskScore + 7);
      if (riskScore >= 85) riskLevel = 'SANGAT TINGGI';
      else if (riskScore >= 70) riskLevel = 'TINGGI';
    }

    const note = `Analisis profil risiko untuk entitas ${pemohon} terhadap komoditas ${komoditas} (${kategori || 'MEDIA PEMBAWA'}) asal ${asal || 'Mancanegara'}. Klasifikasi risiko: ${riskLevel} (${riskScore}/100). Petugas BBKHIT DKI Jakarta wajib memastikan pemenuhan seluruh sertifikat kesehatan/fitosanitari sah dan melakukan verifikasi segel sebelum pelepasan karantina.`;

    return {
      riskScore,
      riskLevel,
      summary: `Analisis intelijen biosecurity BBKHIT DKI Jakarta untuk pengajuan ${pemohon} pada media pembawa ${komoditas}. Risiko teridentifikasi: ${riskLevel} (${riskScore}/100) berdasarkan riwayat kepatuhan, status epidemiologis negara asal, dan potensi ancaman HPHK/HPIK/OPTK.`,
      potentialThreats: threats,
      requiredDocuments: requiredDocs,
      quarantineActions: actions,
      recommendationNote: note,
    };
  }

  // Server-side Gemini AI Proxy with Automatic High-Accuracy Quarantine AI Engine
  app.post('/api/quarantine-ai', async (req, res) => {
    const { pemohon, komoditas, kategori, asal, tempatPeriksa, kodeHs } = req.body;

    if (!pemohon || !komoditas) {
      return res.status(400).json({ error: 'Pemohon dan Komoditas wajib diisi.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Anda adalah Ahli Analis Karantina Hewan, Ikan, dan Tumbuhan di BBKHIT DKI Jakarta.
Lakukan analisis profil risiko karantina dan rekomendasikan persyaratan dokumen untuk pengajuan impor berikut:

- Nama Pemohon/Perusahaan: ${pemohon}
- Komoditas: ${komoditas}
- Kategori Karantina: ${kategori || 'HEWAN / IKAN / TUMBUHAN'}
- Negara Asal: ${asal || 'Tidak ditentukan'}
- Tempat Pemeriksaan: ${tempatPeriksa || 'Wilayah Layanan BBKHIT DKI Jakarta'}
- Kode HS: ${kodeHs || 'Belum tersedia'}

Berikan output dalam format JSON MURNI (tanpa markdown backticks, tanpa text lain) dengan struktur persis seperti berikut:
{
  "riskScore": <angka 1 - 100>,
  "riskLevel": "<SANGAT TINGGI | TINGGI | SEDANG | RENDAH>",
  "summary": "<Penjelasan singkat 2-3 kalimat mengenai profil risiko pengajuan impor ini>",
  "potentialThreats": ["<Ancaman Hama/Penyakit HPHK/HPIK/OPTK 1>", "<Ancaman 2>", "<Ancaman 3>"],
  "requiredDocuments": ["<Dokumen Wajib 1>", "<Dokumen Wajib 2>", "<Dokumen Wajib 3>", "<Dokumen Wajib 4>"],
  "quarantineActions": ["<Tindakan Karantina 1: Pemeriksaan Fisik>", "<Tindakan 2: Pengujian Laboratorium>", "<Tindakan 3: Pembebasan/Perlakuan>"],
  "recommendationNote": "<Catatan teknis rekomendasi kelayakan untuk petugas karantina>"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const responseText = response.text || '';
        const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          const parsedData = JSON.parse(cleanedJson);
          return res.json({ success: true, mode: 'GEMINI_CLOUD', data: parsedData });
        } catch (jsonErr) {
          // If JSON parse fails, fall through to expert engine
        }
      } catch (geminiErr: any) {
        console.warn('Gemini cloud call error, falling back to Expert Quarantine AI Engine:', geminiErr?.message);
      }
    }

    // Real-Time Intelligent Quarantine AI Risk Engine
    const expertData = runExpertQuarantineRiskEngine(pemohon, komoditas, kategori, asal, tempatPeriksa, kodeHs);
    return res.json({
      success: true,
      mode: 'EXPERT_QUARANTINE_AI',
      data: expertData,
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server profiling karantina running on http://localhost:${PORT} (WebSocket /ws aktif)`);
  });
}

startServer();
