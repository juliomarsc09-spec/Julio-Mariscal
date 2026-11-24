import { ComplianceTier, CompanyComplianceData, RiskLevel, ScoreAdjustmentLog } from '../types';

const COMPLIANCE_STORAGE_KEY = 'company_compliance_scores_v1';

// Preset alasan pelanggaran (pengurangan skor) dan apresiasi kepatuhan (penambahan skor)
export const PRESET_PENALTY_REASONS = [
  {
    reason: 'Dokumen karantina tidak lengkap / terlambat diserahkan',
    points: -10,
    category: 'Administrasi',
  },
  {
    reason: 'Ketidaksesuaian jumlah fisik dengan dokumen / segel kontainer rusak',
    points: -15,
    category: 'Fisik & Muatan',
  },
  {
    reason: 'Temuan Organisme Pengganggu Tumbuhan (OPTK) / Hama Penyakit Hewan (HPHK)',
    points: -30,
    category: 'Biosekuriti',
  },
  {
    reason: 'Pelanggaran suhu rantai dingin (Cold Chain) melebihi batas toleransi teknis',
    points: -20,
    category: 'Penanganan Suhu',
  },
  {
    reason: 'Hasil uji laboratorium karantina positif cemaran mikrobiologi / kimiawi',
    points: -25,
    category: 'Laboratorium',
  },
  {
    reason: 'Barang / komoditas media pembawa tidak sesuai pengajuan pos tarif HS',
    points: -20,
    category: 'Kesesuaian Tarif',
  },
  {
    reason: 'Penyampaian data manifest / dokumen pabean palsu atau manipulatif',
    points: -40,
    category: 'Integritas Dokumen',
  },
];

export const PRESET_BONUS_REASONS = [
  {
    reason: 'Fasilitas mandiri cold storage / instalasi karantina berstandar ISO & HACCP',
    points: 10,
    category: 'Fasilitas & Mutu',
  },
  {
    reason: 'Histori kepatuhan nihil temuan pelanggaran selama 6 bulan berturut-turut',
    points: 15,
    category: 'Rekam Jejak Kepatuhan',
  },
  {
    reason: 'Kerapian dan kelengkapan dokumen karantina 100% presisi dan tepat waktu',
    points: 10,
    category: 'Administrasi Unggul',
  },
  {
    reason: 'Kerjasama proaktif pemenuhan syarat karantina dan uji laboratorium tuntas',
    points: 10,
    category: 'Kerjasama Petugas',
  },
];

export function calculateComplianceTier(score: number): ComplianceTier {
  if (score >= 80) return 'HIJAU';
  if (score >= 50) return 'KUNING';
  return 'MERAH';
}

export function calculateTierRiskLevel(tier: ComplianceTier, score: number): RiskLevel {
  if (tier === 'HIJAU') return 'RENDAH';
  if (tier === 'KUNING') return 'SEDANG';
  return score < 30 ? 'SANGAT TINGGI' : 'TINGGI';
}

export function hydrateComplianceScoresFromServer(
  scores: Record<string, CompanyComplianceData> | undefined | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = scores && typeof scores === 'object' ? scores : {};
    localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent('compliance_scores_updated', { detail: { source: 'cloud' } })
    );
  } catch (e) {
    console.error('Failed to hydrate compliance scores from server:', e);
  }
}

async function persistComplianceToServer(
  allScores: Record<string, CompanyComplianceData>,
  log: {
    actionType: 'PENILAIAN_SKOR';
    title: string;
    description: string;
    recordsAffected: number;
    officerName: string;
  }
): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        scores: allScores,
        replace: true,
        log,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.complianceScores && typeof data.complianceScores === 'object') {
        try {
          localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(data.complianceScores));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('compliance_scores_updated', { detail: { source: 'cloud' } })
            );
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error('Failed to persist compliance scores to server:', err);
  }
}

export function getAllComplianceScores(): Record<string, CompanyComplianceData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COMPLIANCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read compliance scores from localStorage:', e);
    return {};
  }
}

export function getCompanyComplianceData(applicantName: string): CompanyComplianceData {
  const allScores = getAllComplianceScores();
  const normalizedKey = applicantName.trim().toUpperCase();

  if (allScores[normalizedKey]) {
    return allScores[normalizedKey];
  }

  // Default: Skor 100 (Jalur Hijau / Kepatuhan Tinggi)
  const defaultData: CompanyComplianceData = {
    applicantName: normalizedKey,
    baseScore: 100,
    currentScore: 100,
    tier: 'HIJAU',
    logs: [],
    updatedAt: new Date().toISOString(),
  };

  return defaultData;
}

export function adjustCompanyComplianceScore(
  applicantName: string,
  params: {
    type: 'PENAMBAHAN' | 'PENGURANGAN';
    points: number; // positive number passed, e.g. 15
    reason: string;
    referenceNo?: string;
    officerName?: string;
  }
): CompanyComplianceData {
  const normalizedKey = applicantName.trim().toUpperCase();
  const current = getCompanyComplianceData(normalizedKey);

  const effectiveDelta =
    params.type === 'PENGURANGAN' ? -Math.abs(params.points) : Math.abs(params.points);

  const previousScore = current.currentScore;
  const newScore = Math.max(0, Math.min(100, previousScore + effectiveDelta));

  const previousTier = current.tier;
  const newTier = calculateComplianceTier(newScore);

  const newLog: ScoreAdjustmentLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    applicantName: normalizedKey,
    type: params.type,
    points: effectiveDelta,
    reason: params.reason.trim(),
    referenceNo: params.referenceNo?.trim() || undefined,
    officerName: params.officerName?.trim() || 'Petugas BBKHIT DKI Jakarta',
    previousScore,
    newScore,
    previousTier,
    newTier,
    timestamp: new Date().toISOString(),
  };

  const updatedData: CompanyComplianceData = {
    applicantName: normalizedKey,
    baseScore: current.baseScore,
    currentScore: newScore,
    tier: newTier,
    logs: [newLog, ...current.logs],
    updatedAt: new Date().toISOString(),
  };

  const allScores = getAllComplianceScores();
  allScores[normalizedKey] = updatedData;

  const logEntry = {
    actionType: 'PENILAIAN_SKOR' as const,
    title: `Skor Kepatuhan: ${normalizedKey} (${newScore}/100)`,
    description: `${params.type === 'PENGURANGAN' ? 'Pengurangan' : 'Penambahan'} ${Math.abs(effectiveDelta)} poin (${params.reason.trim()}). Jalur: ${newTier}.`,
    recordsAffected: 1,
    officerName: newLog.officerName || 'Petugas BBKHIT DKI Jakarta',
  };

  try {
    localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(allScores));
    window.dispatchEvent(
      new CustomEvent('compliance_scores_updated', {
        detail: { source: 'local', applicantName: normalizedKey, data: updatedData, log: logEntry },
      })
    );
  } catch (e) {
    console.error('Failed to save compliance scores to localStorage:', e);
  }

  void persistComplianceToServer(allScores, logEntry);

  return updatedData;
}

export function resetCompanyComplianceScore(applicantName: string): CompanyComplianceData {
  const normalizedKey = applicantName.trim().toUpperCase();
  const current = getCompanyComplianceData(normalizedKey);

  const previousScore = current.currentScore;
  const previousTier = current.tier;

  const resetLog: ScoreAdjustmentLog = {
    id: `log-${Date.now()}-reset`,
    applicantName: normalizedKey,
    type: 'PENAMBAHAN',
    points: 100 - previousScore,
    reason: 'Reset Skor Kepatuhan ke Standar Awal 100 (Jalur Hijau)',
    officerName: 'Administrator BBKHIT DKI Jakarta',
    previousScore,
    newScore: 100,
    previousTier,
    newTier: 'HIJAU',
    timestamp: new Date().toISOString(),
  };

  const updatedData: CompanyComplianceData = {
    applicantName: normalizedKey,
    baseScore: 100,
    currentScore: 100,
    tier: 'HIJAU',
    logs: [resetLog, ...current.logs],
    updatedAt: new Date().toISOString(),
  };

  const allScores = getAllComplianceScores();
  allScores[normalizedKey] = updatedData;

  const logEntry = {
    actionType: 'PENILAIAN_SKOR' as const,
    title: `Reset Skor Kepatuhan: ${normalizedKey}`,
    description: `Mengembalikan skor kepatuhan ${normalizedKey} ke standar awal 100 (Jalur Hijau).`,
    recordsAffected: 1,
    officerName: 'Administrator BBKHIT DKI Jakarta',
  };

  try {
    localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(allScores));
    window.dispatchEvent(
      new CustomEvent('compliance_scores_updated', {
        detail: { source: 'local', applicantName: normalizedKey, data: updatedData, log: logEntry },
      })
    );
  } catch (e) {
    console.error('Failed to reset compliance score in localStorage:', e);
  }

  void persistComplianceToServer(allScores, logEntry);

  return updatedData;
}

export function deleteCompanyScoreLog(applicantName: string, logId: string): CompanyComplianceData {
  const normalizedKey = applicantName.trim().toUpperCase();
  const current = getCompanyComplianceData(normalizedKey);

  const remainingLogs = current.logs.filter((l) => l.id !== logId);

  let calculatedScore = 100;
  const sortedLogs = [...remainingLogs].reverse();
  sortedLogs.forEach((log) => {
    calculatedScore = Math.max(0, Math.min(100, calculatedScore + log.points));
  });

  const updatedData: CompanyComplianceData = {
    applicantName: normalizedKey,
    baseScore: 100,
    currentScore: calculatedScore,
    tier: calculateComplianceTier(calculatedScore),
    logs: remainingLogs,
    updatedAt: new Date().toISOString(),
  };

  const allScores = getAllComplianceScores();
  allScores[normalizedKey] = updatedData;

  const logEntry = {
    actionType: 'PENILAIAN_SKOR' as const,
    title: `Hapus Riwayat Skor: ${normalizedKey}`,
    description: `Menghapus entri penyesuaian skor kepatuhan untuk ${normalizedKey}. Skor kini ${calculatedScore}/100 (${updatedData.tier}).`,
    recordsAffected: 1,
    officerName: 'Administrator BBKHIT DKI Jakarta',
  };

  try {
    localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(allScores));
    window.dispatchEvent(
      new CustomEvent('compliance_scores_updated', {
        detail: { source: 'local', applicantName: normalizedKey, data: updatedData, log: logEntry },
      })
    );
  } catch (e) {
    console.error('Failed to update compliance scores after log deletion:', e);
  }

  void persistComplianceToServer(allScores, logEntry);

  return updatedData;
}
