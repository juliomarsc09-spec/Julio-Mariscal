import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ApplicantProfileView } from './components/ApplicantProfileView';
import { CommodityProfileView } from './components/CommodityProfileView';
import { CountryProfileView } from './components/CountryProfileView';
import { CompanyRegistryView } from './components/CompanyRegistryView';
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
import { MenuAksiPasscodeModal } from './components/MenuAksiPasscodeModal';
import { Layers, AlertCircle, X } from 'lucide-react';
import {
  MediaPembawaRecord,
  QuarantineCategory,
  TradeActivityType,
  ActiveNavTab,
  DataUpdateLog,
  CompanyContactInfo,
  ThemeMode,
} from './types';
import {
  extractCompanyCoreName,
  getCanonicalCompanyName,
  mergeDelimitedLists,
  accumulateFrequency,
} from './data/companyNormalizer';
import {
  getAllComplianceScores,
  hydrateComplianceScoresFromServer,
} from './data/complianceScores';
import {
  getAllWatchlistCommodities,
  getAllWatchlistCountries,
  hydrateWatchlistsFromServer,
} from './data/watchlistData';
import { getSharedActorId } from './firebase';
import {
  FullCloudSnapshot,
  fetchFullCloudHydrationSnapshot,
  fetchCloudMetaVersionOnly,
  fetchAllShardsFromFirestore,
  fetchContactsFromFirestore,
  seedCloudIfEmpty,
  subscribeToSharedCloudStore,
  saveRecordsShardsToFirestore,
  saveBrandingToFirestore,
  saveWatchlistsToFirestore,
  saveComplianceToFirestore,
  saveContactsToFirestore,
  saveLogsToFirestore,
  isFirestoreQuotaError,
} from './services/firestoreStore';
import { UploadProgressCallback, formatUploadErrorMessage } from './utils/uploadWithProgress';

const STORAGE_KEY = 'quarantine_records_v5';
const THEME_STORAGE_KEY = 'qbiocheck_theme_v1';
let quotaNoticeShownOnce = false;

async function syncRecordsToServerInChunks(
  recordsToSync: MediaPembawaRecord[],
  log?: DataUpdateLog
): Promise<void> {
  const CHUNK_SIZE = 450;
  try {
    if (recordsToSync.length === 0) {
      await fetch('/api/records/sync-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [], chunkIndex: 0, totalChunks: 1, log }),
      });
      return;
    }

    const totalChunks = Math.ceil(recordsToSync.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const chunk = recordsToSync.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const res = await fetch('/api/records/sync-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: chunk,
          chunkIndex: i,
          totalChunks,
          ...(i === totalChunks - 1 && log ? { log } : {}),
        }),
      });
      if (!res.ok) break;
    }
  } catch {
    // Non-fatal fallback mirror; Cloud Firestore holds authoritative state
  }
}

async function syncContactsBulkToServerInChunks(items: Array<Record<string, any>>): Promise<void> {
  const CHUNK_SIZE = 200;
  try {
    const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const slice = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const res = await fetch('/api/company-contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: slice,
          slim: true,
          skipLog: i > 0,
          skipDiskWrite: i < totalChunks - 1,
        }),
      });
      if (!res.ok) break;
    }
  } catch {
    // Non-fatal fallback mirror; Cloud Firestore holds authoritative state
  }
}

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

  // Audit Log & Theme & Custom Logo declared early so hooks & refs stay organized
  const [updateLogs, setUpdateLogs] = useState<DataUpdateLog[]>([]);
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('custom_app_logo_v1');
    } catch (e) {
      return null;
    }
  });

  // Firebase Cloud Unified Persistence State (No Login Required across AI Studio & Published)
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const cloudNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const shardVersionRef = useRef<number>(0);
  const cloudHydratedRef = useRef<boolean>(false);
  const recordsRef = useRef<MediaPembawaRecord[]>(records);
  const companyContactsRef = useRef<Record<string, CompanyContactInfo>>(companyContacts);
  const updateLogsRef = useRef<DataUpdateLog[]>(updateLogs);
  const customLogoRef = useRef<string | null>(customLogo);

  recordsRef.current = records;
  companyContactsRef.current = companyContacts;
  updateLogsRef.current = updateLogs;
  customLogoRef.current = customLogo;

  const dismissCloudNotice = useCallback(() => {
    if (cloudNoticeTimerRef.current) {
      clearTimeout(cloudNoticeTimerRef.current);
      cloudNoticeTimerRef.current = null;
    }
    setCloudNotice(null);
  }, []);

  const showCloudNotice = useCallback((rawErrOrMsg: unknown) => {
    if (!isMountedRef.current) return;

    if (isFirestoreQuotaError(rawErrOrMsg)) {
      if (quotaNoticeShownOnce) {
        return;
      }
      quotaNoticeShownOnce = true;

      if (cloudNoticeTimerRef.current) {
        clearTimeout(cloudNoticeTimerRef.current);
      }
      setCloudNotice(
        'Kuota harian pembacaan Cloud Firestore (Free Tier) telah mencapai batas dan akan reset besok. Aplikasi tetap berjalan dengan data cadangan lokal & server.'
      );
      cloudNoticeTimerRef.current = setTimeout(() => {
        cloudNoticeTimerRef.current = null;
        if (isMountedRef.current) {
          setCloudNotice(null);
        }
      }, 5000);
      return;
    }

    const formatted = formatUploadErrorMessage(
      rawErrOrMsg,
      'Terjadi gangguan sinkronisasi Cloud Firestore.'
    );
    setCloudNotice(formatted);
  }, []);

  const applyServerStore = useCallback((serverStore: any) => {
    if (!serverStore || !isMountedRef.current) return;

    if (Array.isArray(serverStore.records)) {
      recordsRef.current = serverStore.records;
      setRecords(serverStore.records);
      saveLocalRecordsSafely(serverStore.records);
    }

    if (serverStore.companyContacts && typeof serverStore.companyContacts === 'object') {
      companyContactsRef.current = serverStore.companyContacts;
      setCompanyContacts(serverStore.companyContacts);
    }

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
      updateLogsRef.current = serverStore.updateLogs;
      setUpdateLogs(serverStore.updateLogs);
    }

    if (serverStore.customLogo) {
      customLogoRef.current = serverStore.customLogo;
      setCustomLogo(serverStore.customLogo);
      try {
        localStorage.setItem('custom_app_logo_v1', serverStore.customLogo);
      } catch (e) {}
    } else if (!customLogoRef.current) {
      try {
        const localSaved = localStorage.getItem('custom_app_logo_v1');
        if (localSaved) {
          customLogoRef.current = localSaved;
          setCustomLogo(localSaved);
        }
      } catch (e) {}
    }
  }, []);

  const applyCloudSnapshot = useCallback((snap: FullCloudSnapshot) => {
    if (!snap || !isMountedRef.current) return;

    shardVersionRef.current = Math.max(shardVersionRef.current, snap.meta.shardVersion);
    cloudHydratedRef.current = true;

    recordsRef.current = snap.records;
    setRecords(snap.records);
    saveLocalRecordsSafely(snap.records);

    if (snap.hasContactsDoc) {
      companyContactsRef.current = snap.companyContacts;
      setCompanyContacts(snap.companyContacts);
    }

    if (snap.hasComplianceDoc) {
      hydrateComplianceScoresFromServer(snap.complianceScores);
    }

    if (snap.hasWatchlistsDoc) {
      hydrateWatchlistsFromServer(snap.commodityWatchlist, snap.countryWatchlist);
    }

    if (snap.hasLogsDoc) {
      updateLogsRef.current = snap.updateLogs;
      setUpdateLogs(snap.updateLogs);
    }

    if (snap.hasBrandingDoc) {
      if (snap.customLogo) {
        customLogoRef.current = snap.customLogo;
        setCustomLogo(snap.customLogo);
        try {
          localStorage.setItem('custom_app_logo_v1', snap.customLogo);
        } catch (e) {}
      } else {
        customLogoRef.current = null;
        setCustomLogo(null);
        try {
          localStorage.removeItem('custom_app_logo_v1');
        } catch (e) {}
      }
    }
  }, []);

  // Reconcile latest Cloud Firestore state before any mutation so stale tabs or restarted containers
  // NEVER overwrite newer records added in Google AI Studio or the Published app.
  const syncLatestCloudBeforeMutation = useCallback(async () => {
    try {
      const latestMeta = await fetchCloudMetaVersionOnly();
      if (latestMeta) {
        if (!cloudHydratedRef.current || latestMeta.shardVersion > shardVersionRef.current) {
          const [latestRecords, latestContactsRes] = await Promise.all([
            fetchAllShardsFromFirestore(latestMeta.shardCount),
            fetchContactsFromFirestore(),
          ]);
          shardVersionRef.current = latestMeta.shardVersion;
          cloudHydratedRef.current = true;
          recordsRef.current = latestRecords;
          setRecords(latestRecords);
          saveLocalRecordsSafely(latestRecords);
          if (latestContactsRes.exists) {
            companyContactsRef.current = latestContactsRes.contacts;
            setCompanyContacts(latestContactsRes.contacts);
          }
        }
      } else if (recordsRef.current.length === 0) {
        const res = await fetch('/api/data', { cache: 'no-store' });
        if (res.ok) {
          const serverStore = await res.json();
          applyServerStore(serverStore);
        }
      }
    } catch (err) {
      console.warn('Pre-mutation cloud sync check warning:', err);
    }
  }, [applyServerStore]);

  // Unified No-Login Cloud Firestore Bootstrap & Live Subscription (AI Studio <-> Published)
  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    let unsubCloud: (() => void) | null = null;

    const attachCloudSubscription = (initialVersion: number) => {
      if (cancelled) return;
      unsubCloud = subscribeToSharedCloudStore(
        {
          onMetaChanged: (meta, cloudRecords) => {
            if (cancelled) return;
            shardVersionRef.current = Math.max(shardVersionRef.current, meta.shardVersion);
            cloudHydratedRef.current = true;
            recordsRef.current = cloudRecords;
            setRecords(cloudRecords);
            saveLocalRecordsSafely(cloudRecords);
          },
          onBrandingChanged: (logo) => {
            if (cancelled) return;
            if (logo) {
              customLogoRef.current = logo;
              setCustomLogo(logo);
              try {
                localStorage.setItem('custom_app_logo_v1', logo);
              } catch (e) {}
            } else {
              customLogoRef.current = null;
              setCustomLogo(null);
              try {
                localStorage.removeItem('custom_app_logo_v1');
              } catch (e) {}
            }
          },
          onWatchlistsChanged: (commodities, countries) => {
            if (cancelled) return;
            hydrateWatchlistsFromServer(commodities, countries);
          },
          onComplianceChanged: (scores) => {
            if (cancelled) return;
            hydrateComplianceScoresFromServer(scores);
          },
          onContactsChanged: (contacts) => {
            if (cancelled) return;
            companyContactsRef.current = contacts;
            setCompanyContacts(contacts);
          },
          onLogsChanged: (logs) => {
            if (cancelled) return;
            updateLogsRef.current = logs;
            setUpdateLogs(logs);
          },
          onError: (err) => {
            if (!cancelled) {
              showCloudNotice(err);
            }
          },
        },
        initialVersion
      );
    };

    (async () => {
      try {
        // 1. Always check authoritative Cloud Firestore FIRST (no login required)
        const existingCloud = await fetchFullCloudHydrationSnapshot();
        if (cancelled) return;

        if (existingCloud) {
          applyCloudSnapshot(existingCloud);
          attachCloudSubscription(existingCloud.meta.shardVersion);
          return;
        }

        // 2. Cloud not yet seeded: load baseline from local Express server and seed Cloud once
        const res = await fetch('/api/data', { cache: 'no-store' });
        let serverStore: any = null;
        if (res.ok && !cancelled) {
          serverStore = await res.json();
          applyServerStore(serverStore);
        }
        if (cancelled) return;

        const actorId = getSharedActorId();
        await seedCloudIfEmpty(actorId, {
          records: Array.isArray(serverStore?.records) ? serverStore.records : recordsRef.current,
          customLogo: serverStore?.customLogo || customLogoRef.current || null,
          commodityWatchlist: Array.isArray(serverStore?.commodityWatchlist)
            ? serverStore.commodityWatchlist
            : getAllWatchlistCommodities(),
          countryWatchlist: Array.isArray(serverStore?.countryWatchlist)
            ? serverStore.countryWatchlist
            : getAllWatchlistCountries(),
          complianceScores:
            serverStore?.complianceScores && typeof serverStore.complianceScores === 'object'
              ? serverStore.complianceScores
              : getAllComplianceScores(),
          companyContacts:
            serverStore?.companyContacts && typeof serverStore.companyContacts === 'object'
              ? serverStore.companyContacts
              : companyContactsRef.current,
          updateLogs: Array.isArray(serverStore?.updateLogs)
            ? serverStore.updateLogs
            : updateLogsRef.current,
        });
        if (cancelled) return;

        const seededSnapshot = await fetchFullCloudHydrationSnapshot();
        if (seededSnapshot && !cancelled) {
          applyCloudSnapshot(seededSnapshot);
          attachCloudSubscription(seededSnapshot.meta.shardVersion);
        } else {
          attachCloudSubscription(-1);
        }
      } catch (err: any) {
        console.warn('Cloud bootstrap fallback warning:', err);
        if (!cancelled) {
          // Graceful offline fallback only if Firestore is unreachable
          try {
            const res = await fetch('/api/data', { cache: 'no-store' });
            if (res.ok && !cancelled && !cloudHydratedRef.current) {
              const serverStore = await res.json();
              applyServerStore(serverStore);
            }
          } catch (_) {}
          showCloudNotice(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (cloudNoticeTimerRef.current) {
        clearTimeout(cloudNoticeTimerRef.current);
        cloudNoticeTimerRef.current = null;
      }
      if (unsubCloud) unsubCloud();
    };
  }, [applyCloudSnapshot, applyServerStore, showCloudNotice]);

  // Persist local Watchlist & Compliance Score updates unconditionally to Cloud Firestore
  useEffect(() => {
    const handleWatchlistUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.source !== 'local') return;
      const actorId = getSharedActorId();

      void saveWatchlistsToFirestore(
        getAllWatchlistCommodities(),
        getAllWatchlistCountries(),
        actorId
      ).catch((err) => showCloudNotice(err));
      if (detail?.log) {
        const nextLog: DataUpdateLog = {
          id: `watch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          ...detail.log,
        };
        const nextLogs = [nextLog, ...updateLogsRef.current].slice(0, 200);
        updateLogsRef.current = nextLogs;
        setUpdateLogs(nextLogs);
        void saveLogsToFirestore(nextLogs, actorId).catch((err) => showCloudNotice(err));
      }
    };

    const handleComplianceUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.source !== 'local') return;
      const actorId = getSharedActorId();

      void saveComplianceToFirestore(getAllComplianceScores(), actorId).catch((err) =>
        showCloudNotice(err)
      );
      if (detail?.log) {
        const nextLog: DataUpdateLog = {
          id: `score-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          ...detail.log,
        };
        const nextLogs = [nextLog, ...updateLogsRef.current].slice(0, 200);
        updateLogsRef.current = nextLogs;
        setUpdateLogs(nextLogs);
        void saveLogsToFirestore(nextLogs, actorId).catch((err) => showCloudNotice(err));
      }
    };

    window.addEventListener('watchlist_updated', handleWatchlistUpdated);
    window.addEventListener('compliance_scores_updated', handleComplianceUpdated);
    return () => {
      window.removeEventListener('watchlist_updated', handleWatchlistUpdated);
      window.removeEventListener('compliance_scores_updated', handleComplianceUpdated);
    };
  }, [showCloudNotice]);

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

  // Modal & Menu state (updateLogs & customLogo already initialized above)
  const [isGooeyOpen, setIsGooeyOpen] = useState(false);
  const [isMenuPasscodeOpen, setIsMenuPasscodeOpen] = useState(false);

  const handleRequestToggleGooey = useCallback(
    (nextOpen?: boolean) => {
      const targetOpen = nextOpen !== undefined ? nextOpen : !isGooeyOpen;
      if (!targetOpen) {
        setIsGooeyOpen(false);
        return;
      }
      if (!isGooeyOpen) {
        setIsMenuPasscodeOpen(true);
      }
    },
    [isGooeyOpen]
  );

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

  // Upload Logo Modal & Unified Persistence
  const [isUploadLogoOpen, setIsUploadLogoOpen] = useState(false);

  const handleSaveLogo = async (logoDataUrl: string | null) => {
    customLogoRef.current = logoDataUrl;
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

    const actorId = getSharedActorId();
    await Promise.all([
      saveBrandingToFirestore(logoDataUrl, actorId),
      fetch('/api/custom-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: logoDataUrl }),
      }).catch(() => {}),
    ]);
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
    await syncLatestCloudBeforeMutation();

    // Seed server with latest cloud records in safe chunks so Build/Publish never hits Gateway 500 or drops cloud-only rows
    await syncRecordsToServerInChunks(recordsRef.current);

    const res = await fetch('/api/records/deduplicate-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal melakukan deduplikasi di server.');
    }
    const data = await res.json();
    const nextRecords = Array.isArray(data.records) ? data.records : recordsRef.current;
    const nextContacts =
      data.companyContacts && typeof data.companyContacts === 'object'
        ? data.companyContacts
        : companyContactsRef.current;
    const nextLogs = Array.isArray(data.updateLogs)
      ? data.updateLogs
      : data.log
      ? [data.log, ...updateLogsRef.current]
      : updateLogsRef.current;

    recordsRef.current = nextRecords;
    companyContactsRef.current = nextContacts;
    updateLogsRef.current = nextLogs;
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setCompanyContacts(nextContacts);
    if (data.complianceScores) {
      hydrateComplianceScoresFromServer(data.complianceScores);
    }
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [savedVersion] = await Promise.all([
      saveRecordsShardsToFirestore(nextRecords, actorId, shardVersionRef.current + 1),
      saveContactsToFirestore(nextContacts, actorId),
      saveLogsToFirestore(nextLogs, actorId),
      data.complianceScores
        ? saveComplianceToFirestore(data.complianceScores, actorId)
        : Promise.resolve(),
    ]);
    shardVersionRef.current = savedVersion;

    return {
      mergedDuplicatesCount: data.mergedDuplicatesCount || 0,
      unifiedCompanyGroupsCount: data.unifiedCompanyGroupsCount || 0,
      sampleMerged: data.sampleMerged || [],
    };
  };

  // Build O(1) lookup from company core name to existing canonical company name
  const buildCoreToExistingNameMap = () => {
    const map = new Map<string, string>();
    for (const r of recordsRef.current) {
      const raw = (r.pemohon || '').trim().toUpperCase();
      if (!raw) continue;
      const core = extractCompanyCoreName(raw) || raw;
      if (!map.has(core)) map.set(core, raw);
    }
    for (const [k, c] of Object.entries(companyContactsRef.current) as Array<
      [string, CompanyContactInfo]
    >) {
      if (!c) continue;
      const raw = String(c.namaPerusahaan || c.companyName || '').trim().toUpperCase();
      if (!raw) continue;
      const core = extractCompanyCoreName(raw) || k;
      if (core && !map.has(core)) map.set(core, raw);
    }
    return map;
  };

  // Build O(R) baseline aggregation from records for additive Company Registry merging
  const buildRecordBaselineMap = (targetCores?: Set<string>) => {
    const map = new Map<
      string,
      {
        canonicalName: string;
        pemilik: string;
        email: string;
        jenisPerusahaan: string;
        identitas: string;
        statusKepemilikan: string;
        tanggalRegistrasi: string;
        statusBlokir: string;
        activities: Set<string>;
        commodities: Set<string>;
        sites: Set<string>;
        freqSum: number;
        freqCount: number;
        recordCount: number;
      }
    >();
    for (const r of recordsRef.current) {
      const rawName = (r.pemohon || '').trim().toUpperCase();
      if (!rawName) continue;
      const rCore = extractCompanyCoreName(rawName) || rawName;
      if (targetCores && !targetCores.has(rCore)) continue;

      let agg = map.get(rCore);
      if (!agg) {
        agg = {
          canonicalName: rawName,
          pemilik: '',
          email: '',
          jenisPerusahaan: '',
          identitas: '',
          statusKepemilikan: '',
          tanggalRegistrasi: '',
          statusBlokir: '',
          activities: new Set<string>(),
          commodities: new Set<string>(),
          sites: new Set<string>(),
          freqSum: 0,
          freqCount: 0,
          recordCount: 0,
        };
        map.set(rCore, agg);
      }
      if (rawName.length > agg.canonicalName.length) agg.canonicalName = rawName;
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
      if (Array.isArray(r.tempatPeriksa)) {
        r.tempatPeriksa.forEach((s) => {
          if (s && s.trim()) agg!.sites.add(s.trim());
        });
      } else if (r.tempatPeriksaRaw && r.tempatPeriksaRaw.trim()) {
        agg.sites.add(r.tempatPeriksaRaw.trim());
      }
      if (!agg.pemilik && r.pemilik) agg.pemilik = r.pemilik.trim();
      if (!agg.email && r.email) agg.email = r.email.trim();
      if (!agg.jenisPerusahaan && r.jenisPerusahaan) agg.jenisPerusahaan = r.jenisPerusahaan.trim();
      if (!agg.identitas && r.identitas) agg.identitas = r.identitas.trim();
      if (!agg.statusKepemilikan && r.statusKepemilikan) agg.statusKepemilikan = r.statusKepemilikan.trim();
      if (!agg.tanggalRegistrasi && r.tanggalRegistrasi) agg.tanggalRegistrasi = r.tanggalRegistrasi.trim();
      if (!agg.statusBlokir && r.statusBlokir) agg.statusBlokir = r.statusBlokir.trim();
      if (typeof r.frekuensi === 'number' && Number.isFinite(r.frekuensi)) {
        agg.freqSum += r.frekuensi;
        agg.freqCount++;
      }
    }
    return map;
  };

  // Add a single record cleanly onto authoritative Cloud+Local state & persist without login
  const handleAddRecord = async (newRecord: MediaPembawaRecord) => {
    await syncLatestCloudBeforeMutation();

    const coreToExisting = buildCoreToExistingNameMap();
    const rawUpper = (newRecord.pemohon || '').trim().toUpperCase();
    const core = extractCompanyCoreName(rawUpper) || rawUpper;
    const canonicalComp = coreToExisting.get(core) || getCanonicalCompanyName(rawUpper);
    const coreKey = extractCompanyCoreName(canonicalComp) || canonicalComp;
    const nextContacts: Record<string, CompanyContactInfo> = { ...companyContactsRef.current };

    const pemilikVal = String(newRecord.pemilik || '').trim();
    const emailVal = String(newRecord.email || '').trim();
    const existingContact = nextContacts[coreKey];
    const nowIso = new Date().toISOString();

    if (canonicalComp && (existingContact || pemilikVal || emailVal)) {
      const recSite = Array.isArray(newRecord.tempatPeriksa)
        ? newRecord.tempatPeriksa.join(', ')
        : String(newRecord.tempatPeriksaRaw || '').trim();
      const recFreq = typeof newRecord.frekuensi === 'number' && Number.isFinite(newRecord.frekuensi) ? newRecord.frekuensi : 1;

      nextContacts[coreKey] = {
        ...(existingContact || {}),
        companyName: existingContact?.companyName || canonicalComp,
        namaPerusahaan: existingContact?.namaPerusahaan || existingContact?.companyName || canonicalComp,
        pemilik: existingContact?.pemilik || pemilikVal || '',
        namaPemohon: existingContact?.namaPemohon || existingContact?.pemilik || pemilikVal || '',
        email: existingContact?.email || emailVal || '',
        ...(existingContact?.lingkupAktivitas || newRecord.jenisKegiatan
          ? { lingkupAktivitas: mergeDelimitedLists(existingContact?.lingkupAktivitas, newRecord.jenisKegiatan) }
          : {}),
        ...(existingContact?.daftarKomoditas || newRecord.komoditas
          ? { daftarKomoditas: mergeDelimitedLists(existingContact?.daftarKomoditas, newRecord.komoditas) }
          : {}),
        ...(existingContact?.tempatKarantina || recSite
          ? { tempatKarantina: mergeDelimitedLists(existingContact?.tempatKarantina, recSite) }
          : {}),
        ...(existingContact?.rerataFrekuensi !== undefined
          ? { rerataFrekuensi: accumulateFrequency(existingContact.rerataFrekuensi, recFreq) }
          : {}),
        updatedAt: nowIso,
      };
    }

    const normalizedRecord: MediaPembawaRecord = {
      ...newRecord,
      pemohon: canonicalComp,
      pemilik: pemilikVal || nextContacts[coreKey]?.pemilik || '',
      email: emailVal || nextContacts[coreKey]?.email || '',
    };

    const officerName = 'Petugas BBKHIT DKI Jakarta';
    const nextRecords = [normalizedRecord, ...recordsRef.current].map((r, i) => ({
      ...r,
      no: i + 1,
    }));
    const auditLog: DataUpdateLog = {
      id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      actionType: 'TAMBAH_DATA',
      title: `Tambah Transaksi: ${canonicalComp}`,
      description: `Menambahkan deklarasi komoditas ${newRecord.komoditas} (${newRecord.kategori}) untuk perusahaan ${canonicalComp}.`,
      recordsAffected: 1,
      officerName,
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    recordsRef.current = nextRecords;
    companyContactsRef.current = nextContacts;
    updateLogsRef.current = nextLogs;
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setCompanyContacts(nextContacts);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [savedVersion] = await Promise.all([
      saveRecordsShardsToFirestore(nextRecords, actorId, shardVersionRef.current + 1),
      saveContactsToFirestore(nextContacts, actorId),
      saveLogsToFirestore(nextLogs, actorId),
      syncRecordsToServerInChunks(nextRecords, auditLog),
    ]);
    shardVersionRef.current = savedVersion;
  };

  // Import records from Excel - appends cleanly onto authoritative Cloud Firestore without login
  const handleImportRecords = async (
    newRecords: MediaPembawaRecord[],
    onProgress?: UploadProgressCallback
  ) => {
    onProgress?.({
      percent: 3,
      phase: 'Menyelaraskan data Cloud terbaru...',
      detail: `Memeriksa data Cloud sebelum menggabungkan ${newRecords.length.toLocaleString('id-ID')} baris baru...`,
    });

    await syncLatestCloudBeforeMutation();

    const coreToExisting = buildCoreToExistingNameMap();
    const nextContacts: Record<string, CompanyContactInfo> = { ...companyContactsRef.current };
    const nowIso = new Date().toISOString();

    const processedNew = newRecords.map((newR, idx) => {
      const rawUpper = (newR.pemohon || '').trim().toUpperCase();
      const core = extractCompanyCoreName(rawUpper) || rawUpper;
      let canonicalComp = coreToExisting.get(core);
      if (!canonicalComp) {
        canonicalComp = getCanonicalCompanyName(rawUpper);
        if (core) coreToExisting.set(core, canonicalComp);
      }
      const coreKey = extractCompanyCoreName(canonicalComp) || canonicalComp;
      const pemilikVal = String(newR.pemilik || '').trim();
      const emailVal = String(newR.email || '').trim();
      const existing = nextContacts[coreKey];

      if (canonicalComp && (existing || pemilikVal || emailVal)) {
        const recSite = Array.isArray(newR.tempatPeriksa)
          ? newR.tempatPeriksa.join(', ')
          : String(newR.tempatPeriksaRaw || '').trim();
        const recFreq = typeof newR.frekuensi === 'number' && Number.isFinite(newR.frekuensi) ? newR.frekuensi : 1;

        nextContacts[coreKey] = {
          ...(existing || {}),
          companyName: existing?.companyName || canonicalComp,
          namaPerusahaan: existing?.namaPerusahaan || existing?.companyName || canonicalComp,
          pemilik: existing?.pemilik || pemilikVal || '',
          namaPemohon: existing?.namaPemohon || existing?.pemilik || pemilikVal || '',
          email: existing?.email || emailVal || '',
          ...(existing?.lingkupAktivitas || newR.jenisKegiatan
            ? { lingkupAktivitas: mergeDelimitedLists(existing?.lingkupAktivitas, newR.jenisKegiatan) }
            : {}),
          ...(existing?.daftarKomoditas || newR.komoditas
            ? { daftarKomoditas: mergeDelimitedLists(existing?.daftarKomoditas, newR.komoditas) }
            : {}),
          ...(existing?.tempatKarantina || recSite
            ? { tempatKarantina: mergeDelimitedLists(existing?.tempatKarantina, recSite) }
            : {}),
          ...(existing?.rerataFrekuensi !== undefined
            ? { rerataFrekuensi: accumulateFrequency(existing.rerataFrekuensi, recFreq) }
            : {}),
          updatedAt: nowIso,
        };
      }

      return {
        ...newR,
        id: newR.id || `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        pemohon: canonicalComp,
        kategori: newR.kategori,
        pemilik: pemilikVal || nextContacts[coreKey]?.pemilik || '',
        email: emailVal || nextContacts[coreKey]?.email || '',
      };
    });

    const officerName = 'Petugas BBKHIT DKI Jakarta';
    const nextRecords = [...processedNew, ...recordsRef.current].map((r, i) => ({
      ...r,
      no: i + 1,
    }));
    const auditLog: DataUpdateLog = {
      id: `import-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      actionType: 'IMPOR_EXCEL',
      title: `Impor Excel: ${processedNew.length} Baris Data Berhasil Masuk`,
      description: `Berhasil menambahkan ${processedNew.length} baris data transaksi Excel ke dalam sistem Q-BIOCHECK tanpa mereset data sebelumnya.`,
      recordsAffected: processedNew.length,
      officerName,
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    recordsRef.current = nextRecords;
    companyContactsRef.current = nextContacts;
    updateLogsRef.current = nextLogs;
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setCompanyContacts(nextContacts);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [savedVersion] = await Promise.all([
      saveRecordsShardsToFirestore(
        nextRecords,
        actorId,
        shardVersionRef.current + 1,
        (doneBatches, totalBatches) => {
          const pct = Math.min(96, Math.round(12 + (doneBatches / Math.max(1, totalBatches)) * 84));
          onProgress?.({
            percent: pct,
            phase: 'Mengunggah ke Cloud Firestore & Server...',
            detail: `Batch Cloud ${doneBatches}/${totalBatches} • Total ${nextRecords.length.toLocaleString('id-ID')} baris`,
          });
        }
      ),
      saveContactsToFirestore(nextContacts, actorId),
      saveLogsToFirestore(nextLogs, actorId),
      syncRecordsToServerInChunks(nextRecords, auditLog),
    ]);
    shardVersionRef.current = savedVersion;

    onProgress?.({
      percent: 100,
      phase: 'Berhasil diunggah ke Cloud & Server!',
      detail: `${processedNew.length.toLocaleString('id-ID')} baris baru • Total ${nextRecords.length.toLocaleString('id-ID')} rekaman tersimpan permanen`,
    });
  };

  // Selective Clear data permanently with server-side passcode authorization
  const handleSelectiveClear = async (
    activity: TradeActivityType | 'ALL',
    category: QuarantineCategory | 'ALL',
    passcode: string
  ) => {
    await syncLatestCloudBeforeMutation();

    const res = await fetch('/api/records/clear-selective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, category, passcode }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Kode sandi penghapusan salah atau gagal menghapus data.');
    }

    const initialCount = recordsRef.current.length;
    const filteredRecords = recordsRef.current
      .filter((r) => {
        const matchActivity =
          !activity ||
          activity === 'ALL' ||
          (r.jenisKegiatan || 'IMPOR').toUpperCase() === String(activity).toUpperCase();
        const matchCategory =
          !category ||
          category === 'ALL' ||
          (r.kategori || '').toUpperCase() === String(category).toUpperCase();
        return !(matchActivity && matchCategory);
      })
      .map((r, i) => ({ ...r, no: i + 1 }));

    const deletedCount = initialCount - filteredRecords.length;
    let nextLogs = updateLogsRef.current;
    if (deletedCount > 0) {
      const actLabel = !activity || activity === 'ALL' ? 'Semua Arus' : activity;
      const catLabel =
        !category || category === 'ALL' ? 'Semua Bidang (KH/KI/KT)' : `Karantina ${category}`;
      const clearLog: DataUpdateLog = {
        id: `clear-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        actionType: 'HAPUS_SELEKTIF',
        title: `Hapus Permanen: ${deletedCount} Record (${actLabel})`,
        description: `Menghapus permanen ${deletedCount} data yang diupload untuk filter ${actLabel} • ${catLabel}. Sisa data tersimpan: ${filteredRecords.length} record.`,
        recordsAffected: deletedCount,
        officerName: 'Petugas BBKHIT DKI Jakarta',
      };
      nextLogs = [clearLog, ...updateLogsRef.current].slice(0, 200);
    }

    recordsRef.current = filteredRecords;
    updateLogsRef.current = nextLogs;
    setRecords(filteredRecords);
    saveLocalRecordsSafely(filteredRecords);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [savedVersion] = await Promise.all([
      saveRecordsShardsToFirestore(filteredRecords, actorId, shardVersionRef.current + 1),
      saveLogsToFirestore(nextLogs, actorId),
      syncRecordsToServerInChunks(filteredRecords),
    ]);
    shardVersionRef.current = savedVersion;
  };

  // Save single company owner & email
  const handleSaveCompanyContact = async (
    companyName: string,
    pemilik: string,
    email: string
  ) => {
    await syncLatestCloudBeforeMutation();

    const cleanName = companyName.trim().toUpperCase();
    const coreKey = extractCompanyCoreName(cleanName) || cleanName;
    const cleanPemilik = pemilik.trim();
    const cleanEmail = email.trim();
    const now = new Date().toISOString();

    const existingContact = companyContactsRef.current[coreKey];
    const nextContacts: Record<string, CompanyContactInfo> = {
      ...companyContactsRef.current,
      [coreKey]: {
        ...(existingContact || {}),
        companyName: cleanName,
        namaPerusahaan: existingContact?.namaPerusahaan || cleanName,
        pemilik: cleanPemilik,
        namaPemohon: cleanPemilik || existingContact?.namaPemohon,
        email: cleanEmail,
        updatedAt: now,
      },
    };

    let matchedCount = 0;
    const nextRecords = recordsRef.current.map((r) => {
      const rCore = extractCompanyCoreName(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (rCore === coreKey) {
        matchedCount++;
        return { ...r, pemilik: cleanPemilik, email: cleanEmail };
      }
      return r;
    });

    const auditLog: DataUpdateLog = {
      id: `contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Pembaruan Profil Kontak: ${cleanName}`,
      description: `Memperbarui Pemilik (${cleanPemilik || '-'}) dan Email (${cleanEmail || '-'}) untuk ${cleanName}.`,
      recordsAffected: matchedCount || 1,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    companyContactsRef.current = nextContacts;
    recordsRef.current = nextRecords;
    updateLogsRef.current = nextLogs;
    setCompanyContacts(nextContacts);
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [, savedVersion] = await Promise.all([
      saveContactsToFirestore(nextContacts, actorId),
      saveRecordsShardsToFirestore(nextRecords, actorId, shardVersionRef.current + 1),
      saveLogsToFirestore(nextLogs, actorId),
      fetch('/api/company-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, pemilik, email }),
      }).catch(() => {}),
    ]);
    shardVersionRef.current = savedVersion;
  };

  // Bulk import company owner & email via CSV / Excel
  const handleBulkImportCompanyContacts = async (
    items: Array<{ companyName: string; pemilik: string; email: string }>,
    onProgress?: UploadProgressCallback
  ) => {
    onProgress?.({
      percent: 4,
      phase: 'Menyelaraskan data kontak Cloud...',
      detail: `Memproses ${items.length.toLocaleString('id-ID')} perusahaan...`,
    });

    await syncLatestCloudBeforeMutation();

    const now = new Date().toISOString();
    const nextContacts: Record<string, CompanyContactInfo> = { ...companyContactsRef.current };
    const updatedKeys = new Set<string>();

    items.forEach((item) => {
      const rawName = String(item.companyName || '').trim().toUpperCase();
      if (!rawName) return;
      const coreKey = extractCompanyCoreName(rawName) || rawName;
      const existing = nextContacts[coreKey];
      nextContacts[coreKey] = {
        ...(existing || {}),
        companyName: existing?.companyName || rawName,
        namaPerusahaan: existing?.namaPerusahaan || existing?.companyName || rawName,
        pemilik: String(item.pemilik || '').trim() || existing?.pemilik || '',
        namaPemohon: String(item.pemilik || '').trim() || existing?.namaPemohon || existing?.pemilik || '',
        email: String(item.email || '').trim() || existing?.email || '',
        updatedAt: now,
      };
      updatedKeys.add(coreKey);
    });

    const nextRecords = recordsRef.current.map((r) => {
      const rCore = extractCompanyCoreName(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (updatedKeys.has(rCore) && nextContacts[rCore]) {
        const info = nextContacts[rCore];
        return {
          ...r,
          pemilik: info.pemilik || r.pemilik || '',
          email: info.email || r.email || '',
        };
      }
      return r;
    });

    const auditLog: DataUpdateLog = {
      id: `bulk-contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Impor CSV/Excel Pemilik & Email: ${updatedKeys.size} Perusahaan`,
      description: `Berhasil memperbarui data Pemilik & Alamat Email untuk ${updatedKeys.size} perusahaan.`,
      recordsAffected: updatedKeys.size,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    companyContactsRef.current = nextContacts;
    recordsRef.current = nextRecords;
    updateLogsRef.current = nextLogs;
    setCompanyContacts(nextContacts);
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [, savedVersion] = await Promise.all([
      saveContactsToFirestore(nextContacts, actorId),
      saveRecordsShardsToFirestore(
        nextRecords,
        actorId,
        shardVersionRef.current + 1,
        (doneBatches, totalBatches) => {
          const pct = Math.min(96, Math.round(12 + (doneBatches / Math.max(1, totalBatches)) * 84));
          onProgress?.({
            percent: pct,
            phase: 'Mengunggah kontak ke Cloud & Server...',
            detail: `Batch Cloud ${doneBatches}/${totalBatches}`,
          });
        }
      ),
      saveLogsToFirestore(nextLogs, actorId),
      syncContactsBulkToServerInChunks(items),
    ]);
    shardVersionRef.current = savedVersion;

    onProgress?.({
      percent: 100,
      phase: 'Data kontak berhasil tersimpan di Cloud & Server!',
      detail: `${updatedKeys.size.toLocaleString('id-ID')} perusahaan diperbarui`,
    });
  };

  // Helper to strip empty/undefined optional fields so Firestore & storage stay lean
  const compactCompanyContact = (entry: CompanyContactInfo): CompanyContactInfo => {
    const out: CompanyContactInfo = {
      companyName: entry.companyName,
      pemilik: entry.pemilik || '',
      email: entry.email || '',
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
    const optionalKeys: Array<keyof CompanyContactInfo> = [
      'namaPemohon',
      'jenisPerusahaan',
      'namaPerusahaan',
      'identitas',
      'nomorIdentitas',
      'nitku',
      'uptRegistrasi',
      'lingkupAktivitas',
      'daftarKomoditas',
      'tempatKarantina',
      'statusKepemilikan',
      'nomorRegistrasi',
      'tanggalRegistrasi',
      'statusBlokir',
    ];
    for (const k of optionalKeys) {
      const val = String(entry[k] ?? '').trim();
      if (val) (out as any)[k] = val;
    }
    if (entry.rerataFrekuensi !== undefined && String(entry.rerataFrekuensi).trim() !== '') {
      out.rerataFrekuensi = entry.rerataFrekuensi;
    }
    if (entry.no !== undefined && Number.isFinite(Number(entry.no))) {
      out.no = Number(entry.no);
    }
    if (entry.isRegistryEntry === true) {
      out.isRegistryEntry = true;
    }
    return out;
  };

  // Save full 17-column company registry entry (additive in 'create' mode, direct in 'edit' mode)
  const handleSaveCompanyEntry = async (
    entry: CompanyContactInfo,
    mode: 'create' | 'edit' = 'edit'
  ) => {
    await syncLatestCloudBeforeMutation();

    const cleanName = (entry.namaPerusahaan || entry.companyName || '').trim().toUpperCase();
    if (!cleanName) throw new Error('Nama perusahaan wajib diisi.');
    const coreKey = extractCompanyCoreName(cleanName) || cleanName;
    const now = new Date().toISOString();
    const existing = companyContactsRef.current[coreKey];

    let merged: CompanyContactInfo;
    if (mode === 'edit') {
      const cleanPemilik = (entry.namaPemohon || entry.pemilik || existing?.pemilik || '').trim();
      const cleanEmail = (entry.email || existing?.email || '').trim();
      merged = compactCompanyContact({
        ...(existing || {}),
        ...entry,
        companyName: cleanName,
        namaPerusahaan: cleanName,
        pemilik: cleanPemilik,
        namaPemohon: entry.namaPemohon || cleanPemilik,
        email: cleanEmail,
        isRegistryEntry: true,
        updatedAt: now,
      });
    } else {
      const recAgg = buildRecordBaselineMap(new Set([coreKey])).get(coreKey);
      const baseFreq =
        existing?.rerataFrekuensi !== undefined && String(existing.rerataFrekuensi).trim() !== ''
          ? existing.rerataFrekuensi
          : recAgg
            ? recAgg.freqCount > 0
              ? Math.round(recAgg.freqSum / recAgg.freqCount)
              : recAgg.recordCount
            : undefined;
      const baseActivities = existing?.lingkupAktivitas || (recAgg ? Array.from(recAgg.activities).join(', ') : '');
      const baseCommodities = existing?.daftarKomoditas || (recAgg ? Array.from(recAgg.commodities).join(', ') : '');
      const baseSites = existing?.tempatKarantina || (recAgg ? Array.from(recAgg.sites).join(', ') : '');

      const canonicalName = existing?.namaPerusahaan || existing?.companyName || recAgg?.canonicalName || cleanName;
      const cleanPemilik = (existing?.namaPemohon || existing?.pemilik || recAgg?.pemilik || entry.namaPemohon || entry.pemilik || '').trim();
      const cleanEmail = (existing?.email || recAgg?.email || entry.email || '').trim();

      merged = compactCompanyContact({
        ...(existing || {}),
        companyName: canonicalName,
        namaPerusahaan: canonicalName,
        pemilik: cleanPemilik,
        namaPemohon: cleanPemilik,
        email: cleanEmail,
        jenisPerusahaan: existing?.jenisPerusahaan || recAgg?.jenisPerusahaan || entry.jenisPerusahaan,
        identitas: existing?.identitas || recAgg?.identitas || entry.identitas,
        nomorIdentitas: existing?.nomorIdentitas || entry.nomorIdentitas,
        nitku: existing?.nitku || entry.nitku,
        uptRegistrasi: existing?.uptRegistrasi || entry.uptRegistrasi,
        statusKepemilikan: existing?.statusKepemilikan || recAgg?.statusKepemilikan || entry.statusKepemilikan,
        nomorRegistrasi: existing?.nomorRegistrasi || entry.nomorRegistrasi,
        tanggalRegistrasi: existing?.tanggalRegistrasi || recAgg?.tanggalRegistrasi || entry.tanggalRegistrasi,
        statusBlokir: existing?.statusBlokir || recAgg?.statusBlokir || entry.statusBlokir,
        lingkupAktivitas: mergeDelimitedLists(baseActivities, entry.lingkupAktivitas) || undefined,
        daftarKomoditas: mergeDelimitedLists(baseCommodities, entry.daftarKomoditas) || undefined,
        tempatKarantina: mergeDelimitedLists(baseSites, entry.tempatKarantina) || undefined,
        rerataFrekuensi: accumulateFrequency(baseFreq, entry.rerataFrekuensi),
        isRegistryEntry: true,
        updatedAt: now,
      });
    }

    const nextContacts: Record<string, CompanyContactInfo> = {
      ...companyContactsRef.current,
      [coreKey]: merged,
    };

    const cleanPemilikOut = merged.pemilik || '';
    const cleanEmailOut = merged.email || '';

    let matchedCount = 0;
    const nextRecords = recordsRef.current.map((r) => {
      const rCore = extractCompanyCoreName(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (rCore === coreKey) {
        matchedCount++;
        return {
          ...r,
          pemilik: cleanPemilikOut || r.pemilik || '',
          email: cleanEmailOut || r.email || '',
          ...(merged.jenisPerusahaan ? { jenisPerusahaan: merged.jenisPerusahaan } : {}),
          ...(merged.identitas ? { identitas: merged.identitas } : {}),
          ...(merged.lingkupAktivitas ? { lingkupAktivitas: merged.lingkupAktivitas } : {}),
          ...(merged.statusKepemilikan ? { statusKepemilikan: merged.statusKepemilikan } : {}),
          ...(merged.tanggalRegistrasi ? { tanggalRegistrasi: merged.tanggalRegistrasi } : {}),
          ...(merged.statusBlokir ? { statusBlokir: merged.statusBlokir } : {}),
        };
      }
      return r;
    });

    const auditLog: DataUpdateLog = {
      id: `contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Pembaruan Data Perusahaan: ${merged.namaPerusahaan || cleanName}`,
      description: `Memperbarui profil registrasi & kontak (${cleanPemilikOut || '-'} / ${cleanEmailOut || '-'}) untuk ${merged.namaPerusahaan || cleanName}.`,
      recordsAffected: matchedCount || 1,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    companyContactsRef.current = nextContacts;
    recordsRef.current = nextRecords;
    updateLogsRef.current = nextLogs;
    setCompanyContacts(nextContacts);
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setUpdateLogs(nextLogs);

    const actorId = getSharedActorId();
    const [, savedVersion] = await Promise.all([
      saveContactsToFirestore(nextContacts, actorId),
      saveRecordsShardsToFirestore(nextRecords, actorId, shardVersionRef.current + 1),
      saveLogsToFirestore(nextLogs, actorId),
      fetch('/api/company-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...merged, mode }),
      }).catch(() => {}),
    ]);
    shardVersionRef.current = savedVersion;
  };

  // Bulk import 17-column company registry items via CSV / Excel (additive merge on duplicate company names)
  const handleBulkImportCompanyEntries = async (
    items: CompanyContactInfo[],
    onProgress?: UploadProgressCallback
  ) => {
    onProgress?.({
      percent: 4,
      phase: 'Menyelaraskan data perusahaan Cloud...',
      detail: `Menggabungkan ${items.length.toLocaleString('id-ID')} entri perusahaan...`,
    });

    await syncLatestCloudBeforeMutation();

    const now = new Date().toISOString();
    const nextContacts: Record<string, CompanyContactInfo> = { ...companyContactsRef.current };
    const updatedKeys = new Set<string>();
    const targetCores = new Set<string>();

    for (const item of items) {
      const rawName = String(item.namaPerusahaan || item.companyName || '').trim().toUpperCase();
      if (!rawName) continue;
      targetCores.add(extractCompanyCoreName(rawName) || rawName);
    }

    const recAggMap = buildRecordBaselineMap(targetCores);

    interface TokenAcc {
      set: Set<string>;
      list: string[];
    }
    const pushAcc = (acc: TokenAcc, raw?: string) => {
      if (!raw) return;
      for (const part of String(raw).split(/[,;\n]+/)) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const k = trimmed.toUpperCase();
        if (!acc.set.has(k)) {
          acc.set.add(k);
          acc.list.push(trimmed);
        }
      }
    };
    const createAcc = (seed?: string): TokenAcc => {
      const acc: TokenAcc = { set: new Set<string>(), list: [] };
      if (seed) pushAcc(acc, seed);
      return acc;
    };

    const companyAcc = new Map<
      string,
      {
        merged: CompanyContactInfo;
        act: TokenAcc;
        comm: TokenAcc;
        sites: TokenAcc;
        freq: string | number | undefined;
      }
    >();

    items.forEach((item) => {
      const rawName = String(item.namaPerusahaan || item.companyName || '').trim().toUpperCase();
      if (!rawName) return;
      const coreKey = extractCompanyCoreName(rawName) || rawName;
      let acc = companyAcc.get(coreKey);

      if (!acc) {
        const existing = nextContacts[coreKey];
        const recAgg = recAggMap.get(coreKey);
        const baseFreq =
          existing?.rerataFrekuensi !== undefined && String(existing.rerataFrekuensi).trim() !== ''
            ? existing.rerataFrekuensi
            : recAgg
              ? recAgg.freqCount > 0
                ? Math.round(recAgg.freqSum / recAgg.freqCount)
                : recAgg.recordCount
              : undefined;
        const baseActivities = existing?.lingkupAktivitas || (recAgg ? Array.from(recAgg.activities).join(', ') : '');
        const baseCommodities = existing?.daftarKomoditas || (recAgg ? Array.from(recAgg.commodities).join(', ') : '');
        const baseSites = existing?.tempatKarantina || (recAgg ? Array.from(recAgg.sites).join(', ') : '');
        const canonicalName = existing?.namaPerusahaan || existing?.companyName || recAgg?.canonicalName || rawName;
        const pemilikVal = String(existing?.pemilik || recAgg?.pemilik || '').trim();
        const emailVal = String(existing?.email || recAgg?.email || '').trim();

        acc = {
          merged: {
            ...(existing || {}),
            companyName: canonicalName,
            namaPerusahaan: canonicalName,
            pemilik: pemilikVal,
            namaPemohon: existing?.namaPemohon || pemilikVal,
            email: emailVal,
            jenisPerusahaan: existing?.jenisPerusahaan || recAgg?.jenisPerusahaan,
            identitas: existing?.identitas || recAgg?.identitas,
            nomorIdentitas: existing?.nomorIdentitas,
            nitku: existing?.nitku,
            uptRegistrasi: existing?.uptRegistrasi,
            statusKepemilikan: existing?.statusKepemilikan || recAgg?.statusKepemilikan,
            nomorRegistrasi: existing?.nomorRegistrasi,
            tanggalRegistrasi: existing?.tanggalRegistrasi || recAgg?.tanggalRegistrasi,
            statusBlokir: existing?.statusBlokir || recAgg?.statusBlokir,
            no: existing?.no,
            isRegistryEntry: true,
            updatedAt: now,
          },
          act: createAcc(baseActivities),
          comm: createAcc(baseCommodities),
          sites: createAcc(baseSites),
          freq: baseFreq,
        };
        companyAcc.set(coreKey, acc);
      }

      const inPemilik = String(item.namaPemohon || item.pemilik || '').trim();
      const inEmail = String(item.email || '').trim();
      if (!acc.merged.pemilik && inPemilik) {
        acc.merged.pemilik = inPemilik;
        acc.merged.namaPemohon = acc.merged.namaPemohon || inPemilik;
      }
      if (!acc.merged.email && inEmail) acc.merged.email = inEmail;
      if (!acc.merged.jenisPerusahaan && item.jenisPerusahaan) acc.merged.jenisPerusahaan = item.jenisPerusahaan;
      if (!acc.merged.identitas && item.identitas) acc.merged.identitas = item.identitas;
      if (!acc.merged.nomorIdentitas && item.nomorIdentitas) acc.merged.nomorIdentitas = item.nomorIdentitas;
      if (!acc.merged.nitku && item.nitku) acc.merged.nitku = item.nitku;
      if (!acc.merged.uptRegistrasi && item.uptRegistrasi) acc.merged.uptRegistrasi = item.uptRegistrasi;
      if (!acc.merged.statusKepemilikan && item.statusKepemilikan) acc.merged.statusKepemilikan = item.statusKepemilikan;
      if (!acc.merged.nomorRegistrasi && item.nomorRegistrasi) acc.merged.nomorRegistrasi = item.nomorRegistrasi;
      if (!acc.merged.tanggalRegistrasi && item.tanggalRegistrasi) acc.merged.tanggalRegistrasi = item.tanggalRegistrasi;
      if (!acc.merged.statusBlokir && item.statusBlokir) acc.merged.statusBlokir = item.statusBlokir;
      if (acc.merged.no === undefined && item.no !== undefined) acc.merged.no = item.no;

      pushAcc(acc.act, item.lingkupAktivitas);
      pushAcc(acc.comm, item.daftarKomoditas);
      pushAcc(acc.sites, item.tempatKarantina);
      acc.freq = accumulateFrequency(acc.freq, item.rerataFrekuensi);
      updatedKeys.add(coreKey);
    });

    companyAcc.forEach((acc, coreKey) => {
      acc.merged.lingkupAktivitas = acc.act.list.length > 0 ? acc.act.list.join(', ') : undefined;
      acc.merged.daftarKomoditas = acc.comm.list.length > 0 ? acc.comm.list.join(', ') : undefined;
      acc.merged.tempatKarantina = acc.sites.list.length > 0 ? acc.sites.list.join(', ') : undefined;
      acc.merged.rerataFrekuensi = acc.freq;
      nextContacts[coreKey] = compactCompanyContact(acc.merged);
    });

    const nextRecords = recordsRef.current.map((r) => {
      const rCore = extractCompanyCoreName(r.pemohon || '') || (r.pemohon || '').trim().toUpperCase();
      if (updatedKeys.has(rCore) && nextContacts[rCore]) {
        const info = nextContacts[rCore];
        return {
          ...r,
          pemilik: info.pemilik || r.pemilik || '',
          email: info.email || r.email || '',
          ...(info.jenisPerusahaan ? { jenisPerusahaan: info.jenisPerusahaan } : {}),
          ...(info.identitas ? { identitas: info.identitas } : {}),
          ...(info.lingkupAktivitas ? { lingkupAktivitas: info.lingkupAktivitas } : {}),
          ...(info.statusKepemilikan ? { statusKepemilikan: info.statusKepemilikan } : {}),
          ...(info.tanggalRegistrasi ? { tanggalRegistrasi: info.tanggalRegistrasi } : {}),
          ...(info.statusBlokir ? { statusBlokir: info.statusBlokir } : {}),
        };
      }
      return r;
    });

    const auditLog: DataUpdateLog = {
      id: `bulk-contact-${Date.now()}`,
      timestamp: now,
      actionType: 'KONTAK_PERUSAHAAN',
      title: `Impor Data Perusahaan: ${updatedKeys.size} Perusahaan`,
      description: `Berhasil menambahkan/menggabungkan profil & registrasi untuk ${updatedKeys.size} perusahaan.`,
      recordsAffected: updatedKeys.size,
      officerName: 'Petugas BBKHIT DKI Jakarta',
    };
    const nextLogs = [auditLog, ...updateLogsRef.current].slice(0, 200);

    companyContactsRef.current = nextContacts;
    recordsRef.current = nextRecords;
    updateLogsRef.current = nextLogs;
    setCompanyContacts(nextContacts);
    setRecords(nextRecords);
    saveLocalRecordsSafely(nextRecords);
    setUpdateLogs(nextLogs);

    const taggedItems = items.map((item) => ({ ...item, isRegistryEntry: true }));
    const actorId = getSharedActorId();
    const [, savedVersion] = await Promise.all([
      saveContactsToFirestore(nextContacts, actorId),
      saveRecordsShardsToFirestore(
        nextRecords,
        actorId,
        shardVersionRef.current + 1,
        (doneBatches, totalBatches) => {
          const pct = Math.min(96, Math.round(12 + (doneBatches / Math.max(1, totalBatches)) * 84));
          onProgress?.({
            percent: pct,
            phase: 'Mengunggah Data Perusahaan ke Cloud & Server...',
            detail: `Batch Cloud ${doneBatches}/${totalBatches} • ${updatedKeys.size} perusahaan`,
          });
        }
      ),
      saveLogsToFirestore(nextLogs, actorId),
      syncContactsBulkToServerInChunks(taggedItems),
    ]);
    shardVersionRef.current = savedVersion;

    onProgress?.({
      percent: 100,
      phase: 'Data Perusahaan berhasil tersimpan di Cloud & Server!',
      detail: `${updatedKeys.size.toLocaleString('id-ID')} perusahaan digabungkan & disimpan`,
    });
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
        onToggleGooeyMenu={() => handleRequestToggleGooey()}
        isGooeyOpen={isGooeyOpen}
        onResetFilters={handleResetFilters}
        totalRecordsCount={records.length}
        customLogo={customLogo}
        onOpenUploadLogo={() => setIsUploadLogoOpen(true)}
        themeMode={themeMode}
        onSelectThemeMode={setThemeMode}
      />

      {cloudNotice && (
        <div className="max-w-[1860px] w-full mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3">
          <div className="glass-sub rounded-2xl px-4 py-2.5 border border-rose-500/35 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{cloudNotice}</span>
            </div>
            <button
              type="button"
              onClick={dismissCloudNotice}
              className="p-1 rounded-lg hover:bg-rose-500/15"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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

        {activeTab === 'companies' && (
          <CompanyRegistryView
            data={displayRecords}
            companyContacts={companyContacts}
            onSaveCompanyEntry={handleSaveCompanyEntry}
            onBulkImportCompanyEntries={handleBulkImportCompanyEntries}
            onSelectApplicant={handleSelectApplicant}
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
        existingRecords={records}
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

      {/* Menu Aksi Passcode Modal */}
      <MenuAksiPasscodeModal
        isOpen={isMenuPasscodeOpen}
        onClose={() => setIsMenuPasscodeOpen(false)}
        onUnlocked={() => setIsGooeyOpen(true)}
      />

      {/* Floating Action Menu (Operasional) */}
      <GooeyMenu
        isOpenControlled={isGooeyOpen}
        onToggleControlled={handleRequestToggleGooey}
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
