import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import {
  MediaPembawaRecord,
  PriorityCommodityWatchItem,
  PriorityCountryWatchItem,
  CompanyComplianceData,
  CompanyContactInfo,
  DataUpdateLog,
} from '../types';

const SHARD_SIZE = 350;
const MAX_SHARD_BYTES = 360_000;
const MAX_SHARDS_PER_BATCH = 2;
const CONTACT_INLINE_MAX_ENTRIES = 280;
const CONTACT_INLINE_MAX_BYTES = 300_000;
const CONTACT_SHARD_MAX_ENTRIES = 220;
const CONTACT_SHARD_MAX_BYTES = 300_000;
const MAX_CONTACT_SHARDS_PER_BATCH = 2;

export function isFirestoreQuotaError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  const code = String((err as any)?.code || '').toLowerCase();
  const combined = `${code} ${raw}`.toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    combined.includes('quota limit exceeded') ||
    combined.includes('quota exceeded') ||
    combined.includes('free daily read units') ||
    combined.includes('resource_exhausted')
  );
}

function isTransientFirestoreError(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  if (
    code.includes('permission-denied') ||
    code.includes('invalid-argument') ||
    isFirestoreQuotaError(err)
  ) {
    return false;
  }
  return (
    code.includes('internal') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('aborted') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('gateway') ||
    msg.includes('internal') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('timeout') ||
    msg.includes('network')
  );
}

function forwardSnapshotError(
  error: unknown,
  operationType: OperationType,
  path: string,
  onError?: (err: Error) => void
): void {
  try {
    handleFirestoreError(error, operationType, path);
  } catch (wrapped) {
    onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
  }
}

async function withFirestoreRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1 || !isTransientFirestoreError(err)) {
        throw err;
      }
      const delayMs = 450 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

export interface CloudMetaDoc {
  shardVersion: number;
  shardCount: number;
  totalRecords: number;
  updatedBy: string;
}

export interface FullCloudSnapshot {
  meta: CloudMetaDoc;
  records: MediaPembawaRecord[];
  customLogo: string | null;
  hasBrandingDoc: boolean;
  commodityWatchlist: PriorityCommodityWatchItem[];
  countryWatchlist: PriorityCountryWatchItem[];
  hasWatchlistsDoc: boolean;
  complianceScores: Record<string, CompanyComplianceData>;
  hasComplianceDoc: boolean;
  companyContacts: Record<string, CompanyContactInfo>;
  hasContactsDoc: boolean;
  updateLogs: DataUpdateLog[];
  hasLogsDoc: boolean;
}

export interface CloudHydrationHandlers {
  onMetaChanged: (meta: CloudMetaDoc, records: MediaPembawaRecord[]) => void;
  onBrandingChanged: (customLogo: string | null) => void;
  onWatchlistsChanged: (
    commodities: PriorityCommodityWatchItem[],
    countries: PriorityCountryWatchItem[]
  ) => void;
  onComplianceChanged: (scores: Record<string, CompanyComplianceData>) => void;
  onContactsChanged: (contacts: Record<string, CompanyContactInfo>) => void;
  onLogsChanged: (logs: DataUpdateLog[]) => void;
  onError?: (err: Error) => void;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        if (typeof v === 'number' && !Number.isFinite(v)) {
          continue;
        }
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  if (typeof value === 'string' && value.length > 16_000) {
    return value.slice(0, 16_000) as unknown as T;
  }
  return value;
}

function shardDocId(index: number): string {
  return `shard_${String(index).padStart(3, '0')}`;
}

function estimateJsonBytes(val: unknown): number {
  const s = JSON.stringify(val);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  return s.length * 2;
}

async function getDocPreferServer<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  try {
    return await getDocFromServer(ref);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '').toLowerCase();
    if (
      code === 'unavailable' ||
      msg.includes('offline') ||
      msg.includes('network')
    ) {
      return await getDoc(ref);
    }
    throw err;
  }
}

export async function fetchCloudMetaVersionOnly(): Promise<CloudMetaDoc | null> {
  const path = 'shared_meta/current';
  try {
    const snap = await getDocPreferServer(doc(db, 'shared_meta', 'current'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      shardVersion: Number(data?.shardVersion || 0),
      shardCount: Number(data?.shardCount || 0),
      totalRecords: Number(data?.totalRecords || 0),
      updatedBy: String(data?.updatedBy || ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAllShardsFromFirestore(
  shardCount: number
): Promise<MediaPembawaRecord[]> {
  if (shardCount <= 0) return [];
  const indices = Array.from({ length: shardCount }, (_, i) => i);
  const shardSnapshots = await Promise.all(
    indices.map(async (idx) => {
      const id = shardDocId(idx);
      const path = `shared_dataset_shards/${id}`;
      try {
        const snap = await getDocPreferServer(doc(db, 'shared_dataset_shards', id));
        if (!snap.exists()) {
          throw new Error(`Shard ${id} belum tersedia di server Cloud.`);
        }
        const data = snap.data();
        return Array.isArray(data?.records) ? (data.records as MediaPembawaRecord[]) : [];
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    })
  );
  return shardSnapshots.flat();
}

export async function fetchContactsFromFirestore(): Promise<{
  exists: boolean;
  contacts: Record<string, CompanyContactInfo>;
}> {
  const path = 'shared_contacts/current';
  try {
    const snap = await getDocPreferServer(doc(db, 'shared_contacts', 'current'));
    if (!snap.exists()) {
      return { exists: false, contacts: {} };
    }
    const data = snap.data() as any;
    const shardCount = Number(data?.shardCount || 0);
    if (shardCount > 0) {
      const indices = Array.from({ length: shardCount }, (_, i) => i);
      const shardMaps = await Promise.all(
        indices.map(async (idx) => {
          const id = shardDocId(idx);
          const sPath = `shared_contact_shards/${id}`;
          try {
            const sSnap = await getDocPreferServer(doc(db, 'shared_contact_shards', id));
            if (!sSnap.exists()) return {};
            const sData = sSnap.data();
            return sData?.contacts && typeof sData.contacts === 'object'
              ? (sData.contacts as Record<string, CompanyContactInfo>)
              : {};
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, sPath);
          }
        })
      );
      const merged: Record<string, CompanyContactInfo> = {};
      for (const part of shardMaps) {
        Object.assign(merged, part);
      }
      return { exists: true, contacts: merged };
    }
    const inlineContacts =
      data?.contacts && typeof data.contacts === 'object'
        ? (data.contacts as Record<string, CompanyContactInfo>)
        : {};
    return { exists: true, contacts: inlineContacts };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchFullCloudHydrationSnapshot(): Promise<FullCloudSnapshot | null> {
  const meta = await fetchCloudMetaVersionOnly();
  if (!meta) return null;

  const [records, brandingSnap, watchlistsSnap, complianceSnap, contactsRes, logsSnap] =
    await Promise.all([
      fetchAllShardsFromFirestore(meta.shardCount),
      getDocPreferServer(doc(db, 'shared_branding', 'current')).catch((err) =>
        handleFirestoreError(err, OperationType.GET, 'shared_branding/current')
      ),
      getDocPreferServer(doc(db, 'shared_watchlists', 'current')).catch((err) =>
        handleFirestoreError(err, OperationType.GET, 'shared_watchlists/current')
      ),
      getDocPreferServer(doc(db, 'shared_compliance', 'current')).catch((err) =>
        handleFirestoreError(err, OperationType.GET, 'shared_compliance/current')
      ),
      fetchContactsFromFirestore(),
      getDocPreferServer(doc(db, 'shared_logs', 'current')).catch((err) =>
        handleFirestoreError(err, OperationType.GET, 'shared_logs/current')
      ),
    ]);

  const rawLogo = brandingSnap.exists() ? brandingSnap.data()?.customLogo : null;
  const customLogo = typeof rawLogo === 'string' && rawLogo.length > 0 ? rawLogo : null;

  const wData = watchlistsSnap.exists() ? watchlistsSnap.data() : null;
  const commodityWatchlist = Array.isArray(wData?.commodityWatchlist)
    ? (wData.commodityWatchlist as PriorityCommodityWatchItem[])
    : [];
  const countryWatchlist = Array.isArray(wData?.countryWatchlist)
    ? (wData.countryWatchlist as PriorityCountryWatchItem[])
    : [];

  const cData = complianceSnap.exists() ? complianceSnap.data()?.scores : null;
  const complianceScores =
    cData && typeof cData === 'object' ? (cData as Record<string, CompanyComplianceData>) : {};

  const lData = logsSnap.exists() ? logsSnap.data()?.logs : null;
  const updateLogs = Array.isArray(lData) ? (lData as DataUpdateLog[]) : [];

  return {
    meta,
    records,
    customLogo,
    hasBrandingDoc: brandingSnap.exists(),
    commodityWatchlist,
    countryWatchlist,
    hasWatchlistsDoc: watchlistsSnap.exists(),
    complianceScores,
    hasComplianceDoc: complianceSnap.exists(),
    companyContacts: contactsRes.contacts,
    hasContactsDoc: contactsRes.exists,
    updateLogs,
    hasLogsDoc: logsSnap.exists(),
  };
}

function buildRecordShardChunks(cleanedRecords: MediaPembawaRecord[]): MediaPembawaRecord[][] {
  const chunks: MediaPembawaRecord[][] = [];
  let current: MediaPembawaRecord[] = [];
  let currentBytes = 32;

  for (const rec of cleanedRecords) {
    const recBytes = estimateJsonBytes(rec) + 2;
    if (
      current.length > 0 &&
      (current.length >= SHARD_SIZE || currentBytes + recBytes > MAX_SHARD_BYTES)
    ) {
      chunks.push(current);
      current = [];
      currentBytes = 32;
    }
    current.push(rec);
    currentBytes += recBytes;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

export async function saveRecordsShardsToFirestore(
  records: MediaPembawaRecord[],
  actorId: string,
  nextVersion: number,
  onShardProgress?: (completedBatches: number, totalBatches: number) => void
): Promise<number> {
  // Always read latest server version so monotonic version constraint succeeds cleanly
  let serverVersion = 0;
  try {
    const currentMeta = await fetchCloudMetaVersionOnly();
    if (currentMeta) {
      serverVersion = currentMeta.shardVersion;
    }
  } catch {
    serverVersion = 0;
  }

  const safeVersion = Math.max(
    1,
    Math.min(1_000_000_000, Math.max(Math.floor(nextVersion), serverVersion + 1))
  );
  const cleanedRecords = records.map((r) => stripUndefinedDeep(r));
  const chunks = buildRecordShardChunks(cleanedRecords);

  const totalSteps = Math.max(1, Math.ceil(chunks.length / MAX_SHARDS_PER_BATCH) + 1);
  let completedSteps = 0;

  // Write in small batches of 2 shards (< 750 KB JSON) with exponential retry for 500/gateway resilience
  for (let start = 0; start < chunks.length; start += MAX_SHARDS_PER_BATCH) {
    const slice = chunks.slice(start, start + MAX_SHARDS_PER_BATCH);
    try {
      await withFirestoreRetry(async () => {
        const batch = writeBatch(db);
        slice.forEach((chunk, offset) => {
          const idx = start + offset;
          const id = shardDocId(idx);
          batch.set(doc(db, 'shared_dataset_shards', id), {
            index: idx,
            recordCount: chunk.length,
            records: chunk,
            updatedBy: actorId,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      });
      completedSteps++;
      onShardProgress?.(completedSteps, totalSteps);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shared_dataset_shards/batch_${start}`);
    }
  }

  const metaPath = 'shared_meta/current';
  try {
    const committedVersion = await withFirestoreRetry(async () => {
      // Re-read latest server version right before meta write so multi-second imports never lose version race
      let latestVersion = serverVersion;
      try {
        const latestMeta = await fetchCloudMetaVersionOnly();
        if (latestMeta) {
          latestVersion = latestMeta.shardVersion;
        }
      } catch {
        // Keep previous serverVersion
      }
      const finalVersion = Math.max(
        1,
        Math.min(1_000_000_000, Math.max(safeVersion, latestVersion + 1))
      );
      await setDoc(doc(db, 'shared_meta', 'current'), {
        shardVersion: finalVersion,
        shardCount: chunks.length,
        totalRecords: cleanedRecords.length,
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      });
      return finalVersion;
    });
    onShardProgress?.(totalSteps, totalSteps);
    return committedVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, metaPath);
  }
}

export async function saveBrandingToFirestore(
  customLogo: string | null,
  actorId: string
): Promise<void> {
  const safeLogo = (customLogo || '').slice(0, 350_000);
  const path = 'shared_branding/current';
  try {
    await withFirestoreRetry(() =>
      setDoc(doc(db, 'shared_branding', 'current'), {
        customLogo: safeLogo,
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveWatchlistsToFirestore(
  commodities: PriorityCommodityWatchItem[],
  countries: PriorityCountryWatchItem[],
  actorId: string
): Promise<void> {
  const path = 'shared_watchlists/current';
  try {
    await withFirestoreRetry(() =>
      setDoc(doc(db, 'shared_watchlists', 'current'), {
        commodityWatchlist: stripUndefinedDeep(commodities).slice(0, 500),
        countryWatchlist: stripUndefinedDeep(countries).slice(0, 500),
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveComplianceToFirestore(
  scores: Record<string, CompanyComplianceData>,
  actorId: string
): Promise<void> {
  const path = 'shared_compliance/current';
  try {
    await withFirestoreRetry(() =>
      setDoc(doc(db, 'shared_compliance', 'current'), {
        scores: stripUndefinedDeep(scores || {}),
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveContactsToFirestore(
  contacts: Record<string, CompanyContactInfo>,
  actorId: string
): Promise<void> {
  const path = 'shared_contacts/current';
  const cleaned = stripUndefinedDeep(contacts || {}) as Record<string, CompanyContactInfo>;
  const entries = Object.entries(cleaned);
  const totalBytes = estimateJsonBytes(cleaned);

  if (entries.length <= CONTACT_INLINE_MAX_ENTRIES && totalBytes <= CONTACT_INLINE_MAX_BYTES) {
    try {
      await withFirestoreRetry(() =>
        setDoc(doc(db, 'shared_contacts', 'current'), {
          contacts: cleaned,
          shardCount: 0,
          totalContacts: entries.length,
          updatedBy: actorId,
          updatedAt: serverTimestamp(),
        })
      );
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // Shard large company directories cleanly under 1 MiB per Firestore doc
  const shards: Array<Record<string, CompanyContactInfo>> = [];
  let currentShard: Record<string, CompanyContactInfo> = {};
  let currentCount = 0;
  let currentBytes = 32;

  for (const [k, v] of entries) {
    const itemBytes = estimateJsonBytes(v) + k.length + 12;
    if (
      currentCount > 0 &&
      (currentCount >= CONTACT_SHARD_MAX_ENTRIES ||
        currentBytes + itemBytes > CONTACT_SHARD_MAX_BYTES)
    ) {
      shards.push(currentShard);
      currentShard = {};
      currentCount = 0;
      currentBytes = 32;
    }
    currentShard[k] = v;
    currentCount++;
    currentBytes += itemBytes;
  }
  if (currentCount > 0) {
    shards.push(currentShard);
  }

  for (let start = 0; start < shards.length; start += MAX_CONTACT_SHARDS_PER_BATCH) {
    const slice = shards.slice(start, start + MAX_CONTACT_SHARDS_PER_BATCH);
    try {
      await withFirestoreRetry(async () => {
        const batch = writeBatch(db);
        slice.forEach((shardMap, offset) => {
          const idx = start + offset;
          const id = shardDocId(idx);
          batch.set(doc(db, 'shared_contact_shards', id), {
            index: idx,
            contactCount: Object.keys(shardMap).length,
            contacts: shardMap,
            updatedBy: actorId,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shared_contact_shards/batch_${start}`);
    }
  }

  try {
    await withFirestoreRetry(() =>
      setDoc(doc(db, 'shared_contacts', 'current'), {
        contacts: {},
        shardCount: shards.length,
        totalContacts: entries.length,
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveLogsToFirestore(
  logs: DataUpdateLog[],
  actorId: string
): Promise<void> {
  const path = 'shared_logs/current';
  try {
    await withFirestoreRetry(() =>
      setDoc(doc(db, 'shared_logs', 'current'), {
        logs: stripUndefinedDeep(logs || []).slice(0, 200),
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedCloudIfEmpty(
  actorId: string,
  initialState: {
    records: MediaPembawaRecord[];
    customLogo: string | null;
    commodityWatchlist: PriorityCommodityWatchItem[];
    countryWatchlist: PriorityCountryWatchItem[];
    complianceScores: Record<string, CompanyComplianceData>;
    companyContacts: Record<string, CompanyContactInfo>;
    updateLogs: DataUpdateLog[];
  }
): Promise<boolean> {
  let metaSnap;
  try {
    metaSnap = await getDocFromServer(doc(db, 'shared_meta', 'current'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'shared_meta/current');
  }

  // Never touch Cloud if shared_meta/current already exists
  if (metaSnap.exists()) {
    return false;
  }

  const [watchSnap, compSnap, contSnap, brandSnap, logsSnap] = await Promise.all([
    getDocPreferServer(doc(db, 'shared_watchlists', 'current')),
    getDocPreferServer(doc(db, 'shared_compliance', 'current')),
    getDocPreferServer(doc(db, 'shared_contacts', 'current')),
    getDocPreferServer(doc(db, 'shared_branding', 'current')),
    getDocPreferServer(doc(db, 'shared_logs', 'current')),
  ]);

  if (!watchSnap.exists()) {
    await saveWatchlistsToFirestore(
      initialState.commodityWatchlist,
      initialState.countryWatchlist,
      actorId
    );
  }
  if (!compSnap.exists()) {
    await saveComplianceToFirestore(initialState.complianceScores, actorId);
  }
  if (!contSnap.exists()) {
    await saveContactsToFirestore(initialState.companyContacts, actorId);
  }
  if (!logsSnap.exists()) {
    await saveLogsToFirestore(initialState.updateLogs, actorId);
  }
  if (!brandSnap.exists()) {
    await saveBrandingToFirestore(initialState.customLogo || '', actorId);
  }

  // Re-verify right before creating shared_meta/current to prevent race
  const recheck = await getDocFromServer(doc(db, 'shared_meta', 'current'));
  if (recheck.exists()) {
    return false;
  }

  await saveRecordsShardsToFirestore(initialState.records, actorId, 1);
  return true;
}

export function subscribeToSharedCloudStore(
  handlers: CloudHydrationHandlers,
  initialShardVersion = -1
): Unsubscribe {
  let lastSeenShardVersion = initialShardVersion;
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_meta', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const shardVersion = Number(data?.shardVersion || 0);
        const shardCount = Number(data?.shardCount || 0);
        const totalRecords = Number(data?.totalRecords || 0);
        if (shardVersion <= 0 || shardVersion <= lastSeenShardVersion) return;
        lastSeenShardVersion = shardVersion;

        void fetchAllShardsFromFirestore(shardCount)
          .then((records) => {
            handlers.onMetaChanged(
              {
                shardVersion,
                shardCount,
                totalRecords,
                updatedBy: String(data?.updatedBy || ''),
              },
              records
            );
          })
          .catch((err) => {
            handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
          });
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_meta/current', handlers.onError);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_branding', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const raw = snap.data()?.customLogo;
        handlers.onBrandingChanged(typeof raw === 'string' && raw.length > 0 ? raw : null);
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_branding/current', handlers.onError);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_watchlists', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        handlers.onWatchlistsChanged(
          Array.isArray(d?.commodityWatchlist) ? d.commodityWatchlist : [],
          Array.isArray(d?.countryWatchlist) ? d.countryWatchlist : []
        );
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_watchlists/current', handlers.onError);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_compliance', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const scores = snap.data()?.scores;
        if (scores && typeof scores === 'object') {
          handlers.onComplianceChanged(scores as Record<string, CompanyComplianceData>);
        }
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_compliance/current', handlers.onError);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_contacts', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const shardCount = Number(data?.shardCount || 0);
        if (shardCount > 0) {
          void fetchContactsFromFirestore()
            .then((res) => {
              handlers.onContactsChanged(res.contacts);
            })
            .catch((err) => {
              handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
            });
        } else if (data?.contacts && typeof data.contacts === 'object') {
          handlers.onContactsChanged(data.contacts as Record<string, CompanyContactInfo>);
        }
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_contacts/current', handlers.onError);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'shared_logs', 'current'),
      (snap) => {
        if (!snap.exists()) return;
        const logs = snap.data()?.logs;
        if (Array.isArray(logs)) {
          handlers.onLogsChanged(logs as DataUpdateLog[]);
        }
      },
      (error) => {
        forwardSnapshotError(error, OperationType.GET, 'shared_logs/current', handlers.onError);
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}
