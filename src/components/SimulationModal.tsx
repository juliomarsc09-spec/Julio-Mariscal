import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Sparkles,
  Building2,
  Package,
  Globe2,
  MapPin,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react';
import {
  QuarantineCategory,
  RiskLevel,
  MediaPembawaRecord,
  TradeActivityType,
} from '../types';
import {
  getUniquePemohonList,
  getUniqueKomoditasList,
  getUniqueOrigins,
  getUniqueInspectionSites,
  calculateAutomaticRisk,
} from '../data/quarantineData';

interface SimulationModalProps {
  data: MediaPembawaRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSaveNewRecord: (record: MediaPembawaRecord) => void | Promise<void>;
  onRunAIRiskAnalysis: (
    pemohon: string,
    komoditas: string,
    kategori: QuarantineCategory,
    asal: string,
    tempatPeriksa: string,
    kodeHs: string
  ) => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  data,
  isOpen,
  onClose,
  onSaveNewRecord,
  onRunAIRiskAnalysis,
}) => {
  const pemohonList = getUniquePemohonList(data);
  const komoditasList = getUniqueKomoditasList(data);
  const originList = getUniqueOrigins(data);
  const siteList = getUniqueInspectionSites(data);

  // Form State (declared unconditionally before any return)
  const [pemohon, setPemohon] = useState(pemohonList[0] || 'PT HANORA CARGO');
  const [komoditas, setKomoditas] = useState(komoditasList[0] || 'Daging Sapi');
  const [kategori, setKategori] = useState<QuarantineCategory>('HEWAN');
  const [jenisKegiatan, setJenisKegiatan] = useState<TradeActivityType>('IMPOR');
  const [asal, setAsal] = useState(originList[0] || 'AUSTRALIA');
  const [tempatPeriksa, setTempatPeriksa] = useState(siteList[0] || 'JICT');
  const [kodeHs, setKodeHs] = useState('02023000');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Simulation Result State
  const [simulatedResult, setSimulatedResult] = useState<{
    riskLevel: RiskLevel;
    riskScore: number;
    requiredDocs: string[];
    quarantineActions: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');

    const { riskLevel, riskScore } = calculateAutomaticRisk(
      kategori,
      komoditas,
      [asal]
    );

    const requiredDocs = [
      'Sertifikat Sanitasi / Kesehatan / Phytosanitary dari Negara Asal',
      'Surat Persetujuan Impor (SPI) Kementerian Perdagangan',
      'Dokumen Pelayaran (Bill of Lading & Packing List)',
      'Surat Rekomendasi Impor Teknis',
    ];

    const quarantineActions = [
      'Pemeriksaan Kelengkapan Dokumen Fisik di TPS',
      'Pemeriksaan Fisik Organoleptik dan Rantai Dingin (Cold Storage)',
      'Pengambilan Sampel Laboratorium untuk Bebas Penyakit Karantina',
      'Penetapan Sertifikat Pelepasan (KH-11/KI-11/KT-11)',
    ];

    setSimulatedResult({
      riskLevel,
      riskScore,
      requiredDocs,
      quarantineActions,
    });
  };

  const handleSaveToDatabase = async () => {
    if (!simulatedResult || isSaving) return;

    const newRecord: MediaPembawaRecord = {
      id: `custom-${Date.now()}`,
      no: data.length + 1,
      kategori,
      jenisKegiatan,
      pemohon,
      komoditas,
      tempatPeriksa: [tempatPeriksa],
      tempatPeriksaRaw: tempatPeriksa,
      asal: [asal],
      asalRaw: asal,
      kodeHs: [kodeHs],
      kodeHsRaw: kodeHs,
      tingkatRisiko: simulatedResult.riskLevel,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setSaveError('');
    try {
      await onSaveNewRecord(newRecord);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Gagal menyimpan hasil simulasi ke server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-6 my-4 sm:my-8 max-h-[92dvh] overflow-y-auto animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Simulasi Pengajuan Karantina & Kalkulator Risiko
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Uji coba penilaian tingkat risiko karantina sebelum pengajuan fisik dokumen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRunSimulation} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pemohon */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Nama Pemohon / Perusahaan</span>
              </label>
              <input
                type="text"
                list="pemohon-options"
                value={pemohon}
                onChange={(e) => setPemohon(e.target.value)}
                placeholder="Pilih atau ketik nama perusahaan..."
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <datalist id="pemohon-options">
                {pemohonList.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Komoditas */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Komoditas / Media Pembawa</span>
              </label>
              <input
                type="text"
                list="komoditas-options"
                value={komoditas}
                onChange={(e) => setKomoditas(e.target.value)}
                placeholder="Pilih atau ketik komoditas..."
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                required
              />
              <datalist id="komoditas-options">
                {komoditasList.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </div>

            {/* Kategori */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori Karantina</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as QuarantineCategory)}
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="HEWAN">Karantina Hewan</option>
                <option value="IKAN">Karantina Ikan</option>
                <option value="TUMBUHAN">Karantina Tumbuhan</option>
              </select>
            </div>

            {/* Jenis Kegiatan */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jenis Kegiatan</label>
              <select
                value={jenisKegiatan}
                onChange={(e) => setJenisKegiatan(e.target.value as TradeActivityType)}
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="IMPOR">Impor</option>
                <option value="EKSPOR">Ekspor</option>
                <option value="DOMESTIK MASUK">Domestik Masuk</option>
                <option value="DOMESTIK KELUAR">Domestik Keluar</option>
              </select>
            </div>

            {/* Asal / Tujuan */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Globe2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Asal / Tujuan</span>
              </label>
              <input
                type="text"
                list="origin-options"
                value={asal}
                onChange={(e) => setAsal(e.target.value)}
                placeholder="Ketik atau pilih negara/kota..."
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <datalist id="origin-options">
                {originList.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            {/* Tempat Periksa */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Tempat Pemeriksaan (TPS)</span>
              </label>
              <input
                type="text"
                list="site-options"
                value={tempatPeriksa}
                onChange={(e) => setTempatPeriksa(e.target.value)}
                placeholder="Pilih lokasi Tempat Pemeriksaan Fisik (TPF/TPS/Depo)..."
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                required
              />
              <datalist id="site-options">
                {siteList.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Kode HS */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Kode HS</span>
              </label>
              <input
                type="text"
                value={kodeHs}
                onChange={(e) => setKodeHs(e.target.value)}
                placeholder="Contoh: 02023000"
                className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-950 border border-slate-900/15 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="submit"
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow"
            >
              Hitung Profil Risiko
            </button>
            <button
              type="button"
              onClick={() =>
                onRunAIRiskAnalysis(pemohon, komoditas, kategori, asal, tempatPeriksa, kodeHs)
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow flex items-center justify-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Analisis Lanjut AI Risk</span>
            </button>
          </div>
        </form>

        {/* Simulation Output Card */}
        {simulatedResult && (
          <div className="glass-sub p-5 rounded-2xl space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/10 dark:border-white/10 pb-3">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                  Hasil Simulasi
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Tingkat Risiko: <span className="text-amber-700 dark:text-amber-400">{simulatedResult.riskLevel}</span> ({simulatedResult.riskScore}/100)
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveToDatabase()}
                className="min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 dark:hover:bg-emerald-600/30 transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Database'}</span>
              </button>
            </div>
            {saveError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/35 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 font-semibold">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-300">Dokumen Wajib Harus Dilengkapi:</p>
                <div className="space-y-1">
                  {simulatedResult.requiredDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-300">Prosedur Petugas Karantina:</p>
                <div className="space-y-1">
                  {simulatedResult.quarantineActions.map((act, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-slate-700 dark:text-slate-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
