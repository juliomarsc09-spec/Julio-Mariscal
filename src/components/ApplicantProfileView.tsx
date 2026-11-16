import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ShieldAlert,
  Search,
  Package,
  Globe2,
  MapPin,
  FileCode,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  MinusCircle,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Info,
  Clock,
  UserCheck,
  Trash2,
  X,
  TrendingDown,
  TrendingUp,
  FileText,
  User,
  Mail,
  Edit3,
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MediaPembawaRecord,
  ComplianceTier,
  QuarantineCategory,
  TradeActivityType,
  CompanyContactInfo,
} from '../types';
import {
  getApplicantProfile,
  getUniquePemohonList,
} from '../data/quarantineData';
import {
  getCompanyComplianceData,
  adjustCompanyComplianceScore,
  resetCompanyComplianceScore,
  deleteCompanyScoreLog,
  PRESET_PENALTY_REASONS,
  PRESET_BONUS_REASONS,
  calculateComplianceTier,
  calculateTierRiskLevel,
} from '../data/complianceScores';

interface ApplicantProfileViewProps {
  data: MediaPembawaRecord[];
  selectedPemohonName: string;
  onSelectPemohonName: (name: string) => void;
  onSelectCommodity: (commodity: string) => void;
  onSelectCountry?: (country: string) => void;
  onRunAIForApplicant: (pemohon: string, komoditas: string) => void;
  companyContacts?: Record<string, CompanyContactInfo>;
  onSaveCompanyContact?: (companyName: string, pemilik: string, email: string) => Promise<void>;
  onBulkImportCompanyContacts?: (
    items: Array<{ companyName: string; pemilik: string; email: string }>
  ) => Promise<void>;
}

export const ApplicantProfileView: React.FC<ApplicantProfileViewProps> = ({
  data,
  selectedPemohonName,
  onSelectPemohonName,
  onSelectCommodity,
  onSelectCountry,
  onRunAIForApplicant,
  companyContacts = {},
  onSaveCompanyContact,
  onBulkImportCompanyContacts,
}) => {

  const allApplicants = getUniquePemohonList(data);
  const [searchFilter, setSearchFilter] = useState('');
  const [complianceVersion, setComplianceVersion] = useState(0);

  // Score Adjustment Modal State
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'PENGURANGAN' | 'PENAMBAHAN'>('PENGURANGAN');
  const [pointsInput, setPointsInput] = useState<number>(15);
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [officerName, setOfficerName] = useState<string>('Petugas BBKHIT DKI Jakarta');
  const [modalError, setModalError] = useState<string | null>(null);

  const [selectedTradeActivity, setSelectedTradeActivity] = useState<TradeActivityType | 'ALL'>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<QuarantineCategory | 'ALL'>('ALL');
  const [confirmResetScore, setConfirmResetScore] = useState(false);
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<string | null>(null);

  // Single Company Contact Modal (Pemilik & Alamat Email)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Bulk Import Contacts Modal (CSV / Excel)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<'upload' | 'paste'>('upload');
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkParsedItems, setBulkParsedItems] = useState<
    Array<{ companyName: string; pemilik: string; email: string }> | null
  >(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const bulkFileRef = React.useRef<HTMLInputElement>(null);

  // Default to first applicant if none selected
  const activeName = selectedPemohonName || allApplicants[0] || '';
  const profile = getApplicantProfile(
    data,
    activeName,
    selectedTradeActivity,
    companyContacts,
    selectedCategoryFilter
  );

  // Fast O(N) summary of categories & activities per company for sidebar badges
  const companyQuickMeta = useMemo(() => {
    const map = new Map<
      string,
      { categories: Set<QuarantineCategory>; activities: Set<TradeActivityType> }
    >();
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const key = (r.pemohon || '').toUpperCase();
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          categories: new Set<QuarantineCategory>(),
          activities: new Set<TradeActivityType>(),
        };
        map.set(key, entry);
      }
      if (r.kategori) entry.categories.add(r.kategori);
      entry.activities.add((r.jenisKegiatan || 'IMPOR') as TradeActivityType);
    }
    return map;
  }, [data]);

  useEffect(() => {
    setConfirmResetScore(false);
    setConfirmDeleteLogId(null);
    setSelectedTradeActivity('ALL');
    setSelectedCategoryFilter('ALL');
  }, [activeName]);

  // Listen to compliance score updates across windows/tabs
  useEffect(() => {
    const handleScoreUpdated = () => {
      setComplianceVersion((v) => v + 1);
    };
    window.addEventListener('compliance_scores_updated', handleScoreUpdated);
    return () => {
      window.removeEventListener('compliance_scores_updated', handleScoreUpdated);
    };
  }, []);

  // Fetch current compliance scoring data
  const complianceData = activeName ? getCompanyComplianceData(activeName) : null;
  const currentScore = complianceData ? complianceData.currentScore : 100;
  const currentTier = complianceData ? complianceData.tier : 'HIJAU';
  const effectiveRiskLevel = calculateTierRiskLevel(currentTier, currentScore);

  const filteredApplicantList = allApplicants.filter((name) =>
    name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getTierBadge = (tier: ComplianceTier) => {
    switch (tier) {
      case 'HIJAU':
        return {
          bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35',
          indicator: 'bg-emerald-500 dark:bg-emerald-400',
          title: 'JALUR HIJAU (LOW RISK)',
          desc: 'Tingkat Kepatuhan Tinggi. Pemeriksaan acak & percepatan pengeluaran.',
          barColor: 'from-emerald-500 to-teal-400',
        };
      case 'KUNING':
        return {
          bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/35',
          indicator: 'bg-amber-500 dark:bg-amber-400',
          title: 'JALUR KUNING (MEDIUM)',
          desc: 'Tingkat Kepatuhan Waspada. Pemeriksaan fisik berkala & verifikasi dokumen ketat.',
          barColor: 'from-amber-500 to-yellow-400',
        };
      case 'MERAH':
        return {
          bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35',
          indicator: 'bg-rose-500 dark:bg-rose-400',
          title: 'JALUR MERAH (HIGH RISK)',
          desc: 'Tingkat Kepatuhan Kritis. Pemeriksaan fisik 100% & pengujian laboratorium wajib.',
          barColor: 'from-rose-600 to-red-500',
        };
    }
  };

  const currentTierBadge = getTierBadge(currentTier);

  // Open Score Modal
  const handleOpenScoreModal = (type: 'PENGURANGAN' | 'PENAMBAHAN') => {
    setActionType(type);
    if (type === 'PENGURANGAN') {
      const defaultPreset = PRESET_PENALTY_REASONS[0];
      setSelectedPresetReason(defaultPreset.reason);
      setPointsInput(Math.abs(defaultPreset.points));
    } else {
      const defaultPreset = PRESET_BONUS_REASONS[0];
      setSelectedPresetReason(defaultPreset.reason);
      setPointsInput(defaultPreset.points);
    }
    setCustomReason('');
    setReferenceNo('');
    setModalError(null);
    setIsScoreModalOpen(true);
  };

  // Handle Preset selection change
  const handlePresetChange = (reasonStr: string) => {
    setSelectedPresetReason(reasonStr);
    if (reasonStr === 'CUSTOM') {
      setCustomReason('');
    } else {
      const allPresets = actionType === 'PENGURANGAN' ? PRESET_PENALTY_REASONS : PRESET_BONUS_REASONS;
      const found = allPresets.find((p) => p.reason === reasonStr);
      if (found) {
        setPointsInput(Math.abs(found.points));
      }
    }
  };

  // Submit Score Adjustment
  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeName) return;

    const finalReason =
      selectedPresetReason === 'CUSTOM' ? customReason.trim() : (customReason.trim() ? `${selectedPresetReason} - ${customReason.trim()}` : selectedPresetReason);

    if (!finalReason) {
      setModalError('Wajib mengisi atau memilih alasan pengurangan/penambahan skor.');
      return;
    }

    if (pointsInput <= 0) {
      setModalError('Jumlah poin harus lebih besar dari 0.');
      return;
    }

    adjustCompanyComplianceScore(activeName, {
      type: actionType,
      points: pointsInput,
      reason: finalReason,
      referenceNo: referenceNo.trim() || undefined,
      officerName: officerName.trim() || 'Petugas BBKHIT DKI Jakarta',
    });

    setComplianceVersion((v) => v + 1);
    setIsScoreModalOpen(false);
  };

  // Handle Reset Score (inline confirmation, iframe-safe)
  const handleConfirmResetScore = () => {
    if (!activeName) return;
    resetCompanyComplianceScore(activeName);
    setComplianceVersion((v) => v + 1);
    setConfirmResetScore(false);
  };

  // Handle Delete Log (inline confirmation, iframe-safe)
  const handleConfirmDeleteLog = (logId: string) => {
    if (!activeName) return;
    deleteCompanyScoreLog(activeName, logId);
    setComplianceVersion((v) => v + 1);
    setConfirmDeleteLogId(null);
  };

  // Simulated score outcome in modal
  const simulatedDelta = actionType === 'PENGURANGAN' ? -pointsInput : pointsInput;
  const simulatedNewScore = Math.max(0, Math.min(100, currentScore + simulatedDelta));
  const simulatedNewTier = calculateComplianceTier(simulatedNewScore);

  // Open single contact editor modal
  const handleOpenContactModal = () => {
    setOwnerInput(profile?.pemilik || '');
    setEmailInput(profile?.email || '');
    setContactError(null);
    setIsContactModalOpen(true);
  };

  const handleSaveSingleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !onSaveCompanyContact) return;
    const trimmedEmail = emailInput.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setContactError('Format alamat email tidak valid (contoh: nama@perusahaan.co.id).');
      return;
    }
    setIsSavingContact(true);
    setContactError(null);
    try {
      await onSaveCompanyContact(profile.name, ownerInput.trim(), trimmedEmail);
      setIsContactModalOpen(false);
    } catch (err: any) {
      setContactError(err?.message || 'Gagal menyimpan data pemilik & email perusahaan.');
    } finally {
      setIsSavingContact(false);
    }
  };

  // Parse 2D rows for Bulk Company Contact CSV/Excel Import
  const parseContactRows = (rows: any[][]) => {
    const cleanRows = rows.filter((row) =>
      row.some((cell) => String(cell ?? '').trim().length > 0)
    );
    if (cleanRows.length === 0) {
      throw new Error('File atau data kosong. Pastikan terdapat minimal 1 baris data perusahaan.');
    }

    const normalizeHeader = (val: any) =>
      String(val ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    let headerIdx = -1;
    let colCompany = -1;
    let colOwner = -1;
    let colEmail = -1;

    for (let i = 0; i < Math.min(10, cleanRows.length); i++) {
      const cells = cleanRows[i].map(normalizeHeader);

      let cIdx = cells.findIndex(
        (h) => h === 'nama perusahaan' || h === 'nama_perusahaan' || h === 'company name'
      );
      if (cIdx === -1) {
        cIdx = cells.findIndex(
          (h) =>
            (h.includes('perusahaan') && !h.includes('jenis')) ||
            h.includes('company') ||
            h === 'entitas' ||
            h === 'nama'
        );
      }
      if (cIdx === -1) {
        cIdx = cells.findIndex((h) => h.includes('pemohon'));
      }

      const oIdx = cells.findIndex(
        (h, idx) =>
          idx !== cIdx &&
          (h === 'nama pemohon' ||
            h.includes('pemilik') ||
            h.includes('owner') ||
            h.includes('direktur') ||
            h.includes('pimpinan') ||
            h === 'pic' ||
            h.includes('penanggung') ||
            h.includes('pemohon'))
      );

      const eIdx = cells.findIndex(
        (h, idx) =>
          idx !== cIdx &&
          idx !== oIdx &&
          (h === 'email' || h.includes('email') || h.includes('e-mail') || h.includes('surel') || h.includes('mail'))
      );

      if (cIdx !== -1 && (oIdx !== -1 || eIdx !== -1)) {
        headerIdx = i;
        colCompany = cIdx;
        colOwner = oIdx;
        colEmail = eIdx;
        break;
      }
    }

    const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;
    if (headerIdx === -1) {
      colCompany = 0;
      colOwner = 1;
      colEmail = 2;
    }

    const parsed: Array<{ companyName: string; pemilik: string; email: string }> = [];
    for (let r = startRow; r < cleanRows.length; r++) {
      const row = cleanRows[r];
      const companyName = colCompany !== -1 ? String(row[colCompany] ?? '').trim() : '';
      const pemilik = colOwner !== -1 ? String(row[colOwner] ?? '').trim() : '';
      const email = colEmail !== -1 ? String(row[colEmail] ?? '').trim() : '';
      if (!companyName) continue;
      if (!pemilik && !email) continue;
      parsed.push({ companyName, pemilik, email });
    }

    if (parsed.length === 0) {
      throw new Error(
        'Tidak ditemukan baris valid. Pastikan terdapat kolom Nama Perusahaan, Nama Pemohon / Pemilik, dan Email.'
      );
    }
    return parsed;
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buf = evt.target?.result;
        if (!buf) throw new Error('Gagal membaca isi file.');
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        const parsed = parseContactRows(rows);
        setBulkParsedItems(parsed);
      } catch (err: any) {
        setBulkError(err?.message || 'Gagal memproses file CSV/Excel.');
        setBulkParsedItems(null);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleParseBulkPaste = () => {
    setBulkError(null);
    try {
      const lines = bulkPasteText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const rows = lines.map((line) => {
        if (line.includes('\t')) return line.split('\t');
        if (line.includes(';')) return line.split(';');
        return line.split(',');
      });
      const parsed = parseContactRows(rows);
      setBulkParsedItems(parsed);
    } catch (err: any) {
      setBulkError(err?.message || 'Gagal membaca data tempel.');
      setBulkParsedItems(null);
    }
  };

  const handleDownloadContactTemplate = (format: 'csv' | 'xlsx') => {
    const sampleCompanies = allApplicants.slice(0, 3);
    const headers = [
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
    ];
    const sampleRows = [
      headers,
      [
        1,
        'Budi Santoso',
        'PT',
        sampleCompanies[0] || 'PT GLOBAL MEAT INDONESIA',
        'KTP',
        '3172011205800001',
        '0012345678901234',
        'BBKHIT DKI Jakarta',
        'Impor',
        12,
        'Daging Sapi Beku, Daging Ayam',
        'Instalasi Karantina Hewan',
        'Milik Sendiri',
        'budi@globalmeat.co.id',
        'REG-JKT-2025-001',
        '2025-01-15',
        'Aktif',
      ],
      [
        2,
        'Siti Aminah',
        'PT',
        sampleCompanies[1] || 'PT PACIFIC SEAFOOD NUSANTARA',
        'KTP',
        '3173054809850002',
        '0023456789012345',
        'BBKHIT DKI Jakarta',
        'Ekspor',
        18,
        'Ikan Tuna Beku, Udang Vannamei',
        'Instalasi Karantina Ikan',
        'Milik Sendiri',
        'info@pacificseafood.id',
        'REG-JKT-2025-002',
        '2025-02-10',
        'Aktif',
      ],
      [
        3,
        'Hendra Wijaya',
        'PT',
        sampleCompanies[2] || 'PT AGRO PRIMA JAYA',
        'KTP',
        '3174082103780003',
        '0034567890123456',
        'BBKHIT DKI Jakarta',
        'Impor',
        9,
        'Biji Kopi, Kakao Kering',
        'Instalasi Karantina Tumbuhan',
        'Sewa',
        'hendra@agroprima.co.id',
        'REG-JKT-2025-003',
        '2025-03-05',
        'Aktif',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 16 },
      { wch: 30 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 28 },
      { wch: 26 },
      { wch: 18 },
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kontak Perusahaan');
    XLSX.writeFile(wb, `Template_Pemilik_Email_Perusahaan.${format}`);
  };

  const handleConfirmBulkContacts = async () => {
    if (!bulkParsedItems || !onBulkImportCompanyContacts) return;
    setIsSavingBulk(true);
    setBulkError(null);
    try {
      await onBulkImportCompanyContacts(bulkParsedItems);
      setBulkParsedItems(null);
      setBulkFileName(null);
      setBulkPasteText('');
      setIsBulkModalOpen(false);
    } catch (err: any) {
      setBulkError(err?.message || 'Gagal menyimpan data kontak perusahaan.');
    } finally {
      setIsSavingBulk(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 animate-fadeIn pb-12">
      {/* Left Sidebar: Applicant Selector */}
      <div className="lg:col-span-4 xl:col-span-3 glass-panel rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col max-h-[320px] lg:max-h-[820px]">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            Navigasi Profil Perusahaan
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Pilih Perusahaan Terdaftar</span>
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Total {allApplicants.length} Perusahaan Terdata</p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama perusahaan..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full min-h-[42px] glass-input text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium placeholder:text-slate-400"
          />
        </div>

        {/* Bulk Import Pemilik & Email Trigger */}
        {onBulkImportCompanyContacts && (
          <button
            type="button"
            onClick={() => {
              setBulkError(null);
              setIsBulkModalOpen(true);
            }}
            className="w-full min-h-[42px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 dark:from-indigo-500/20 dark:to-cyan-500/20 hover:from-indigo-500/25 hover:to-cyan-500/25 text-cyan-800 dark:text-cyan-200 border border-cyan-600/30 dark:border-cyan-400/30 text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
            <span>Impor Pemilik & Email (CSV/Excel)</span>
          </button>
        )}

        {/* Applicant List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredApplicantList.map((name) => {
            const isSelected = name.toLowerCase() === activeName.toLowerCase();
            const companyScore = getCompanyComplianceData(name);
            const tierBadge = getTierBadge(companyScore.tier);
            const meta = companyQuickMeta.get(name.toUpperCase());
            const catCount = meta ? meta.categories.size : 0;
            const actCount = meta ? meta.activities.size : 0;

            return (
              <button
                key={name}
                onClick={() => onSelectPemohonName(name)}
                className={`w-full min-h-[48px] text-left p-3 rounded-2xl transition-all flex items-center justify-between text-xs group ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-indigo-600/50 dark:to-slate-900/60 border border-indigo-500 dark:border-indigo-400/50 text-white shadow-md backdrop-blur-md'
                    : 'glass-sub hover:bg-white/75 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="space-y-1 pr-2 min-w-0">
                  <p className="font-bold tracking-tight truncate">{name}</p>
                  <div className="flex items-center flex-wrap gap-1">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : tierBadge.bg
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1 ${
                          isSelected ? 'bg-white' : tierBadge.indicator
                        }`}
                      />
                      {companyScore.tier} ({companyScore.currentScore})
                    </span>
                    {catCount > 1 && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                          isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {catCount} Kat
                      </span>
                    )}
                    {actCount > 1 && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                          isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30'
                        }`}
                      >
                        {actCount} Keg
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    isSelected ? 'text-white translate-x-0.5' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                  }`}
                />
              </button>
            );
          })}
          {filteredApplicantList.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">Pemohon tidak ditemukan</p>
          )}
        </div>
      </div>

      {/* Main Panel: Applicant Deep-Dive Profile */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-5">
        {profile ? (
          <>
            {/* Applicant Profile Header Bento Card */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
                      Entitas Pemohon Karantina
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/10 dark:bg-slate-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 dark:border-white/15 uppercase">
                      Terdaftar BBKHIT DKI Jakarta
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 dark:border-indigo-400/25 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight break-words">{profile.name}</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Profil Layanan & Histori Karantina BBKHIT DKI Jakarta
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onSaveCompanyContact && (
                    <button
                      type="button"
                      onClick={handleOpenContactModal}
                      className="min-h-[42px] inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-900/15 dark:border-white/20 transition-all active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
                      <span>Edit Pemilik & Email</span>
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onRunAIForApplicant(profile.name, profile.commodities[0] || 'Media Pembawa')
                    }
                    className="min-h-[42px] inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/30 transition-all active:scale-95 border border-indigo-400/30"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Analisis AI Profile</span>
                  </button>
                </div>
              </div>

              {/* Identitas Pemilik & Alamat Email Perusahaan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="glass-sub p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                        Pemilik Perusahaan
                      </span>
                      <p className={`text-xs font-bold truncate mt-0.5 ${profile.pemilik ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 italic'}`}>
                        {profile.pemilik || 'Belum diisi'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-sub p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                        Alamat Email Perusahaan
                      </span>
                      <p className={`text-xs font-bold truncate mt-0.5 ${profile.email ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400 italic'}`}>
                        {profile.email || 'Belum diisi'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Kegiatan & Multi-Kategori Interactive Filters */}
              <div className="space-y-2.5">
                {/* Filter Row 1: Pilihan Arus Kegiatan (Multi-Kegiatan) */}
                <div className="glass-sub p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center space-x-1.5 pl-1">
                    <span>Pilihan Arus Kegiatan:</span>
                  </span>
                  <div className="flex items-center flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTradeActivity('ALL')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedTradeActivity === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Semua ({Object.values(profile.tradeActivitiesBreakdown).reduce((a, b) => a + b, 0)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTradeActivity('IMPOR')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedTradeActivity === 'IMPOR'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Impor ({profile.tradeActivitiesBreakdown['IMPOR'] || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTradeActivity('EKSPOR')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedTradeActivity === 'EKSPOR'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Ekspor ({profile.tradeActivitiesBreakdown['EKSPOR'] || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTradeActivity('DOMESTIK MASUK')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedTradeActivity === 'DOMESTIK MASUK'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Domestik Masuk ({profile.tradeActivitiesBreakdown['DOMESTIK MASUK'] || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTradeActivity('DOMESTIK KELUAR')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedTradeActivity === 'DOMESTIK KELUAR'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Domestik Keluar ({profile.tradeActivitiesBreakdown['DOMESTIK KELUAR'] || 0})
                    </button>
                  </div>
                </div>

                {/* Filter Row 2: Pilihan Kategori Karantina (Multi-Kategori: Hewan, Ikan, Tumbuhan) */}
                <div className="glass-sub p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center space-x-1.5 pl-1">
                    <span>Kategori Karantina (Multi):</span>
                  </span>
                  <div className="flex items-center flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('ALL')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategoryFilter === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Semua Kategori ({Object.values(profile.categoriesBreakdown).reduce((a, b) => a + b, 0)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('HEWAN')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategoryFilter === 'HEWAN'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Hewan ({profile.categoriesBreakdown['HEWAN'] || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('IKAN')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategoryFilter === 'IKAN'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Ikan ({profile.categoriesBreakdown['IKAN'] || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('TUMBUHAN')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategoryFilter === 'TUMBUHAN'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-900/15 dark:border-slate-800'
                      }`}
                    >
                      Tumbuhan ({profile.categoriesBreakdown['TUMBUHAN'] || 0})
                    </button>
                  </div>
                </div>
              </div>

              {/* Top Metrics Row: Total Declarations, Multi-Kategori, Multi-Kegiatan, & Score */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-4 border-t border-slate-900/10 dark:border-white/10">

                {/* Total Declarations */}
                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Total Pengajuan
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {profile.totalDeclarations} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Record</span>
                  </p>
                  {(selectedTradeActivity !== 'ALL' || selectedCategoryFilter !== 'ALL') && (
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold block mt-1">
                      Terfilter dari {Object.values(profile.tradeActivitiesBreakdown).reduce((a, b) => a + b, 0)} total
                    </span>
                  )}
                </div>

                {/* Multi-Kategori Karantina (Hewan, Ikan, Tumbuhan) */}
                <div className="glass-sub p-4 rounded-2xl">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      Kategori Karantina
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                      {profile.categories.length} / 3 Bidang
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(['HEWAN', 'IKAN', 'TUMBUHAN'] as QuarantineCategory[]).map((cat) => {
                      const count = profile.categoriesBreakdown[cat] || 0;
                      const isActive = count > 0;
                      const isSelectedFilter = selectedCategoryFilter === cat;
                      const activeColor =
                        cat === 'HEWAN'
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35'
                          : cat === 'IKAN'
                          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35';

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setSelectedCategoryFilter(isSelectedFilter ? 'ALL' : cat)
                          }
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                            isActive
                              ? `${activeColor} ${isSelectedFilter ? 'ring-2 ring-indigo-500/50' : ''}`
                              : 'bg-slate-900/5 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-slate-900/10 dark:border-white/10'
                          }`}
                        >
                          {cat === 'HEWAN' ? 'Hewan' : cat === 'IKAN' ? 'Ikan' : 'Tumbuhan'} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-Kegiatan (Impor, Ekspor, Domestik Masuk, Domestik Keluar) */}
                <div className="glass-sub p-4 rounded-2xl">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      Lingkup Kegiatan
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                      {profile.tradeActivities.length} / 4 Arus
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(
                      ['IMPOR', 'EKSPOR', 'DOMESTIK MASUK', 'DOMESTIK KELUAR'] as TradeActivityType[]
                    ).map((act) => {
                      const count = profile.tradeActivitiesBreakdown[act] || 0;
                      const isActive = count > 0;
                      const isSelectedFilter = selectedTradeActivity === act;
                      const activeColor =
                        act === 'EKSPOR'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/35'
                          : act === 'DOMESTIK MASUK'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/35'
                          : act === 'DOMESTIK KELUAR'
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/35'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35';

                      return (
                        <button
                          key={act}
                          type="button"
                          onClick={() =>
                            setSelectedTradeActivity(isSelectedFilter ? 'ALL' : act)
                          }
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                            isActive
                              ? `${activeColor} ${isSelectedFilter ? 'ring-2 ring-indigo-500/50' : ''}`
                              : 'bg-slate-900/5 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-slate-900/10 dark:border-white/10'
                          }`}
                        >
                          {act} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Compliance Score & Risk Tier */}
                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Status Jalur Karantina
                  </span>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${currentTierBadge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${currentTierBadge.indicator}`} />
                      {currentTier}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 tabular-nums">
                      {currentScore} / 100
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SISTEM PENILAIAN & PENYESUAIAN SKOR KEPATUHAN PERUSAHAAN */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                      Sistem Penilaian Kepatuhan Profil Perusahaan
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Skor Kepatuhan & Jalur Risiko Karantina</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Sistem penilaian interaktif: pengurangan atau penambahan poin secara langsung mempengaruhi status jalur Hijau (Low), Kuning (Medium), atau Merah (High).
                  </p>
                </div>

                {/* Score Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenScoreModal('PENGURANGAN')}
                    className="min-h-[42px] inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/20 transition-all active:scale-95 border border-rose-400/30"
                    title="Catat pelanggaran / ketidaksesuaian yang menurunkan skor"
                  >
                    <MinusCircle className="w-4 h-4 text-rose-100" />
                    <span>[-] Kurangi Skor</span>
                  </button>

                  <button
                    onClick={() => handleOpenScoreModal('PENAMBAHAN')}
                    className="min-h-[42px] inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 transition-all active:scale-95 border border-emerald-400/30"
                    title="Berikan poin apresiasi kepatuhan / kelengkapan dokumen"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-100" />
                    <span>[+] Tambah Skor</span>
                  </button>

                  <button
                    onClick={() => setConfirmResetScore((prev) => !prev)}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center p-2 rounded-2xl bg-slate-900/5 dark:bg-slate-950 hover:bg-slate-900/10 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/15 dark:border-slate-800 transition-colors"
                    title="Reset skor ke 100 (Jalur Hijau)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {confirmResetScore && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <p className="text-amber-900 dark:text-amber-200 font-semibold">
                    Reset skor kepatuhan <strong>{activeName}</strong> kembali ke 100 (Jalur Hijau)?
                  </p>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmResetScore(false)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold border border-slate-900/15 dark:border-white/15"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmResetScore}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow"
                    >
                      Ya, Reset ke 100
                    </button>
                  </div>
                </div>
              )}

              {/* Large Visual Score Card */}
              <div className="glass-sub rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center space-x-4 sm:space-x-5">
                  <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border font-black shadow-inner shrink-0 ${currentTierBadge.bg}`}>
                    <span className="text-3xl tracking-tighter tabular-nums">{currentScore}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider -mt-1">/ 100</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${currentTierBadge.bg}`}>
                        {currentTierBadge.title}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        • Risiko: <span className="font-bold text-slate-900 dark:text-white">{effectiveRiskLevel}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-xl">
                      {currentTierBadge.desc}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown Bar */}
                <div className="w-full md:w-64 space-y-2 shrink-0">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <span>Meter Kepatuhan</span>
                    <span className="tabular-nums">{currentScore}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-900/60 rounded-full h-3 overflow-hidden p-0.5 border border-slate-900/10 dark:border-white/10 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${currentTierBadge.barColor}`}
                      style={{ width: `${Math.max(5, currentScore)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                    <span className="text-rose-700 dark:text-rose-400">0 Merah</span>
                    <span className="text-amber-700 dark:text-amber-400">50 Kuning</span>
                    <span className="text-emerald-700 dark:text-emerald-400">80 Hijau</span>
                    <span>100</span>
                  </div>
                </div>
              </div>

              {/* AUDIT TRAIL / RIWAYAT ALASAN */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Riwayat Alasan Pengurangan / Penambahan Skor ({complianceData?.logs.length || 0})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Tercatat permanen dalam sistem penilaian</span>
                </div>

                {complianceData && complianceData.logs.length > 0 ? (
                  <div className="glass-sub rounded-2xl overflow-hidden divide-y divide-slate-900/10 dark:divide-white/10 max-h-72 overflow-y-auto">
                    {complianceData.logs.map((log) => {
                      const isReduction = log.type === 'PENGURANGAN';
                      return (
                        <div key={log.id} className="p-3.5 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              isReduction ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                            }`}>
                              {isReduction ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono ${
                                  isReduction ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                                }`}>
                                  {log.points > 0 ? `+${log.points}` : log.points} Poin
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{log.reason}</span>
                                {log.referenceNo && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/80 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-slate-900/10 dark:border-slate-800">
                                    Ref: {log.referenceNo}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                  <span>{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center space-x-1">
                                  <UserCheck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                  <span>{log.officerName || 'Petugas Karantina'}</span>
                                </span>
                                <span>•</span>
                                <span>
                                  Dampak: <span className="font-bold text-slate-700 dark:text-slate-300">{log.previousScore}</span> ➔ <span className="font-bold text-slate-900 dark:text-white">{log.newScore} ({log.newTier})</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {confirmDeleteLogId === log.id ? (
                            <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLogId(null)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteLog(log.id)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
                              >
                                Hapus
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteLogId(log.id)}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 bg-white/80 dark:bg-slate-900 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 border border-slate-900/15 dark:border-slate-800 rounded-lg transition-colors shrink-0 self-end sm:self-center"
                              title="Hapus catatan riwayat ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-sub p-5 rounded-2xl text-center text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-300">Belum ada catatan pengurangan / penambahan skor</p>
                    <p className="text-[11px] text-slate-500">
                      Perusahaan memiliki catatan kepatuhan bersih di tingkat awal 100 poin (Jalur Hijau). Gunakan tombol "[-] Kurangi Skor" jika ditemukan ketidaksesuaian fisik atau pelanggaran dokumen.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Matrix Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Commodities Imported */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Daftar Media Pembawa
                  </span>
                  <span className="text-[10px] font-extrabold text-cyan-700 dark:text-cyan-400 uppercase">
                    {profile.commodities.length} Jenis
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Komoditas yang Dilalulintaskan</span>
                </h3>
                {profile.commodities.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.commodities.map((comm) => (
                      <button
                        key={comm}
                        onClick={() => onSelectCommodity(comm)}
                        className="min-h-[38px] group flex items-center space-x-1.5 bg-slate-50/90 dark:bg-slate-950/50 hover:bg-cyan-500/15 dark:hover:bg-cyan-950/70 text-slate-800 dark:text-slate-100 border border-slate-900/15 dark:border-white/15 hover:border-cyan-500/40 dark:hover:border-cyan-400/40 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all"
                      >
                        <span>{comm}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-cyan-700 dark:group-hover:text-cyan-300" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="glass-sub p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                    <span>Tidak ada komoditas untuk kombinasi filter saat ini.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTradeActivity('ALL');
                        setSelectedCategoryFilter('ALL');
                      }}
                      className="text-indigo-700 dark:text-indigo-300 font-bold underline shrink-0"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}
              </div>

              {/* Origin Countries */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Jaringan Asal / Tujuan
                  </span>
                  <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase">
                    {profile.origins.length} Negara/Daerah
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Globe2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Negara Asal / Tujuan Perdagangan</span>
                </h3>
                {profile.origins.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.origins.map((country) => (
                      <button
                        key={country}
                        onClick={() => onSelectCountry && onSelectCountry(country)}
                        title={`Buka Profil Negara ${country}`}
                        className="min-h-[38px] group bg-slate-50/90 dark:bg-slate-950/50 hover:bg-indigo-500/15 dark:hover:bg-indigo-950/70 text-slate-800 dark:text-slate-100 border border-slate-900/15 dark:border-white/15 hover:border-indigo-500/40 dark:hover:border-indigo-400/40 px-3 py-1.5 rounded-2xl text-xs font-semibold inline-flex items-center space-x-1.5 transition-all"
                      >
                        <Globe2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300" />
                        <span>{country}</span>
                        {onSelectCountry && (
                          <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="glass-sub p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada data negara untuk filter yang dipilih.
                  </p>
                )}
              </div>
            </div>

            {/* Inspection Sites & HS Codes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Inspection Sites */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Fasilitas Pemeriksaan
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Tempat Pemeriksaan ({profile.inspectionSites.length})</span>
                </h3>
                {profile.inspectionSites.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.inspectionSites.map((site) => (
                      <span
                        key={site}
                        className="bg-amber-500/10 dark:bg-slate-950/50 text-amber-800 dark:text-amber-300 border border-amber-500/25 dark:border-white/15 px-3 py-1.5 rounded-2xl text-xs font-semibold"
                      >
                        {site}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="glass-sub p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada tempat pemeriksaan untuk filter yang dipilih.
                  </p>
                )}
              </div>

              {/* HS Codes */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Klasifikasi Tarif / Harmonized System
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Kode HS Terdaftar ({profile.hsCodes.length})</span>
                </h3>
                {profile.hsCodes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {profile.hsCodes.map((code) => (
                      <span
                        key={code}
                        className="font-mono bg-indigo-500/10 dark:bg-slate-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 dark:border-white/15 px-3 py-1.5 rounded-2xl text-xs font-bold"
                      >
                        HS {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="glass-sub p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada Kode HS untuk filter yang dipilih.
                  </p>
                )}
              </div>
            </div>

            {/* Key Risk Factors & Protocols */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Rekomendasi Petugas Karantina
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Analisis Faktor Risiko & Protokol Pengawasan</span>
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Faktor Risiko Utama:</p>
                <div className="space-y-2">
                  {profile.keyRiskFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2.5 text-xs text-slate-800 dark:text-slate-200 glass-sub p-3 rounded-2xl"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <span className="font-medium">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Rekomendasi Tindakan Karantina:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.recommendedProtocols.map((proto, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2.5 text-xs text-slate-800 dark:text-slate-200 glass-sub p-3 rounded-2xl"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <span className="font-medium">{proto}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-600 dark:text-slate-300 font-medium">
            Pilih perusahaan di sebelah kiri untuk melihat profil risiko lengkap.
          </div>
        )}
      </div>

      {/* MODAL PENYESUAIAN SKOR */}
      {isScoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-modal rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 my-4 sm:my-6 max-h-[92dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-2xl border ${
                  actionType === 'PENGURANGAN'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                }`}>
                  {actionType === 'PENGURANGAN' ? <MinusCircle className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {actionType === 'PENGURANGAN' ? 'Form Pengurangan Skor Kepatuhan' : 'Form Penambahan Skor Kepatuhan'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">{activeName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsScoreModalOpen(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-900/10 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActionType('PENGURANGAN');
                    setSelectedPresetReason(PRESET_PENALTY_REASONS[0].reason);
                    setPointsInput(Math.abs(PRESET_PENALTY_REASONS[0].points));
                  }}
                  className={`min-h-[40px] py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    actionType === 'PENGURANGAN'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Pengurangan (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionType('PENAMBAHAN');
                    setSelectedPresetReason(PRESET_BONUS_REASONS[0].reason);
                    setPointsInput(PRESET_BONUS_REASONS[0].points);
                  }}
                  className={`min-h-[40px] py-2 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    actionType === 'PENAMBAHAN'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Penambahan (+)</span>
                </button>
              </div>

              {/* Points Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Besaran Poin Penyesuaian
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(actionType === 'PENGURANGAN' ? [5, 10, 15, 20, 30] : [5, 10, 15, 20, 25]).map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setPointsInput(pts)}
                      className={`min-h-[40px] py-2 rounded-xl border text-center font-black transition-all ${
                        pointsInput === pts
                          ? actionType === 'PENGURANGAN'
                            ? 'bg-rose-500/20 dark:bg-rose-950 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30'
                            : 'bg-emerald-500/20 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-900/15 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {actionType === 'PENGURANGAN' ? `-${pts}` : `+${pts}`}
                    </button>
                  ))}
                </div>
                <div className="pt-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={pointsInput}
                    onChange={(e) => setPointsInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                    placeholder="Input poin kustom..."
                  />
                </div>
              </div>

              {/* Preset Reason Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  {actionType === 'PENGURANGAN' ? 'Pilih Alasan Pengurangan Skor (Standar Karantina)' : 'Pilih Alasan Apresiasi Skor'}
                </label>
                <select
                  value={selectedPresetReason}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-xs"
                >
                  {(actionType === 'PENGURANGAN' ? PRESET_PENALTY_REASONS : PRESET_BONUS_REASONS).map((p) => (
                    <option key={p.reason} value={p.reason}>
                      [{p.category}] {p.reason} ({p.points > 0 ? `+${p.points}` : p.points})
                    </option>
                  ))}
                  <option value="CUSTOM">Lainnya / Alasan Kustom</option>
                </select>
              </div>

              {/* Detail / Custom Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Catatan Detail / Uraian Temuan Petugas
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Tambahkan keterangan temuan fisik, nomor petikemas, atau deskripsi kejadian spesifik..."
                  className="w-full glass-input rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Reference Number & Officer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">No. BAP / Surat Tugas</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Contoh: BAP-042/BBKHIT/2026"
                    className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Petugas Pemeriksa</label>
                  <input
                    type="text"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Live Impact Preview */}
              <div className={`p-3.5 rounded-2xl border space-y-1.5 ${
                simulatedNewTier === 'MERAH'
                  ? 'bg-rose-500/15 dark:bg-rose-950/40 border-rose-500/35 text-rose-800 dark:text-rose-200'
                  : simulatedNewTier === 'KUNING'
                  ? 'bg-amber-500/15 dark:bg-amber-950/40 border-amber-500/35 text-amber-800 dark:text-amber-200'
                  : 'bg-emerald-500/15 dark:bg-emerald-950/40 border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Simulasi Dampak Skor:</span>
                  <span>{currentScore} ➔ {simulatedNewScore} Poin</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Status Karantina Baru:</span>
                  <span className="font-black uppercase tracking-wider">
                    Jalur {simulatedNewTier} {simulatedNewTier === 'MERAH' ? '(High)' : simulatedNewTier === 'KUNING' ? '(Medium)' : '(Low)'}
                  </span>
                </div>
                {simulatedNewTier !== currentTier && (
                  <p className="text-[10px] font-semibold pt-1 border-t border-current/20">
                    Peringatan: Penyesuaian poin ini mengubah status kepatuhan dari {currentTier} ke {simulatedNewTier}.
                  </p>
                )}
              </div>

              {modalError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/35 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {modalError}
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsScoreModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`min-h-[44px] px-5 py-2 rounded-xl font-bold text-white shadow-lg transition-all ${
                    actionType === 'PENGURANGAN'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Simpan Penilaian Skor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PEMILIK & ALAMAT EMAIL PERUSAHAAN */}
      {isContactModalOpen && profile && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-modal rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 max-h-[92dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Pemilik & Email Perusahaan</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[230px]">{profile.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 border border-slate-900/10 dark:border-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleContact} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
                  <span>Pemilik Perusahaan / Direktur</span>
                </label>
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full min-h-[42px] glass-input rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                  <span>Alamat Email Perusahaan</span>
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Contoh: info@perusahaan.co.id"
                  className="w-full min-h-[42px] glass-input rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
                />
              </div>

              {contactError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/35 rounded-xl text-rose-700 dark:text-rose-200 text-xs">
                  {contactError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-900/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold border border-slate-900/10 dark:border-white/10"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold shadow-lg disabled:opacity-50"
                >
                  {isSavingContact ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPOR PEMILIK & ALAMAT EMAIL PERUSAHAAN (CSV / EXCEL) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-modal rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-4 sm:my-8 max-h-[92dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Impor Pemilik & Alamat Email Perusahaan
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Tambahkan atau perbarui data pemilik & email perusahaan secara massal via file CSV atau Excel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 border border-slate-900/10 dark:border-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher + Templates */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100/80 dark:bg-slate-950/50 p-2 rounded-2xl border border-slate-900/10 dark:border-white/10">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBulkTab('upload');
                    setBulkError(null);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    bulkTab === 'upload'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  Upload File (.csv / .xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTab('paste');
                    setBulkError(null);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    bulkTab === 'paste'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  Tempel Data (Copy-Paste)
                </button>
              </div>

              <div className="flex items-center space-x-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleDownloadContactTemplate('csv')}
                  className="min-h-[34px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-cyan-700 dark:text-cyan-300 border border-slate-900/15 dark:border-white/10 font-semibold"
                >
                  <Download className="w-3 h-3" />
                  <span>Template .csv</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadContactTemplate('xlsx')}
                  className="min-h-[34px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-emerald-700 dark:text-emerald-300 border border-slate-900/15 dark:border-white/10 font-semibold"
                >
                  <Download className="w-3 h-3" />
                  <span>Template .xlsx</span>
                </button>
              </div>
            </div>

            {!bulkParsedItems ? (
              bulkTab === 'upload' ? (
                <div
                  onClick={() => bulkFileRef.current?.click()}
                  className="border-2 border-dashed border-slate-900/20 dark:border-white/20 hover:border-cyan-500 dark:hover:border-cyan-400 bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-950/60 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-2.5"
                >
                  <input
                    ref={bulkFileRef}
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleBulkFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Klik untuk memilih file CSV / Excel</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Mendukung template lengkap 17 kolom (No s.d. Status Blokir). Kolom utama yang diambil:{' '}
                    <span className="text-cyan-700 dark:text-cyan-300 font-semibold">Nama Perusahaan</span>,{' '}
                    <span className="text-cyan-700 dark:text-cyan-300 font-semibold">Nama Pemohon / Pemilik</span>, dan{' '}
                    <span className="text-cyan-700 dark:text-cyan-300 font-semibold">Email</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                    placeholder={`Nama Pemohon,Nama Perusahaan,Email\nBudi Santoso,${allApplicants[0] || 'PT MITRA ABADI'},budi@mitraabadi.co.id`}
                    className="w-full glass-input rounded-2xl p-3.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleParseBulkPaste}
                    disabled={!bulkPasteText.trim()}
                    className="w-full min-h-[44px] py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
                  >
                    Proses Data Tempel
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-100/80 dark:bg-slate-950/50 p-3.5 rounded-2xl border border-slate-900/10 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {bulkParsedItems.length} Perusahaan Siap Diperbarui
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {bulkFileName ? `File: ${bulkFileName}` : 'Dari copy-paste data'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkParsedItems(null);
                      setBulkFileName(null);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-900/15 dark:border-white/10"
                  >
                    Pilih Ulang
                  </button>
                </div>

                <div className="border border-slate-900/10 dark:border-white/10 rounded-2xl overflow-hidden max-h-60 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-950/75 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Nama Perusahaan</th>
                        <th className="py-2.5 px-3">Pemilik</th>
                        <th className="py-2.5 px-3">Alamat Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/10 dark:divide-white/10 bg-white/70 dark:bg-slate-900/40">
                      {bulkParsedItems.slice(0, 50).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{item.companyName}</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-200">{item.pemilik || '-'}</td>
                          <td className="py-2 px-3 text-cyan-700 dark:text-cyan-300">{item.email || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-900/10 dark:border-white/10"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkContacts}
                    disabled={isSavingBulk}
                    className="min-h-[44px] inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg disabled:opacity-50"
                  >
                    {isSavingBulk ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simpan Pemilik & Email ({bulkParsedItems.length} Perusahaan)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {bulkError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/35 rounded-xl text-xs text-rose-700 dark:text-rose-200">
                {bulkError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
