import { MediaPembawaRecord, QuarantineCategory } from '../types';

/**
 * Extracts the core name of a company by stripping legal entity prefixes (PT, CV, UD, etc.)
 * and suffixes (PT, CV, TBK, PERSERO), handling repeated prefixes like "PT PT", "PT. PT.", etc.
 */
export function extractCompanyCoreName(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();

  // Strip leading repeated entity types like "PT PT", "PT. PT.", "PT ", "PT. ", "CV ", "UD ", etc.
  s = s.replace(/^(PT[\s\.\,\-]+)+/i, '')
       .replace(/^(CV[\s\.\,\-]+)+/i, '')
       .replace(/^(UD[\s\.\,\-]+)+/i, '')
       .replace(/^(PD[\s\.\,\-]+)+/i, '')
       .replace(/^(KOP[\s\.\,\-]+)+/i, '')
       .replace(/^(KOPERASI[\s\.\,\-]+)+/i, '')
       .trim();

  // Strip trailing entity suffixes like ", PT", " PT", " TBK", " PERSERO"
  s = s.replace(/[\s\.\,\-]+(PT|CV|UD|TBK|PERSERO)$/i, '').trim();

  // Clean extra internal punctuation and whitespace
  s = s.toUpperCase().replace(/\s+/g, ' ');

  return s;
}

/**
 * Builds a mapping from any raw company name variation to its standardized canonical name.
 * If any variation contains "PT", it standardizes to "PT <Core Name>".
 * If it has "CV", it standardizes to "CV <Core Name>".
 * If it has "UD", it standardizes to "UD <Core Name>".
 * E.g., "S & C Mitra Abadi" and "PT S & C Mitra Abadi" both map to "PT S & C MITRA ABADI".
 */
export function buildCanonicalCompanyMap(
  inputs: (MediaPembawaRecord | string)[]
): Map<string, string> {
  const coreInfoMap = new Map<
    string,
    { hasPT: boolean; hasCV: boolean; hasUD: boolean; rawVariants: Set<string> }
  >();

  inputs.forEach((item) => {
    const raw = (typeof item === 'string' ? item : item.pemohon || '').trim();
    if (!raw) return;

    const core = extractCompanyCoreName(raw);
    if (!core) return;

    if (!coreInfoMap.has(core)) {
      coreInfoMap.set(core, {
        hasPT: false,
        hasCV: false,
        hasUD: false,
        rawVariants: new Set(),
      });
    }

    const info = coreInfoMap.get(core)!;
    info.rawVariants.add(raw);

    // Detect if this variation specifies PT, CV, or UD
    if (/\bPT\b|\bP\.T\b|^PT[\s\.\,]/i.test(raw)) info.hasPT = true;
    if (/\bCV\b|\bC\.V\b|^CV[\s\.\,]/i.test(raw)) info.hasCV = true;
    if (/\bUD\b|\bU\.D\b|^UD[\s\.\,]/i.test(raw)) info.hasUD = true;
  });

  const resultMap = new Map<string, string>();

  coreInfoMap.forEach((info, core) => {
    let canonical = core;
    if (info.hasPT) {
      canonical = `PT ${core}`;
    } else if (info.hasCV) {
      canonical = `CV ${core}`;
    } else if (info.hasUD) {
      canonical = `UD ${core}`;
    } else {
      // Default to PT if it's a corporate name with 2 or more words
      canonical = `PT ${core}`;
    }

    // Map each raw variant to the canonical name
    info.rawVariants.forEach((variant) => {
      resultMap.set(variant.toUpperCase().trim(), canonical);
      resultMap.set(variant.trim(), canonical);
    });

    // Also map core itself
    resultMap.set(core, canonical);
  });

  return resultMap;
}

/**
 * Resolves a single company name to its canonical form
 */
export function getCanonicalCompanyName(
  raw: string,
  canonicalMap?: Map<string, string>
): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  if (canonicalMap) {
    const direct = canonicalMap.get(trimmed) || canonicalMap.get(trimmed.toUpperCase());
    if (direct) return direct;
  }

  const core = extractCompanyCoreName(trimmed);
  if (!core) return trimmed.toUpperCase();

  // If starts with CV or UD
  if (/^CV[\s\.\,]/i.test(trimmed)) return `CV ${core}`;
  if (/^UD[\s\.\,]/i.test(trimmed)) return `UD ${core}`;

  // Default corporate entities to PT
  return `PT ${core}`;
}

/**
 * Merges two comma/semicolon-separated string lists without overwriting existing values,
 * deduplicating case-insensitively while preserving original order.
 */
export function mergeDelimitedLists(existingVal?: string, incomingVal?: string): string {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushItems = (raw?: string) => {
    if (!raw) return;
    const parts = String(raw)
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const key = part.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(part);
      }
    }
  };

  pushItems(existingVal);
  pushItems(incomingVal);
  return result.join(', ');
}

/**
 * Adds incoming numeric frequency onto existing frequency when both are valid numbers.
 */
export function accumulateFrequency(
  existingFreq?: string | number,
  incomingFreq?: string | number
): string | number | undefined {
  const parseNum = (v?: string | number): number | null => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const a = parseNum(existingFreq);
  const b = parseNum(incomingFreq);
  if (a !== null && b !== null) {
    const sum = a + b;
    return Number.isInteger(sum) ? sum : Number(sum.toFixed(2));
  }
  if (b !== null) return b;
  if (a !== null) return a;
  const fallback = String(incomingFreq ?? existingFreq ?? '').trim();
  return fallback || undefined;
}


export interface DeduplicationSummary {
  deduplicatedRecords: MediaPembawaRecord[];
  originalRecordsCount: number;
  deduplicatedRecordsCount: number;
  mergedDuplicatesCount: number;
  uniqueCompaniesBefore: number;
  uniqueCompaniesAfter: number;
  consolidatedGroups: {
    canonicalName: string;
    variants: string[];
    commoditiesCount: number;
  }[];
}

/**
 * Consolidates all records by unifying company names (e.g. S & C Mitra Abadi & PT S & C Mitra Abadi),
 * preventing duplicate rows while preserving multi-category (Hewan/Ikan/Tumbuhan)
 * and multi-activity (Impor/Ekspor/Domestik Masuk/Domestik Keluar) per company.
 */
export function deduplicateCompanyRecords(
  records: MediaPembawaRecord[]
): DeduplicationSummary {
  const canonicalMap = buildCanonicalCompanyMap(records);
  const uniqueCompaniesBefore = new Set(records.map((r) => r.pemohon.trim().toUpperCase())).size;

  // Track variants per canonical company for reporting
  const variantsPerCanonical = new Map<string, Set<string>>();
  records.forEach((r) => {
    const canonicalComp = getCanonicalCompanyName(r.pemohon, canonicalMap);
    if (!variantsPerCanonical.has(canonicalComp)) {
      variantsPerCanonical.set(canonicalComp, new Set());
    }
    variantsPerCanonical.get(canonicalComp)!.add(r.pemohon.trim());
  });

  // Deduplicate and consolidate records: key = canonicalCompany ::: category ::: activity ::: commodityName
  const recordIndexMap = new Map<string, MediaPembawaRecord>();

  records.forEach((r) => {
    const canonicalComp = getCanonicalCompanyName(r.pemohon, canonicalMap);
    const cleanComm = (r.komoditas || '').trim();
    const commKey = cleanComm.toUpperCase();
    const category = r.kategori;
    const activity = r.jenisKegiatan || 'IMPOR';
    const dedupeKey = `${canonicalComp}:::${category}:::${activity}:::${commKey}`;

    const rTempat = Array.isArray(r.tempatPeriksa) ? r.tempatPeriksa : [];
    const rAsal = Array.isArray(r.asal) ? r.asal : [];
    const rHs = Array.isArray(r.kodeHs) ? r.kodeHs : [];

    if (!recordIndexMap.has(dedupeKey)) {
      recordIndexMap.set(dedupeKey, {
        ...r,
        pemohon: canonicalComp,
        komoditas: cleanComm,
        kategori: category,
        jenisKegiatan: activity,
        tempatPeriksa: [...rTempat],
        tempatPeriksaRaw: rTempat.join(', '),
        asal: [...rAsal],
        asalRaw: rAsal.join(', '),
        kodeHs: [...rHs],
        kodeHsRaw: rHs.join(', '),
        catatanKarantina: r.catatanKarantina || '',
        frekuensi: r.frekuensi || 1,
      });
    } else {
      const existing = recordIndexMap.get(dedupeKey)!;

      // Merge places of inspection
      const mergedPlaces = Array.from(new Set([...existing.tempatPeriksa, ...rTempat]));
      // Merge origin countries
      const mergedOrigins = Array.from(new Set([...existing.asal, ...rAsal]));
      // Merge HS Codes
      const mergedHs = Array.from(new Set([...existing.kodeHs, ...rHs]));

      // Merge notes
      let mergedNotes = existing.catatanKarantina || '';
      if (r.catatanKarantina && !mergedNotes.includes(r.catatanKarantina)) {
        mergedNotes = mergedNotes ? `${mergedNotes}; ${r.catatanKarantina}` : r.catatanKarantina;
      }

      recordIndexMap.set(dedupeKey, {
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

  // Re-index 1..N
  const deduplicatedRecords = Array.from(recordIndexMap.values()).map((r, i) => ({
    ...r,
    no: i + 1,
  }));

  const uniqueCompaniesAfter = new Set(deduplicatedRecords.map((r) => r.pemohon)).size;

  const consolidatedGroups: DeduplicationSummary['consolidatedGroups'] = [];
  variantsPerCanonical.forEach((variantsSet, canonical) => {
    if (variantsSet.size > 1) {
      const commoditiesCount = deduplicatedRecords.filter((r) => r.pemohon === canonical).length;
      consolidatedGroups.push({
        canonicalName: canonical,
        variants: Array.from(variantsSet),
        commoditiesCount,
      });
    }
  });

  return {
    deduplicatedRecords,
    originalRecordsCount: records.length,
    deduplicatedRecordsCount: deduplicatedRecords.length,
    mergedDuplicatesCount: records.length - deduplicatedRecords.length,
    uniqueCompaniesBefore,
    uniqueCompaniesAfter,
    consolidatedGroups,
  };
}
