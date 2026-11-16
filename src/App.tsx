import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ApplicantProfileView } from './components/ApplicantProfileView';
import { CommodityProfileView } from './components/CommodityProfileView';
import { CountryProfileView } from './components/CountryProfileView';
import { DataExplorerTable } from './components/DataExplorerTable';
import { SimulationModal } from './components/SimulationModal';
import { AIRiskAnalysisModal } from './components/AIRiskAnalysisModal';
import { AddRecordModal } from './components/AddRecordModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { ClearDataModal } from './components/ClearDataModal';
import { DataUpdateHistoryModal } from './components/DataUpdateHistoryModal';
import { DeduplicateCompaniesModal } from './components/DeduplicateCompaniesModal';
import { GooeyMenu } from './components/GooeyMenu';
import { UploadLogoModal } from './components/UploadLogoModal';
import { Layers } from 'lucide-react';
import {
  MediaPembawaRecord,
  QuarantineCategory,
  TradeActivityType,
  ActiveNavTab,
  DataUpdateLog,
  CompanyContactInfo,
  ThemeMode,
} from './types';
import { getCanonicalCompanyName } from './data/companyNormalizer';
import { hydrateComplianceScoresFromServer } from './data/complianceScores';
import { hydrateWatchlistsFromServer } from './data/watchlistData';

const STORAGE_KEY = 'quarantine_records_v5';
const THEME_STORAGE_KEY = 'qbiocheck_theme_v1';

function saveLocalRecordsSafely(recordsToSave: MediaPembawaRecord[]) {
  try {
    if (recordsToSave.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recordsToSave));
    }
  } catch (e) {
    // If browser localStorage 5MB quota is exceeded, remove stale cache so old snapshots never re-seed server
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }
}

export default function App() {
  // Master Records State with localStorage & Server Storage persistence
  const [records, setRecords] = useState<MediaPembawaRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse localStorage records:', e);
    }
    return [];
  });

  const [companyContacts, setCompanyContacts] = useState<Record<string, CompanyContactInfo>>({});

  // Server Version & Real-Time Sync Refs
  const serverVersionRef = useRef<number>(0);
  const syncInFlightRef = useRef<boolean>(false);
  const pendingResyncRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const applyServerStore = useCallback((serverStore: any) => {
    if (!serverStore || !isMountedRef.current) return;

    if (typeof serverStore.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, serverStore.version);
    }

    if (Array.isArray(serverStore.records)) {
      setRecords(serverStore.records);
      saveLocalRecordsSafely(serverStore.records);
    }

    if (serverStore.companyContacts && typeof serverStore.companyContacts === 'object') {
      setCompanyContacts(serverStore.companyContacts);
    }

    // Server is single source of truth across PC & smartphone
    hydrateComplianceScoresFromServer(serverStore.complianceScores);

    if (
      Array.isArray(serverStore.commodityWatchlist) ||
      Array.isArray(serverStore.countryWatchlist)
    ) {
      hydrateWatchlistsFromServer(
        Array.isArray(serverStore.commodityWatchlist) ? serverStore.commodityWatchlist : [],
        Array.isArray(serverStore.countryWatchlist) ? serverStore.countryWatchlist : []
      );
    }

    if (Array.isArray(serverStore.updateLogs)) {
      setUpdateLogs(serverStore.updateLogs);
    }

    if (serverStore.customLogo) {
      setCustomLogo(serverStore.customLogo);
      try {
        localStorage.setItem('custom_app_logo_v1', serverStore.customLogo);
      } catch (e) {}
    } else if ('customLogo' in serverStore) {
      setCustomLogo(null);
      try {
        localStorage.removeItem('custom_app_logo_v1');
      } catch (e) {}
    }
  }, []);

  const fetchFullServerData = useCallback(
    async (force = false) => {
      if (syncInFlightRef.current) {
        if (force) pendingResyncRef.current = true;
        return;
      }
      syncInFlightRef.current = true;
      try {
        const res = await fetch('/api/data', { cache: 'no-store' });
        if (res.ok) {
          const serverStore = await res.json();
          applyServerStore(serverStore);
        }
      } catch (err) {
        console.warn('Server data sync warning:', err);
      } finally {
        syncInFlightRef.current = false;
        if (pendingResyncRef.current && isMountedRef.current) {
          pendingResyncRef.current = false;
          void fetchFullServerData(false);
        }
      }
    },
    [applyServerStore]
  );

  const checkVersionAndSync = useCallback(async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const meta = await res.json();
      if (typeof meta?.version === 'number' && meta.version > serverVersionRef.current) {
        await fetchFullServerData(true);
      }
    } catch (err) {
      console.warn('Version check warning:', err);
    }
  }, [fetchFullServerData]);

  // Initial hydration + Real-Time WebSocket + visibility/focus/online reconciliation
  useEffect(() => {
    isMountedRef.current = true;
    void fetchFullServerData(false);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let closedByCleanup = false;

    const connectWebSocket = () => {
      if (closedByCleanup || typeof window === 'undefined') return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        retryDelay = 1000;
        try {
          ws?.send(JSON.stringify({ type: 'hello', version: serverVersionRef.current }));
        } catch (_) {}
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'connected' || msg?.type === 'store:updated') {
            const incomingVersion = Number(msg.version || 0);
            if (incomingVersion > serverVersionRef.current) {
              void fetchFullServerData(true);
            }
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (!closedByCleanup) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch (_) {}
      };
    };

    const scheduleReconnect = () => {
      if (closedByCleanup || reconnectTimer) return;
      const delay = retryDelay;
      retryDelay = Math.min(15000, Math.round(retryDelay * 1.6));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
      }, delay);
    };

    connectWebSocket();

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void checkVersionAndSync();
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        connectWebSocket();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMountedRef.current = false;
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch (_) {}
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchFullServerData, checkVersionAndSync]);

  // Keep localStorage aligned safely with current state
  useEffect(() => {
    saveLocalRecordsSafely(records);
  }, [records]);

  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<
    QuarantineCategory | 'ALL'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Profiling selections
  const [selectedPemohonName, setSelectedPemohonName] = useState<string>('');
  const [selectedCommodityName, setSelectedCommodityName] = useState<string>('');
  const [selectedCountryName, setSelectedCountryName] = useState<string>('');

  // Update default selected applicant / commodity / country when records change
  useEffect(() => {
    if (records.length > 0) {
      if (!selectedPemohonName || !records.some((r) => r.pemohon === selectedPemohonName)) {
        setSelectedPemohonName(records[0].pemohon);
      }
      if (!selectedCommodityName || !records.some((r) => r.komoditas === selectedCommodityName)) {
        setSelectedCommodityName(records[0].komoditas);
      }
      if (!selectedCountryName) {
        const firstOrigin = records[0].asal && records[0].asal.length > 0 ? records[0].asal[0] : 'INDIA';
        setSelectedCountryName(firstOrigin);
      }
    } else {
      setSelectedPemohonName('');
      setSelectedCommodityName('');
      setSelectedCountryName('INDIA');
    }
  }, [records]);

  // Modals state
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isUpdateHistoryOpen, setIsUpdateHistoryOpen] = useState(false);
  const [isDeduplicateOpen, setIsDeduplicateOpen] = useState(false);

  // Audit Log State
  const [updateLogs, setUpdateLogs] = useState<DataUpdateLog[]>([]);
  const [isGooeyOpen, setIsGooeyOpen] = useState(false);

  // Day Light / Night Theme State (persisted in localStorage, defaults to night)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'day' ? 'day' : 'night';
    } catch (e) {
      return 'night';
    }
  });

  useEffect(() => {
    const isNight = themeMode === 'night';
    document.documentElement.classList.toggle('dark', isNight);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch (e) {}
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === 'night' ? 'day' : 'night'));
  };

  // Custom Logo State & Manual Photo Upload
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('custom_app_logo_v1');
    } catch (e) {
      return null;
    }
  });
  const [isUploadLogoOpen, setIsUploadLogoOpen] = useState(false);

  const handleSaveLogo = async (logoDataUrl: string | null) => {
    setCustomLogo(logoDataUrl);
    if (logoDataUrl) {
      try {
        localStorage.setItem('custom_app_logo_v1', logoDataUrl);
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
    } else {
      try {
        localStorage.removeItem('custom_app_logo_v1');
      } catch (e) {
        console.warn('LocalStorage remove failed:', e);
      }
    }
    try {
      const res = await fetch('/api/custom-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: logoDataUrl }),
      });
      if (res.ok) {
        const result = await res.json();
        if (typeof result.version === 'number') {
          serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
        }
      }
    } catch (err) {
      console.error('Failed to sync custom logo to server:', err);
    }
  };

  // Category counts for the operational category bar
  const categoryCounts = useMemo(() => {
    let hewan = 0;
    let ikan = 0;
    let tumbuhan = 0;
    for (let i = 0; i < records.length; i++) {
      const k = records[i].kategori;
      if (k === 'HEWAN') hewan++;
      else if (k === 'IKAN') ikan++;
      else if (k === 'TUMBUHAN') tumbuhan++;
    }
    return {
      all: records.length,
      hewan,
      ikan,
      tumbuhan,
    };
  }, [records]);


  const [aiTarget, setAiTarget] = useState<{
    pemohon: string;
    komoditas: string;
    kategori?: QuarantineCategory;
    asal?: string;
    tempatPeriksa?: string;
    kodeHs?: string;
  }>({
    pemohon: 'PT SAMUDERA MANDIRI LOGISTIK',
    komoditas: 'Daging Sapi',
  });

  // Filtered dataset for global view
  const displayRecords = useMemo(() => {
    return records.filter((r) => {
      // Category filter
      if (selectedCategory !== 'ALL' && r.kategori !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPemohon = r.pemohon.toLowerCase().includes(q);
        const matchesKomoditas = r.komoditas.toLowerCase().includes(q);
        const matchesAsal = (r.asalRaw || '').toLowerCase().includes(q);
        const matchesSite = (r.tempatPeriksaRaw || '').toLowerCase().includes(q);
        const matchesHs = (r.kodeHsRaw || '').toLowerCase().includes(q);
        const matchesKegiatan = (r.jenisKegiatan || 'IMPOR').toLowerCase().includes(q);
        if (
          !matchesPemohon &&
          !matchesKomoditas &&
          !matchesAsal &&
          !matchesSite &&
          !matchesHs &&
          !matchesKegiatan
        ) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedCategory, searchQuery]);

  // Switch to applicant profile view
  const handleSelectApplicant = (pemohon: string) => {
    setSelectedPemohonName(pemohon);
    setActiveTab('applicant');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch to commodity profile view
  const handleSelectCommodity = (komoditas: string) => {
    setSelectedCommodityName(komoditas);
    setActiveTab('commodity');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch to country profile view
  const handleSelectCountry = (country: string) => {
    setSelectedCountryName(country);
    setActiveTab('country');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Launch AI Analysis
  const handleOpenAIForTarget = (
    pemohon: string,
    komoditas: string,
    kategori?: QuarantineCategory,
    asal?: string,
    tempatPeriksa?: string,
    kodeHs?: string
  ) => {
    setAiTarget({
      pemohon,
      komoditas,
      kategori,
      asal,
      tempatPeriksa,
      kodeHs,
    });
    setIsAIModalOpen(true);
  };

  const handleOpenAIForRecord = (record: MediaPembawaRecord) => {
    handleOpenAIForTarget(
      record.pemohon,
      record.komoditas,
      record.kategori,
      record.asalRaw,
      record.tempatPeriksaRaw,
      record.kodeHsRaw
    );
  };

  // Dedicated Deduplication & Unification of Company Names (PT / Non-PT)
  const handleDeduplicateCompanies = async () => {
    const res = await fetch('/api/records/deduplicate-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal melakukan deduplikasi di server.');
    }
    const data = await res.json();
    if (typeof data.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
    }
    if (Array.isArray(data.records)) {
      setRecords(data.records);
      saveLocalRecordsSafely(data.records);
    }
    if (data.companyContacts && typeof data.companyContacts === 'object') {
      setCompanyContacts(data.companyContacts);
    }
    if (data.complianceScores) {
      hydrateComplianceScoresFromServer(data.complianceScores);
    }
    if (Array.isArray(data.updateLogs)) {
      setUpdateLogs(data.updateLogs);
    } else if (data.log) {
      setUpdateLogs((prev) => [data.log, ...prev]);
    }
    return {
      mergedDuplicatesCount: data.mergedDuplicatesCount || 0,
      unifiedCompanyGroupsCount: data.unifiedCompanyGroupsCount || 0,
      sampleMerged: data.sampleMerged || [],
    };
  };

  // Add a single record via /api/records/append so prior uploaded data is persisted on server
  const handleAddRecord = async (newRecord: MediaPembawaRecord) => {
    const canonicalComp = getCanonicalCompanyName(newRecord.pemohon);
    const normalizedRecord: MediaPembawaRecord = {
      ...newRecord,
      pemohon: canonicalComp,
    };

    const res = await fetch('/api/records/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [normalizedRecord],
        actionType: 'TAMBAH_DATA',
        title: `Tambah Transaksi: ${canonicalComp}`,
        description: `Menambahkan deklarasi komoditas ${newRecord.komoditas} (${newRecord.kategori}) untuk perusahaan ${canonicalComp}.`,
        officerName: 'Petugas BBKHIT DKI Jakarta',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan data transaksi ke penyimpanan server.');
    }

    const result = await res.json();
    if (typeof result.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
    }
    if (Array.isArray(result.records)) {
      setRecords(result.records);
      saveLocalRecordsSafely(result.records);
    }
    if (Array.isArray(result.updateLogs)) {
      setUpdateLogs(result.updateLogs);
    }
    if (result.companyContacts) {
      setCompanyContacts(result.companyContacts);
    }
  };

  // Import records from Excel - appends cleanly onto server without resetting previously uploaded data
  const handleImportRecords = async (newRecords: MediaPembawaRecord[]) => {
    const processedNew = newRecords.map((newR, idx) => {
      const canonicalComp = getCanonicalCompanyName(newR.pemohon);
      return {
        ...newR,
        id: newR.id || `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        pemohon: canonicalComp,
        kategori: newR.kategori,
      };
    });

    const res = await fetch('/api/records/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: processedNew,
        actionType: 'IMPOR_EXCEL',
        title: `Impor Excel: ${processedNew.length} Baris Data Berhasil Masuk`,
        description: `Berhasil menambahkan ${processedNew.length} baris data transaksi Excel ke dalam sistem Q-BIOCHECK tanpa mereset data sebelumnya.`,
        officerName: 'Petugas BBKHIT DKI Jakarta',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan data ke server.');
    }

    const result = await res.json();
    if (typeof result.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
    }
    if (Array.isArray(result.records)) {
      setRecords(result.records);
      saveLocalRecordsSafely(result.records);
    }
    if (Array.isArray(result.updateLogs)) {
      setUpdateLogs(result.updateLogs);
    }
    if (result.companyContacts) {
      setCompanyContacts(result.companyContacts);
    }
  };

  // Selective Clear data permanently from server with passcode authorization
  const handleSelectiveClear = async (
    activity: TradeActivityType | 'ALL',
    category: QuarantineCategory | 'ALL',
    passcode: string
  ) => {
    const res = await fetch('/api/records/clear-selective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, category, passcode }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Kode sandi penghapusan salah atau gagal menghapus data.');
    }

    const result = await res.json();
    if (typeof result.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
    }
    if (Array.isArray(result.records)) {
      setRecords(result.records);
      saveLocalRecordsSafely(result.records);
    }
    if (Array.isArray(result.updateLogs)) {
      setUpdateLogs(result.updateLogs);
    }
  };

  // Save single company owner & email
  const handleSaveCompanyContact = async (
    companyName: string,
    pemilik: string,
    email: string
  ) => {
    const res = await fetch('/api/company-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, pemilik, email }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan data pemilik & email perusahaan.');
    }
    const result = await res.json();
    if (typeof result.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
    }
    if (result.companyContacts) {
      setCompanyContacts(result.companyContacts);
    }
    if (Array.isArray(result.records)) {
      setRecords(result.records);
      saveLocalRecordsSafely(result.records);
    }
    if (Array.isArray(result.updateLogs)) {
      setUpdateLogs(result.updateLogs);
    }
  };

  // Bulk import company owner & email via CSV / Excel
  const handleBulkImportCompanyContacts = async (
    items: Array<{ companyName: string; pemilik: string; email: string }>
  ) => {
    const res = await fetch('/api/company-contacts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal mengimpor data pemilik & email perusahaan.');
    }
    const result = await res.json();
    if (typeof result.version === 'number') {
      serverVersionRef.current = Math.max(serverVersionRef.current, result.version);
    }
    if (result.companyContacts) {
      setCompanyContacts(result.companyContacts);
    }
    if (Array.isArray(result.records)) {
      setRecords(result.records);
      saveLocalRecordsSafely(result.records);
    }
    if (Array.isArray(result.updateLogs)) {
      setUpdateLogs(result.updateLogs);
    }
  };


  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen relative text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white dark:selection:text-slate-950 flex flex-col overflow-x-hidden transition-colors duration-200">
      {/* Fixed Container Port Reflection Wallpaper Background */}
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage:
            "url('/assets/aistudio/HD-wallpaper-reflection-colors-container-containers-miami-water_6b3a1a92.jpg')",
        }}
        aria-hidden="true"
      />
      {/* Dual-Theme Balanced Translucent Scrim for High Contrast Glassmorphism */}
      <div
        className="fixed inset-0 -z-10 bg-gradient-to-b from-sky-100/35 via-white/22 to-cyan-100/40 dark:from-slate-950/75 dark:via-slate-950/65 dark:to-slate-950/80 backdrop-blur-[2px] transition-colors duration-300"
        aria-hidden="true"
      />

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenAIAnalysis={() => {
          setAiTarget({
            pemohon: selectedPemohonName || 'PT SAMUDERA MANDIRI LOGISTIK',
            komoditas: selectedCommodityName || 'Daging Sapi',
          });
          setIsAIModalOpen(true);
        }}
        onToggleGooeyMenu={() => setIsGooeyOpen((prev) => !prev)}
        isGooeyOpen={isGooeyOpen}
        onResetFilters={handleResetFilters}
        totalRecordsCount={records.length}
        customLogo={customLogo}
        onOpenUploadLogo={() => setIsUploadLogoOpen(true)}
        themeMode={themeMode}
        onSelectThemeMode={setThemeMode}
      />

      {/* Pilihan Kategori Operasional Karantina (Ditaruh tepat di atas kategori operasional) */}
      <section className="max-w-[1860px] w-full mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3 sm:pt-4 pb-1">
        <div className="glass-panel rounded-2xl p-3 sm:px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 dark:border-indigo-400/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shadow-inner shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                  Kategori Operasional Karantina
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/8 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold border border-slate-900/10 dark:border-white/10">
                  {selectedCategory === 'ALL' ? 'Semua Ditampilkan' : `Filter: ${selectedCategory}`}
                </span>
              </div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Klasifikasi Komoditas Media Pembawa BBKHIT DKI Jakarta
              </h2>
            </div>
          </div>

          {/* Category Tabs: Semua, Hewan, Ikan, Tumbuhan (Tanpa angka, tanpa tanda kurung) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2">
            {/* SEMUA */}
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-500 dark:border-indigo-400/60 shadow-lg shadow-indigo-900/20 dark:shadow-indigo-950/60 scale-[1.01]'
                  : 'bg-slate-100/80 dark:bg-slate-950/45 text-slate-700 dark:text-slate-200 border-slate-900/10 dark:border-white/10 hover:border-indigo-400/50 hover:bg-indigo-50 dark:hover:bg-slate-900/60 hover:text-indigo-800 dark:hover:text-white'
              }`}
            >
              Semua
            </button>

            {/* HEWAN */}
            <button
              type="button"
              onClick={() => setSelectedCategory('HEWAN')}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                selectedCategory === 'HEWAN'
                  ? 'bg-amber-600 text-white border-amber-500 dark:border-amber-400/60 shadow-lg shadow-amber-900/20 dark:shadow-amber-950/60 scale-[1.01]'
                  : 'bg-slate-100/80 dark:bg-slate-950/45 text-amber-800 dark:text-amber-200/90 border-amber-500/25 hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-950/35 hover:text-amber-900 dark:hover:text-amber-100'
              }`}
            >
              Hewan
            </button>

            {/* IKAN */}
            <button
              type="button"
              onClick={() => setSelectedCategory('IKAN')}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                selectedCategory === 'IKAN'
                  ? 'bg-cyan-600 text-white border-cyan-500 dark:border-cyan-400/60 shadow-lg shadow-cyan-900/20 dark:shadow-cyan-950/60 scale-[1.01]'
                  : 'bg-slate-100/80 dark:bg-slate-950/45 text-cyan-800 dark:text-cyan-200/90 border-cyan-500/25 hover:border-cyan-500/50 hover:bg-cyan-50 dark:hover:bg-cyan-950/35 hover:text-cyan-900 dark:hover:text-cyan-100'
              }`}
            >
              Ikan
            </button>

            {/* TUMBUHAN */}
            <button
              type="button"
              onClick={() => setSelectedCategory('TUMBUHAN')}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                selectedCategory === 'TUMBUHAN'
                  ? 'bg-emerald-600 text-white border-emerald-500 dark:border-emerald-400/60 shadow-lg shadow-emerald-900/20 dark:shadow-emerald-950/60 scale-[1.01]'
                  : 'bg-slate-100/80 dark:bg-slate-950/45 text-emerald-800 dark:text-emerald-200/90 border-emerald-500/25 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/35 hover:text-emerald-900 dark:hover:text-emerald-100'
              }`}
            >
              Tumbuhan
            </button>
          </div>
        </div>
      </section>

      {/* Main Workspace Body (Full Screen 1920x1080 PC fit + Smartphone friendly gutters) */}
      <main className="flex-1 max-w-[1860px] w-full mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 py-4 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            data={displayRecords}
            onSelectApplicant={handleSelectApplicant}
            onSelectCommodity={handleSelectCommodity}
            onOpenAIAnalysis={() => {
              setAiTarget({
                pemohon: selectedPemohonName || 'PT SAMUDERA MANDIRI LOGISTIK',
                komoditas: selectedCommodityName || 'Daging Sapi',
              });
              setIsAIModalOpen(true);
            }}
            onOpenImportModal={() => setIsExcelImportOpen(true)}
            onOpenAddRecord={() => setIsAddRecordOpen(true)}
            themeMode={themeMode}
          />
        )}

        {activeTab === 'applicant' && (
          <ApplicantProfileView
            data={displayRecords}
            selectedPemohonName={selectedPemohonName}
            onSelectPemohonName={setSelectedPemohonName}
            onSelectCommodity={handleSelectCommodity}
            onSelectCountry={handleSelectCountry}
            onRunAIForApplicant={(pemohon, komoditas) =>
              handleOpenAIForTarget(pemohon, komoditas)
            }
            companyContacts={companyContacts}
            onSaveCompanyContact={handleSaveCompanyContact}
            onBulkImportCompanyContacts={handleBulkImportCompanyContacts}
          />
        )}

        {activeTab === 'commodity' && (
          <CommodityProfileView
            data={displayRecords}
            selectedCommodityName={selectedCommodityName}
            onSelectCommodityName={setSelectedCommodityName}
            onSelectApplicant={handleSelectApplicant}
            onSelectCountry={handleSelectCountry}
            onRunAIForCommodity={(komoditas) =>
              handleOpenAIForTarget(selectedPemohonName, komoditas)
            }
          />
        )}

        {activeTab === 'country' && (
          <CountryProfileView
            data={displayRecords}
            selectedCountryName={selectedCountryName}
            onSelectCountryName={setSelectedCountryName}
            onSelectApplicant={handleSelectApplicant}
            onSelectCommodity={handleSelectCommodity}
          />
        )}

        {activeTab === 'table' && (
          <DataExplorerTable
            data={displayRecords}
            onSelectApplicant={handleSelectApplicant}
            onSelectCommodity={handleSelectCommodity}
            onSelectCountry={handleSelectCountry}
            onRunAI={handleOpenAIForRecord}
            onOpenImportModal={() => setIsExcelImportOpen(true)}
          />
        )}

      </main>

      {/* Glassy Footer */}
      <footer className="glass-header border-t py-4 text-center text-xs text-slate-700 dark:text-slate-300 mt-auto">
        <div className="max-w-[1860px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-semibold">© {new Date().getFullYear()} Q-BIOCHECK • BBKHIT DKI Jakarta</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Sistem Profiling Media Pembawa Karantina • Ekspor, Impor & Domestik • BBKHIT DKI Jakarta
          </p>
        </div>
      </footer>

      {/* Modals */}
      <SimulationModal
        data={records}
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        onSaveNewRecord={handleAddRecord}
        onRunAIRiskAnalysis={(
          pemohon,
          komoditas,
          kategori,
          asal,
          tempatPeriksa,
          kodeHs
        ) => {
          setIsSimulationOpen(false);
          handleOpenAIForTarget(
            pemohon,
            komoditas,
            kategori,
            asal,
            tempatPeriksa,
            kodeHs
          );
        }}
      />

      <AIRiskAnalysisModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        pemohon={aiTarget.pemohon}
        komoditas={aiTarget.komoditas}
        kategori={aiTarget.kategori}
        asal={aiTarget.asal}
        tempatPeriksa={aiTarget.tempatPeriksa}
        kodeHs={aiTarget.kodeHs}
      />

      <AddRecordModal
        isOpen={isAddRecordOpen}
        onClose={() => setIsAddRecordOpen(false)}
        onAddRecord={handleAddRecord}
        nextNo={records.length + 1}
      />

      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImportRecords={handleImportRecords}
        currentCount={records.length}
      />

      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        records={records}
        onConfirmClear={handleSelectiveClear}
      />

      <DataUpdateHistoryModal
        isOpen={isUpdateHistoryOpen}
        onClose={() => setIsUpdateHistoryOpen(false)}
        logs={updateLogs}
      />

      <DeduplicateCompaniesModal
        isOpen={isDeduplicateOpen}
        onClose={() => setIsDeduplicateOpen(false)}
        onConfirmDeduplicate={handleDeduplicateCompanies}
        totalRecordsCount={records.length}
        uniqueCompaniesCount={new Set(records.map((r) => r.pemohon)).size}
      />

      {/* Upload Logo Modal */}
      <UploadLogoModal
        isOpen={isUploadLogoOpen}
        onClose={() => setIsUploadLogoOpen(false)}
        currentLogo={customLogo}
        onSaveLogo={handleSaveLogo}
      />

      {/* Floating Action Menu (Operasional) */}
      <GooeyMenu
        isOpenControlled={isGooeyOpen}
        onToggleControlled={setIsGooeyOpen}
        onOpenUpdateHistory={() => setIsUpdateHistoryOpen(true)}
        onOpenDeduplicate={() => setIsDeduplicateOpen(true)}
        onOpenImportExcel={() => setIsExcelImportOpen(true)}
        onOpenAddRecord={() => setIsAddRecordOpen(true)}
        onOpenSimulation={() => setIsSimulationOpen(true)}
        onOpenUploadLogo={() => setIsUploadLogoOpen(true)}
        onClearAllData={() => setIsClearModalOpen(true)}
        totalRecordsCount={records.length}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
}
