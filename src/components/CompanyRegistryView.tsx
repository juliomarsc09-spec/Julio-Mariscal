import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Building2,
  Search,
  Download,
  Upload,
  Plus,
  Edit3,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CompanyContactInfo, MediaPembawaRecord } from '../types';
import {
  extractCompanyCoreName,
  accumulateFrequency,
} from '../data/companyNormalizer';
import { UploadProgressBar } from './UploadProgressBar';
import {
  UploadProgressCallback,
  UploadProgressState,
  formatBytesToMB,
  formatUploadErrorMessage,
  verifyExcelImportPasscode,
} from '../utils/uploadWithProgress';

const MAX_COMPANY_UPLOAD_BYTES = 25 * 1024 * 1024; // Mendukung minimal 5MB hingga 25MB

export const COMPANY_TEMPLATE_HEADERS = [
  'No',
  'Nama Pemohon',
  'Jenis Perusahaan',
  'Nama Perusahaan',
  'Identitas',
  'Nomor Identitas',
  'NITKU',
  'UPT Registrasi',
  'Lingkup Aktivitas',
  'Rerata Frekuensi',
  'Daftar Komoditas',
  'Tempat Karantina',
  'Status Kepemilikan',
  'Email',
  'Nomor Registrasi',
  'Tanggal Registrasi',
  'Status Blokir',
] as const;

export interface CompanyRegistryRow {
  coreKey: string;
  no: number;
  namaPemohon: string;
  jenisPerusahaan: string;
  namaPerusahaan: string;
  identitas: string;
  nomorIdentitas: string;
  nitku: string;
  uptRegistrasi: string;
  lingkupAktivitas: string;
  rerataFrekuensi: string;
  daftarKomoditas: string;
  tempatKarantina: string;
  statusKepemilikan: string;
  email: string;
  nomorRegistrasi: string;
  tanggalRegistrasi: string;
  statusBlokir: string;
  recordCount: number;
  hasRecords: boolean;
}

interface CompanyRegistryViewProps {
  data: MediaPembawaRecord[];
  companyContacts: Record<string, CompanyContactInfo>;
  onSaveCompanyEntry: (entry: CompanyContactInfo, mode?: 'create' | 'edit') => Promise<void>;
  onBulkImportCompanyEntries: (
    entries: CompanyContactInfo[],
    onProgress?: UploadProgressCallback
  ) => Promise<void>;
  onSelectApplicant: (pemohon: string) => void;
}

function normalizeHeaderKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const EMPTY_FORM: CompanyContactInfo = {
  companyName: '',
  pemilik: '',
  email: '',
  updatedAt: '',
  namaPemohon: '',
  jenisPerusahaan: '',
  namaPerusahaan: '',
  identitas: '',
  nomorIdentitas: '',
  nitku: '',
  uptRegistrasi: 'BBKHIT DKI Jakarta',
  lingkupAktivitas: '',
  rerataFrekuensi: '',
  daftarKomoditas: '',
  tempatKarantina: '',
  statusKepemilikan: '',
  nomorRegistrasi: '',
  tanggalRegistrasi: '',
  statusBlokir: 'Tidak Diblokir',
  isRegistryEntry: true,
};

export const CompanyRegistryView: React.FC<CompanyRegistryViewProps> = ({
  data,
  companyContacts,
  onSaveCompanyEntry,
  onBulkImportCompanyEntries,
  onSelectApplicant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [blockFilter, setBlockFilter] = useState<'ALL' | 'AKTIF' | 'DIBLOKIR'>('ALL');
  const [pageSize, setPageSize] = useState<10 | 20 | 30>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Edit / Add Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<CompanyContactInfo>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Import Excel/CSV Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<CompanyContactInfo[] | null>(null);
  const [importPreviewLimit, setImportPreviewLimit] = useState<10 | 20 | 30>(10);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<UploadProgressState | null>(null);
  const [importPasscode, setImportPasscode] = useState('');
  const [showImportPasscode, setShowImportPasscode] = useState(false);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build unified company list from Profil Perusahaan transaction records + saved companyContacts overrides
  const allRows = useMemo<CompanyRegistryRow[]>(() => {
    const grouped = new Map<
      string,
      {
        canonicalName: string;
        activities: Set<string>;
        commodities: Set<string>;
        sites: Set<string>;
        pemilik: string;
        email: string;
        jenisPerusahaan: string;
        identitas: string;
        statusKepemilikan: string;
        tanggalRegistrasi: string;
        statusBlokir: string;
        freqSum: number;
        freqCount: number;
        recordCount: number;
      }
    >();

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const rawName = (r.pemohon || '').trim().toUpperCase();
      if (!rawName) continue;
      const coreKey = extractCompanyCoreName(rawName) || rawName;

      let agg = grouped.get(coreKey);
      if (!agg) {
        agg = {
          canonicalName: rawName,
          activities: new Set<string>(),
          commodities: new Set<string>(),
          sites: new Set<string>(),
          pemilik: '',
          email: '',
          jenisPerusahaan: '',
          identitas: '',
          statusKepemilikan: '',
          tanggalRegistrasi: '',
          statusBlokir: '',
          freqSum: 0,
          freqCount: 0,
          recordCount: 0,
        };
        grouped.set(coreKey, agg);
      }

      if (rawName.length > agg.canonicalName.length) {
        agg.canonicalName = rawName;
      }
      agg.recordCount++;

      if (r.jenisKegiatan) agg.activities.add(r.jenisKegiatan);
      if (r.lingkupAktivitas) {
        r.lingkupAktivitas
          .split(/[,;/]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => agg!.activities.add(s));
      }
      if (r.komoditas) agg.commodities.add(r.komoditas.trim());
      if (Array.isArray(r.tempatPeriksa) && r.tempatPeriksa.length > 0) {
        r.tempatPeriksa.forEach((site) => {
          if (site && site.trim()) agg!.sites.add(site.trim());
        });
      } else if (r.tempatPeriksaRaw && r.tempatPeriksaRaw.trim()) {
        agg.sites.add(r.tempatPeriksaRaw.trim());
      }

      if (!agg.pemilik && r.pemilik) agg.pemilik = r.pemilik;
      if (!agg.email && r.email) agg.email = r.email;
      if (!agg.jenisPerusahaan && r.jenisPerusahaan) agg.jenisPerusahaan = r.jenisPerusahaan;
      if (!agg.identitas && r.identitas) agg.identitas = r.identitas;
      if (!agg.statusKepemilikan && r.statusKepemilikan) agg.statusKepemilikan = r.statusKepemilikan;
      if (!agg.tanggalRegistrasi && r.tanggalRegistrasi) agg.tanggalRegistrasi = r.tanggalRegistrasi;
      if (!agg.statusBlokir && r.statusBlokir) agg.statusBlokir = r.statusBlokir;
      if (typeof r.frekuensi === 'number' && !isNaN(r.frekuensi)) {
        agg.freqSum += r.frekuensi;
        agg.freqCount++;
      }
    }

    const rows: CompanyRegistryRow[] = [];
    const seenKeys = new Set<string>();

    // 1. All companies from Profil Perusahaan records
    grouped.forEach((agg, coreKey) => {
      seenKeys.add(coreKey);
      const saved = companyContacts?.[coreKey];
      const namaPerusahaan = (saved?.namaPerusahaan || saved?.companyName || agg.canonicalName).toUpperCase();
      const derivedFreq =
        agg.freqCount > 0 ? String(Math.round(agg.freqSum / agg.freqCount)) : String(agg.recordCount);

      rows.push({
        coreKey,
        no: saved?.no || 0,
        namaPemohon: saved?.namaPemohon || saved?.pemilik || agg.pemilik || '',
        jenisPerusahaan: saved?.jenisPerusahaan || agg.jenisPerusahaan || '',
        namaPerusahaan,
        identitas: saved?.identitas || agg.identitas || '',
        nomorIdentitas: saved?.nomorIdentitas || '',
        nitku: saved?.nitku || '',
        uptRegistrasi: saved?.uptRegistrasi || 'BBKHIT DKI Jakarta',
        lingkupAktivitas: saved?.lingkupAktivitas || Array.from(agg.activities).join(', '),
        rerataFrekuensi:
          saved?.rerataFrekuensi !== undefined && String(saved.rerataFrekuensi).trim() !== ''
            ? String(saved.rerataFrekuensi)
            : derivedFreq,
        daftarKomoditas: saved?.daftarKomoditas || Array.from(agg.commodities).join(', '),
        tempatKarantina: saved?.tempatKarantina || Array.from(agg.sites).join(', '),
        statusKepemilikan: saved?.statusKepemilikan || agg.statusKepemilikan || '',
        email: saved?.email || agg.email || '',
        nomorRegistrasi: saved?.nomorRegistrasi || '',
        tanggalRegistrasi: saved?.tanggalRegistrasi || agg.tanggalRegistrasi || '',
        statusBlokir: saved?.statusBlokir || agg.statusBlokir || 'Tidak Diblokir',
        recordCount: agg.recordCount,
        hasRecords: true,
      });
    });

    // 2. Any additional companies imported/added manually into companyContacts without records
    (Object.entries(companyContacts) as Array<[string, CompanyContactInfo]>).forEach(([coreKey, saved]) => {
      if (!saved || seenKeys.has(coreKey)) return;
      const namaPerusahaan = (saved.namaPerusahaan || saved.companyName || coreKey).toUpperCase();
      rows.push({
        coreKey,
        no: saved.no || 0,
        namaPemohon: saved.namaPemohon || saved.pemilik || '',
        jenisPerusahaan: saved.jenisPerusahaan || '',
        namaPerusahaan,
        identitas: saved.identitas || '',
        nomorIdentitas: saved.nomorIdentitas || '',
        nitku: saved.nitku || '',
        uptRegistrasi: saved.uptRegistrasi || 'BBKHIT DKI Jakarta',
        lingkupAktivitas: saved.lingkupAktivitas || '',
        rerataFrekuensi:
          saved.rerataFrekuensi !== undefined && String(saved.rerataFrekuensi).trim() !== ''
            ? String(saved.rerataFrekuensi)
            : '0',
        daftarKomoditas: saved.daftarKomoditas || '',
        tempatKarantina: saved.tempatKarantina || '',
        statusKepemilikan: saved.statusKepemilikan || '',
        email: saved.email || '',
        nomorRegistrasi: saved.nomorRegistrasi || '',
        tanggalRegistrasi: saved.tanggalRegistrasi || '',
        statusBlokir: saved.statusBlokir || 'Tidak Diblokir',
        recordCount: 0,
        hasRecords: false,
      });
    });

    rows.sort((a, b) => a.namaPerusahaan.localeCompare(b.namaPerusahaan));

    return rows.map((row, idx) => ({
      ...row,
      no: idx + 1,
    }));
  }, [data, companyContacts]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allRows.filter((row) => {
      if (activityFilter !== 'ALL') {
        if (!row.lingkupAktivitas.toUpperCase().includes(activityFilter)) {
          return false;
        }
      }
      if (blockFilter !== 'ALL') {
        const isBlocked =
          /blokir|suspend|nonaktif|blocked/i.test(row.statusBlokir) &&
          !/tidak\s*diblokir/i.test(row.statusBlokir);
        if (blockFilter === 'DIBLOKIR' && !isBlocked) return false;
        if (blockFilter === 'AKTIF' && isBlocked) return false;
      }
      if (q) {
        return (
          row.namaPerusahaan.toLowerCase().includes(q) ||
          row.namaPemohon.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          row.nitku.toLowerCase().includes(q) ||
          row.nomorRegistrasi.toLowerCase().includes(q) ||
          row.nomorIdentitas.toLowerCase().includes(q) ||
          row.daftarKomoditas.toLowerCase().includes(q) ||
          row.uptRegistrasi.toLowerCase().includes(q) ||
          row.tempatKarantina.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRows, searchTerm, activityFilter, blockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const statsSummary = useMemo(() => {
    let withReg = 0;
    let blocked = 0;
    let withEmail = 0;
    for (const r of allRows) {
      if (r.nomorRegistrasi || r.nitku) withReg++;
      if (r.email) withEmail++;
      const isBlocked =
        /blokir|suspend|nonaktif|blocked/i.test(r.statusBlokir) &&
        !/tidak\s*diblokir/i.test(r.statusBlokir);
      if (isBlocked) blocked++;
    }
    return { total: allRows.length, withReg, withEmail, blocked };
  }, [allRows]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setFormState({ ...EMPTY_FORM });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (row: CompanyRegistryRow) => {
    setFormMode('edit');
    setFormState({
      companyName: row.namaPerusahaan,
      pemilik: row.namaPemohon,
      email: row.email,
      updatedAt: new Date().toISOString(),
      no: row.no,
      namaPemohon: row.namaPemohon,
      jenisPerusahaan: row.jenisPerusahaan,
      namaPerusahaan: row.namaPerusahaan,
      identitas: row.identitas,
      nomorIdentitas: row.nomorIdentitas,
      nitku: row.nitku,
      uptRegistrasi: row.uptRegistrasi,
      lingkupAktivitas: row.lingkupAktivitas,
      rerataFrekuensi: row.rerataFrekuensi,
      daftarKomoditas: row.daftarKomoditas,
      tempatKarantina: row.tempatKarantina,
      statusKepemilikan: row.statusKepemilikan,
      nomorRegistrasi: row.nomorRegistrasi,
      tanggalRegistrasi: row.tanggalRegistrasi,
      statusBlokir: row.statusBlokir,
      isRegistryEntry: true,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCompany = (formState.namaPerusahaan || formState.companyName || '').trim().toUpperCase();
    if (!cleanCompany) {
      setFormError('Nama Perusahaan wajib diisi.');
      return;
    }

    setIsSavingForm(true);
    setFormError(null);
    try {
      const payload: CompanyContactInfo = {
        ...formState,
        companyName: cleanCompany,
        namaPerusahaan: cleanCompany,
        pemilik: (formState.namaPemohon || formState.pemilik || '').trim(),
        namaPemohon: (formState.namaPemohon || formState.pemilik || '').trim(),
        email: (formState.email || '').trim(),
        updatedAt: new Date().toISOString(),
        isRegistryEntry: true,
      };
      await onSaveCompanyEntry(payload, formMode);
      setIsFormOpen(false);
      setStatusBanner(
        formMode === 'create'
          ? `Data perusahaan "${cleanCompany}" berhasil ditambahkan / digabungkan ke tabel Data Perusahaan.`
          : `Data perusahaan "${cleanCompany}" berhasil diperbarui pada tabel Data Perusahaan.`
      );
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data perusahaan.');
    } finally {
      setIsSavingForm(false);
    }
  };

  // Download exact 17-column Excel template matching uploaded screenshot
  const handleDownloadTemplate = () => {
    const sampleRow: Record<string, string | number> = {
      No: 1,
      'Nama Pemohon': 'Budi Santoso',
      'Jenis Perusahaan': 'PT / Perseroan Terbatas',
      'Nama Perusahaan': 'PT SAMUDERA MANDIRI LOGISTIK',
      Identitas: 'NIB / NPWP',
      'Nomor Identitas': '0123456789012345',
      NITKU: '0012345678901000',
      'UPT Registrasi': 'BBKHIT DKI Jakarta',
      'Lingkup Aktivitas': 'IMPOR, EKSPOR',
      'Rerata Frekuensi': 24,
      'Daftar Komoditas': 'Daging Sapi, Udang Vannamei',
      'Tempat Karantina': 'Pelabuhan Tanjung Priok / IKT',
      'Status Kepemilikan': 'Milik Sendiri',
      Email: 'compliance@samuderamandiri.co.id',
      'Nomor Registrasi': 'REG-BBKHIT-001/2026',
      'Tanggal Registrasi': '2026-01-15',
      'Status Blokir': 'Tidak Diblokir',
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], {
      header: [...COMPANY_TEMPLATE_HEADERS],
    });
    ws['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 22 },
      { wch: 32 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 32 },
      { wch: 26 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Perusahaan');
    XLSX.writeFile(wb, 'Template_Data_Perusahaan_QBIOCHECK.xlsx');
  };

  const handleExportExcel = () => {
    const exportData = filteredRows.map((r, idx) => ({
      No: idx + 1,
      'Nama Pemohon': r.namaPemohon,
      'Jenis Perusahaan': r.jenisPerusahaan,
      'Nama Perusahaan': r.namaPerusahaan,
      Identitas: r.identitas,
      'Nomor Identitas': r.nomorIdentitas,
      NITKU: r.nitku,
      'UPT Registrasi': r.uptRegistrasi,
      'Lingkup Aktivitas': r.lingkupAktivitas,
      'Rerata Frekuensi': r.rerataFrekuensi,
      'Daftar Komoditas': r.daftarKomoditas,
      'Tempat Karantina': r.tempatKarantina,
      'Status Kepemilikan': r.statusKepemilikan,
      Email: r.email,
      'Nomor Registrasi': r.nomorRegistrasi,
      'Tanggal Registrasi': r.tanggalRegistrasi,
      'Status Blokir': r.statusBlokir,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData, {
      header: [...COMPANY_TEMPLATE_HEADERS],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Perusahaan');
    XLSX.writeFile(
      wb,
      `Data_Perusahaan_BBKHIT_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setImportFileName(`${file.name} (${sizeMB} MB)`);
    setImportPreviewLimit(10);

    if (file.size > MAX_COMPANY_UPLOAD_BYTES) {
      setImportError(`Ukuran file (${sizeMB} MB) melebihi batas maksimal 25 MB.`);
      setImportPreview(null);
      return;
    }

    setImportProgress({
      percent: 15,
      phase: 'Membaca file Excel / CSV perusahaan...',
      detail: `${file.name} (${formatBytesToMB(file.size)})`,
    });

    try {
      const buffer = await file.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 16));
      setImportProgress({
        percent: 55,
        phase: 'Mengurai kolom 17 template & menggabungkan baris perusahaan...',
        detail: 'Memproses data perusahaan...',
      });
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', dense: true });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        setImportError('File Excel/CSV kosong atau tidak memiliki baris data.');
        setImportPreview(null);
        setImportProgress(null);
        return;
      }

      const now = new Date().toISOString();
      interface RowAcc {
        entry: CompanyContactInfo;
        actSet: Set<string>;
        actList: string[];
        commSet: Set<string>;
        commList: string[];
        siteSet: Set<string>;
        siteList: string[];
      }
      const addTokens = (set: Set<string>, list: string[], raw?: string) => {
        if (!raw) return;
        for (const p of String(raw).split(/[,;\n]+/)) {
          const t = p.trim();
          if (!t) continue;
          const k = t.toUpperCase();
          if (!set.has(k)) {
            set.add(k);
            list.push(t);
          }
        }
      };

      const mergedByCore = new Map<string, RowAcc>();

      for (let i = 0; i < jsonRows.length; i++) {
        const rawRow = jsonRows[i];
        const norm: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawRow)) {
          norm[normalizeHeaderKey(k)] = String(v ?? '').trim();
        }

        const namaPerusahaan = (
          norm['namaperusahaan'] ||
          norm['perusahaan'] ||
          norm['companyname'] ||
          norm['pemohon'] ||
          ''
        )
          .trim()
          .toUpperCase();
        if (!namaPerusahaan) continue;

        const coreKey = extractCompanyCoreName(namaPerusahaan) || namaPerusahaan;
        const namaPemohon =
          norm['namapemohon'] || norm['pemilik'] || norm['direktur'] || norm['penanggungjawab'] || '';
        const email = norm['email'] || norm['alamatemail'] || '';

        const entry: CompanyContactInfo = {
          companyName: namaPerusahaan,
          pemilik: namaPemohon,
          email,
          updatedAt: now,
          isRegistryEntry: true,
          ...(norm['no'] && !isNaN(Number(norm['no']))
            ? { no: Number(norm['no']) }
            : { no: mergedByCore.size + 1 }),
          ...(namaPemohon ? { namaPemohon } : {}),
          ...(norm['jenisperusahaan'] ? { jenisPerusahaan: norm['jenisperusahaan'] } : {}),
          namaPerusahaan,
          ...(norm['identitas'] ? { identitas: norm['identitas'] } : {}),
          ...(norm['nomoridentitas'] || norm['noidentitas'] || norm['npwp'] || norm['nib']
            ? {
                nomorIdentitas:
                  norm['nomoridentitas'] || norm['noidentitas'] || norm['npwp'] || norm['nib'],
              }
            : {}),
          ...(norm['nitku'] ? { nitku: norm['nitku'] } : {}),
          ...(norm['uptregistrasi'] ? { uptRegistrasi: norm['uptregistrasi'] } : {}),
          ...(norm['lingkupaktivitas'] || norm['aktivitas']
            ? { lingkupAktivitas: norm['lingkupaktivitas'] || norm['aktivitas'] }
            : {}),
          ...(norm['reratafrekuensi'] || norm['frekuensi']
            ? { rerataFrekuensi: norm['reratafrekuensi'] || norm['frekuensi'] }
            : {}),
          ...(norm['daftarkomoditas'] || norm['komoditas']
            ? { daftarKomoditas: norm['daftarkomoditas'] || norm['komoditas'] }
            : {}),
          ...(norm['tempatkarantina'] || norm['lokasi']
            ? { tempatKarantina: norm['tempatkarantina'] || norm['lokasi'] }
            : {}),
          ...(norm['statuskepemilikan'] ? { statusKepemilikan: norm['statuskepemilikan'] } : {}),
          ...(norm['nomorregistrasi'] || norm['noregistrasi']
            ? { nomorRegistrasi: norm['nomorregistrasi'] || norm['noregistrasi'] }
            : {}),
          ...(norm['tanggalregistrasi'] || norm['tglregistrasi']
            ? { tanggalRegistrasi: norm['tanggalregistrasi'] || norm['tglregistrasi'] }
            : {}),
          ...(norm['statusblokir'] ? { statusBlokir: norm['statusblokir'] } : {}),
        };

        let acc = mergedByCore.get(coreKey);
        if (!acc) {
          acc = {
            entry,
            actSet: new Set<string>(),
            actList: [],
            commSet: new Set<string>(),
            commList: [],
            siteSet: new Set<string>(),
            siteList: [],
          };
          addTokens(acc.actSet, acc.actList, entry.lingkupAktivitas);
          addTokens(acc.commSet, acc.commList, entry.daftarKomoditas);
          addTokens(acc.siteSet, acc.siteList, entry.tempatKarantina);
          mergedByCore.set(coreKey, acc);
        } else {
          const prev = acc.entry;
          if (!prev.pemilik && entry.pemilik) prev.pemilik = entry.pemilik;
          if (!prev.namaPemohon && entry.namaPemohon) prev.namaPemohon = entry.namaPemohon;
          if (!prev.email && entry.email) prev.email = entry.email;
          if (!prev.jenisPerusahaan && entry.jenisPerusahaan) prev.jenisPerusahaan = entry.jenisPerusahaan;
          if (!prev.identitas && entry.identitas) prev.identitas = entry.identitas;
          if (!prev.nomorIdentitas && entry.nomorIdentitas) prev.nomorIdentitas = entry.nomorIdentitas;
          if (!prev.nitku && entry.nitku) prev.nitku = entry.nitku;
          if (!prev.uptRegistrasi && entry.uptRegistrasi) prev.uptRegistrasi = entry.uptRegistrasi;
          if (!prev.statusKepemilikan && entry.statusKepemilikan) prev.statusKepemilikan = entry.statusKepemilikan;
          if (!prev.nomorRegistrasi && entry.nomorRegistrasi) prev.nomorRegistrasi = entry.nomorRegistrasi;
          if (!prev.tanggalRegistrasi && entry.tanggalRegistrasi) prev.tanggalRegistrasi = entry.tanggalRegistrasi;
          if (!prev.statusBlokir && entry.statusBlokir) prev.statusBlokir = entry.statusBlokir;
          prev.rerataFrekuensi = accumulateFrequency(prev.rerataFrekuensi, entry.rerataFrekuensi);
          addTokens(acc.actSet, acc.actList, entry.lingkupAktivitas);
          addTokens(acc.commSet, acc.commList, entry.daftarKomoditas);
          addTokens(acc.siteSet, acc.siteList, entry.tempatKarantina);
        }
      }

      const parsed: CompanyContactInfo[] = Array.from(mergedByCore.values()).map((acc) => ({
        ...acc.entry,
        ...(acc.actList.length > 0 ? { lingkupAktivitas: acc.actList.join(', ') } : {}),
        ...(acc.commList.length > 0 ? { daftarKomoditas: acc.commList.join(', ') } : {}),
        ...(acc.siteList.length > 0 ? { tempatKarantina: acc.siteList.join(', ') } : {}),
      }));
      if (parsed.length === 0) {
        setImportError(
          'Tidak ditemukan kolom "Nama Perusahaan" yang valid. Unduh template untuk format kolom yang sesuai.'
        );
        setImportPreview(null);
        return;
      }

      setImportPreview(parsed);
      setImportProgress(null);
    } catch (err: any) {
      setImportError(err?.message || 'Gagal membaca file Excel/CSV.');
      setImportPreview(null);
      setImportProgress(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    try {
      await verifyExcelImportPasscode(importPasscode);

      setImportProgress({
        percent: 2,
        phase: 'Memulai unggah Data Perusahaan ke server...',
        detail: `${importPreview.length.toLocaleString('id-ID')} perusahaan siap dikirim`,
      });
      await onBulkImportCompanyEntries(importPreview, (progress) => {
        setImportProgress(progress);
      });
      setImportProgress({
        percent: 100,
        phase: 'Selesai 100% — Data Perusahaan berhasil disimpan ke server!',
        detail: `${importPreview.length.toLocaleString('id-ID')} perusahaan berhasil diunggah`,
      });
      await new Promise((resolve) => setTimeout(resolve, 420));
      setStatusBanner(
        `Berhasil mengimpor ${importPreview.length} baris data perusahaan ke tabel Data Perusahaan.`
      );
      setImportProgress(null);
      setIsImportOpen(false);
      setImportPreview(null);
      setImportFileName(null);
      setImportPasscode('');
      setShowImportPasscode(false);
      setCurrentPage(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportProgress(null);
      setImportError(formatUploadErrorMessage(err, 'Gagal menyimpan data impor perusahaan.'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {statusBanner && (
        <div className="glass-sub rounded-2xl px-4 py-3 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/15"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Template Toolbar */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            <span>Registrasi Perusahaan &amp; Identitas Pelaku Usaha</span>
            <span aria-hidden="true">·</span>
            <span>BBKHIT DKI Jakarta</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
              {statsSummary.total.toLocaleString('id-ID')} Baris Data Perusahaan
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Data Perusahaan (Template Registrasi Excel 17 Kolom)</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Menampilkan seluruh perusahaan dari Profil Perusahaan secara sinkron beserta kelengkapan identitas, NITKU, nomor registrasi, dan status blokir.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="min-h-[40px] inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold glass-sub border border-slate-300 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:border-indigo-400 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportError(null);
              setImportPreview(null);
              setImportFileName(null);
              setIsImportOpen(true);
            }}
            className="min-h-[40px] inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Impor CSV / Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="min-h-[40px] inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold glass-sub border border-slate-300 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:border-sky-400 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="min-h-[40px] inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah Perusahaan</span>
          </button>
        </div>
      </div>

      {/* Summary, Row Display Count Selector (10 / 20 / 30) & Search/Filter Controls */}
      <div className="glass-panel rounded-3xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          {/* Pilihan Tampilan Baris Excel: 10, 20, 30 (default 10) */}
          <div className="inline-flex items-center space-x-1.5 glass-sub px-2.5 py-1.5 rounded-2xl border border-slate-200 dark:border-white/15">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Tampilkan Baris:
            </span>
            {([10, 20, 30] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setPageSize(opt);
                  setCurrentPage(1);
                }}
                aria-pressed={pageSize === opt}
                className={`min-h-[28px] px-2.5 py-1 rounded-xl text-xs font-extrabold tabular-nums transition-colors ${
                  pageSize === opt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Data: </span>
            <strong className="tabular-nums text-slate-900 dark:text-white">
              {filteredRows.length.toLocaleString('id-ID')}
            </strong>
          </div>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Email: </span>
            <strong className="tabular-nums text-emerald-700 dark:text-emerald-400">
              {statsSummary.withEmail.toLocaleString('id-ID')}
            </strong>
          </div>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Status Blokir: </span>
            <strong className="tabular-nums text-rose-700 dark:text-rose-400">
              {statsSummary.blocked.toLocaleString('id-ID')}
            </strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari PT, pemohon, NITKU, no reg..."
              className="w-full min-h-[38px] glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={activityFilter}
            onChange={(e) => {
              setActivityFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter Lingkup Aktivitas"
            className="min-h-[38px] glass-input rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Aktivitas</option>
            <option value="IMPOR">IMPOR</option>
            <option value="EKSPOR">EKSPOR</option>
            <option value="DOMESTIK MASUK">DOMESTIK MASUK</option>
            <option value="DOMESTIK KELUAR">DOMESTIK KELUAR</option>
          </select>

          <select
            value={blockFilter}
            onChange={(e) => {
              setBlockFilter(e.target.value as 'ALL' | 'AKTIF' | 'DIBLOKIR');
              setCurrentPage(1);
            }}
            aria-label="Filter Status Blokir"
            className="min-h-[38px] glass-input rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status Blokir</option>
            <option value="AKTIF">Tidak Diblokir / Aktif</option>
            <option value="DIBLOKIR">Diblokir</option>
          </select>

          {(searchTerm || activityFilter !== 'ALL' || blockFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActivityFilter('ALL');
                setBlockFilter('ALL');
                setCurrentPage(1);
              }}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl glass-sub text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 inline-flex items-center space-x-1"
              title="Reset Filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 17-Column Template Data Grid */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-[1950px] w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1b4977] text-white border-b border-white/15">
                <th className="py-3 px-3 font-bold whitespace-nowrap w-14 text-center">No</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Nama Pemohon</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Jenis Perusahaan</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Nama Perusahaan</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Identitas</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Nomor Identitas</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">NITKU</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">UPT Registrasi</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Lingkup Aktivitas</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap text-right">Rerata Frekuensi</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Daftar Komoditas</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Tempat Karantina</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Status Kepemilikan</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Email</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Nomor Registrasi</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Tanggal Registrasi</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Status Blokir</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap text-center sticky right-0 bg-[#173f68]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-14 px-6 text-left sm:text-center">
                    <div className="max-w-xl sm:mx-auto space-y-3">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {allRows.length === 0
                          ? 'Tabel Data Perusahaan masih kosong.'
                          : 'Tidak ada data perusahaan yang cocok dengan filter pencarian.'}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {allRows.length === 0
                          ? 'Data di Profil Perusahaan, Profil Komoditas, dan Profil Negara tetap tersimpan aman. Silakan impor file Excel/CSV atau tambahkan data perusahaan baru sesuai template 17 kolom.'
                          : 'Ubah kata kunci pencarian atau reset filter untuk melihat baris yang sudah diimpor.'}
                      </p>
                      {allRows.length === 0 && (
                        <div className="flex flex-wrap sm:justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setImportError(null);
                              setImportPreview(null);
                              setImportFileName(null);
                              setIsImportOpen(true);
                            }}
                            className="min-h-[38px] inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Impor File Excel (10 / 20 / 30 Baris)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="min-h-[38px] inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold glass-sub border border-slate-300 dark:border-white/15 text-slate-800 dark:text-slate-100"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Unduh Template 17 Kolom</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const rowNum = (safePage - 1) * pageSize + idx + 1;
                  const isBlocked =
                    /blokir|suspend|nonaktif|blocked/i.test(row.statusBlokir) &&
                    !/tidak\s*diblokir/i.test(row.statusBlokir);

                  return (
                    <tr
                      key={row.coreKey}
                      className="hover:bg-indigo-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-[180px] truncate" title={row.namaPemohon}>
                        {row.namaPemohon || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.jenisPerusahaan || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap max-w-[240px] truncate" title={row.namaPerusahaan}>
                        {row.hasRecords ? (
                          <button
                            type="button"
                            onClick={() => onSelectApplicant(row.namaPerusahaan)}
                            className="text-left hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline focus:outline-none"
                          >
                            {row.namaPerusahaan}
                          </button>
                        ) : (
                          row.namaPerusahaan
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.identitas || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.nomorIdentitas || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.nitku || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[180px] truncate" title={row.uptRegistrasi}>
                        {row.uptRegistrasi || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap max-w-[200px] truncate" title={row.lingkupAktivitas}>
                        {row.lingkupAktivitas || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {row.rerataFrekuensi || '0'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[240px] truncate" title={row.daftarKomoditas}>
                        {row.daftarKomoditas || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={row.tempatKarantina}>
                        {row.tempatKarantina || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.statusKepemilikan || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200 whitespace-nowrap max-w-[210px] truncate" title={row.email}>
                        {row.email || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.nomorRegistrasi || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.tanggalRegistrasi || '-'}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold whitespace-nowrap ${
                          isBlocked
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {row.statusBlokir || 'Tidak Diblokir'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200/70 dark:border-white/10">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/15 transition-colors"
                            title="Edit Data Perusahaan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {row.hasRecords && (
                            <button
                              type="button"
                              onClick={() => onSelectApplicant(row.namaPerusahaan)}
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                              title="Buka Profil Lengkap Perusahaan"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="tabular-nums">
            Halaman <strong>{safePage}</strong> dari <strong>{totalPages}</strong> (
            {filteredRows.length.toLocaleString('id-ID')} baris • menampilkan maksimal{' '}
            <strong>{pageSize}</strong> baris per halaman)
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[34px] px-3 py-1 rounded-xl glass-sub border border-slate-300 dark:border-white/15 disabled:opacity-40 inline-flex items-center space-x-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[34px] px-3 py-1 rounded-xl glass-sub border border-slate-300 dark:border-white/15 disabled:opacity-40 inline-flex items-center space-x-1 font-semibold"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Company Modal (Portal) */}
      {isFormOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
            <div className="glass-modal rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/25 shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formState.companyName ? `Edit Data: ${formState.companyName}` : 'Tambah Data Perusahaan Baru'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Lengkapi data registrasi sesuai template 17 kolom BBKHIT DKI Jakarta
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-700 dark:text-rose-200 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Perusahaan *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.namaPerusahaan || formState.companyName || ''}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          companyName: e.target.value,
                          namaPerusahaan: e.target.value,
                        }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      placeholder="PT CONTOH KARANTINA"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Pemohon
                    </label>
                    <input
                      type="text"
                      value={formState.namaPemohon || ''}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          namaPemohon: e.target.value,
                          pemilik: e.target.value,
                        }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Jenis Perusahaan
                    </label>
                    <input
                      type="text"
                      value={formState.jenisPerusahaan || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, jenisPerusahaan: e.target.value }))
                      }
                      placeholder="PT / CV / Perorangan"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Identitas
                    </label>
                    <input
                      type="text"
                      value={formState.identitas || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, identitas: e.target.value }))
                      }
                      placeholder="NIB / NPWP / KTP"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nomor Identitas
                    </label>
                    <input
                      type="text"
                      value={formState.nomorIdentitas || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, nomorIdentitas: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      NITKU
                    </label>
                    <input
                      type="text"
                      value={formState.nitku || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, nitku: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      UPT Registrasi
                    </label>
                    <input
                      type="text"
                      value={formState.uptRegistrasi || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, uptRegistrasi: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Lingkup Aktivitas
                    </label>
                    <input
                      type="text"
                      value={formState.lingkupAktivitas || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, lingkupAktivitas: e.target.value }))
                      }
                      placeholder="IMPOR, EKSPOR, DOMESTIK"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Rerata Frekuensi
                    </label>
                    <input
                      type="text"
                      value={String(formState.rerataFrekuensi ?? '')}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, rerataFrekuensi: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Daftar Komoditas
                    </label>
                    <input
                      type="text"
                      value={formState.daftarKomoditas || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, daftarKomoditas: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tempat Karantina
                    </label>
                    <input
                      type="text"
                      value={formState.tempatKarantina || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, tempatKarantina: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Status Kepemilikan
                    </label>
                    <input
                      type="text"
                      value={formState.statusKepemilikan || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, statusKepemilikan: e.target.value }))
                      }
                      placeholder="Milik Sendiri / Sewa"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formState.email || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, email: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nomor Registrasi
                    </label>
                    <input
                      type="text"
                      value={formState.nomorRegistrasi || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, nomorRegistrasi: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Registrasi
                    </label>
                    <input
                      type="text"
                      value={formState.tanggalRegistrasi || ''}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, tanggalRegistrasi: e.target.value }))
                      }
                      placeholder="YYYY-MM-DD"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Status Blokir
                    </label>
                    <select
                      value={formState.statusBlokir || 'Tidak Diblokir'}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, statusBlokir: e.target.value }))
                      }
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Tidak Diblokir">Tidak Diblokir</option>
                      <option value="Diblokir">Diblokir</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold glass-sub text-slate-700 dark:text-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingForm}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md disabled:opacity-50"
                  >
                    {isSavingForm ? 'Menyimpan...' : 'Simpan Data Perusahaan'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Bulk Import Excel / CSV Modal (Portal) */}
      {isImportOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
            <div className="glass-modal rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white/25 shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Impor Data Perusahaan (Template 17 Kolom)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Mendukung file .xlsx, .xls, dan .csv minimal 5MB (hingga 25MB) • Perusahaan sama otomatis digabungkan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 glass-sub p-3 rounded-2xl">
                  <span className="text-xs text-slate-700 dark:text-slate-200">
                    Belum punya file template resmi 17 kolom?
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Template</span>
                  </button>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFile}
                    className="block w-full text-xs text-slate-700 dark:text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    Kapasitas upload minimal 5MB (mendukung hingga 25MB). Baris dengan nama perusahaan yang sudah ada otomatis menambahkan data (komoditas, aktivitas, lokasi, dan frekuensi) ke perusahaan tersebut.
                  </p>
                  {importFileName && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                      File dipilih: <strong>{importFileName}</strong>
                    </p>
                  )}
                </div>

                {importError && !importPreview && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-700 dark:text-rose-200 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {importPreview && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        Siap diimpor: {importPreview.length} perusahaan (pratinjau {Math.min(importPreviewLimit, importPreview.length)} baris)
                      </p>
                      <div className="inline-flex items-center space-x-1 glass-sub px-2 py-1 rounded-xl border border-slate-200 dark:border-white/15">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Pratinjau:
                        </span>
                        {([10, 20, 30] as const).map((lim) => (
                          <button
                            key={lim}
                            type="button"
                            onClick={() => setImportPreviewLimit(lim)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold tabular-nums ${
                              importPreviewLimit === lim
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
                            }`}
                          >
                            {lim}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-60 overflow-auto rounded-2xl border border-slate-200 dark:border-white/10">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#1b4977] text-white sticky top-0">
                          <tr>
                            <th className="p-2 text-center">No</th>
                            <th className="p-2">Nama Perusahaan</th>
                            <th className="p-2">Nama Pemohon</th>
                            <th className="p-2">NITKU</th>
                            <th className="p-2">Email</th>
                            <th className="p-2">Status Blokir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                          {importPreview.slice(0, importPreviewLimit).map((item, i) => (
                            <tr key={`${item.companyName}-${i}`}>
                              <td className="p-2 text-center font-mono tabular-nums">{i + 1}</td>
                              <td className="p-2 font-bold">{item.namaPerusahaan}</td>
                              <td className="p-2">{item.namaPemohon || '-'}</td>
                              <td className="p-2 font-mono tabular-nums">{item.nitku || '-'}</td>
                              <td className="p-2">{item.email || '-'}</td>
                              <td className="p-2">{item.statusBlokir || 'Tidak Diblokir'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 space-y-2">
                      <label
                        htmlFor="company-excel-passcode"
                        className="flex items-center space-x-2 text-xs font-extrabold text-amber-900 dark:text-amber-200"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Password Konfirmasi Penambahan Impor Excel (Wajib)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="company-excel-passcode"
                          type={showImportPasscode ? 'text' : 'password'}
                          value={importPasscode}
                          onChange={(e) => {
                            setImportPasscode(e.target.value);
                            if (importError) setImportError(null);
                          }}
                          placeholder="Masukkan password petugas untuk menyimpan data impor..."
                          autoComplete="off"
                          disabled={isImporting}
                          className="w-full min-h-[40px] glass-input rounded-xl pl-3.5 pr-10 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowImportPasscode((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          aria-label={showImportPasscode ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                          {showImportPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {importError && (
                      <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-200 flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{importError}</span>
                      </div>
                    )}
                  </div>
                )}

                {importProgress && (
                  <UploadProgressBar progress={importProgress} accent="indigo" />
                )}

                <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 flex justify-end space-x-2">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => {
                      setIsImportOpen(false);
                      setImportPasscode('');
                      setShowImportPasscode(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold glass-sub text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!importPreview || isImporting || !importPasscode.trim()}
                    onClick={handleConfirmImport}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md disabled:opacity-50"
                  >
                    {isImporting
                      ? `Mengunggah ${Math.round(importProgress?.percent || 0)}%...`
                      : 'Simpan Data Impor'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
