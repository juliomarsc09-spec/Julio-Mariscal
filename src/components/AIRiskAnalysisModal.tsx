import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RotateCcw,
  Building2,
  Package,
  Globe2,
  MapPin,
  Loader2,
  Check,
} from 'lucide-react';
import { QuarantineCategory, AIRiskAnalysisResponse } from '../types';

interface AIRiskAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  pemohon: string;
  komoditas: string;
  kategori?: QuarantineCategory;
  asal?: string;
  tempatPeriksa?: string;
  kodeHs?: string;
}

export const AIRiskAnalysisModal: React.FC<AIRiskAnalysisModalProps> = ({
  isOpen,
  onClose,
  pemohon,
  komoditas,
  kategori = 'HEWAN',
  asal = 'BELGIA / BRASIL / AUSTRALIA',
  tempatPeriksa = 'JICT',
  kodeHs = '02023000',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiData, setAiData] = useState<AIRiskAnalysisResponse | null>(null);
  const [engineMode, setEngineMode] = useState<string>('BBKHIT AI Quarantine Engine');

  useEffect(() => {
    if (isOpen && pemohon && komoditas) {
      runAIAnalysis();
    }
  }, [isOpen, pemohon, komoditas]);

  const runAIAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/quarantine-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pemohon,
          komoditas,
          kategori,
          asal,
          tempatPeriksa,
          kodeHs,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Gagal memproses analisis AI.');
      }

      setAiData(resData.data);
      if (resData.mode === 'GEMINI_CLOUD') {
        setEngineMode('Gemini 2.5 Flash Cloud');
      } else {
        setEngineMode('BBKHIT Biosecurity AI Engine');
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setError(err?.message || 'Gagal menghubungi server Gemini AI.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'SANGAT TINGGI':
        return 'bg-rose-500/15 text-rose-700 dark:text-red-300 border-rose-500/30';
      case 'TINGGI':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
      case 'SEDANG':
        return 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="glass-modal rounded-3xl max-w-3xl w-full flex flex-col max-h-[92dvh] overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/10 gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl text-white shadow-lg shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Laporan Profil AI Risk
                </h3>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span>Mode AI Aktif</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                  {engineMode}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 truncate">
                Evaluasi otomatis intelijen biosecurity & persyaratan karantina BBKHIT DKI Jakarta
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={runAIAnalysis}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Jalankan Ulang Analisis AI"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-500 dark:text-purple-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Tutup modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
          {/* Input Parameters Summary */}
          <div className="glass-sub p-4 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Pemohon</span>
              </span>
              <p className="font-bold text-slate-900 dark:text-white mt-1 truncate">{pemohon}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Package className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>Komoditas</span>
              </span>
              <p className="font-bold text-cyan-700 dark:text-cyan-300 mt-1 truncate">{komoditas}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Globe2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span>Asal</span>
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{asal}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Tempat Periksa</span>
              </span>
              <p className="font-bold text-amber-700 dark:text-amber-300 mt-1 truncate">{tempatPeriksa}</p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-14 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Menganalisis Profil Risiko Karantina...
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Mengevaluasi regulasi karantina, riwayat komoditas, dan tingkat bahaya HPHK/HPIK/OPTK...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-rose-500/10 border border-rose-500/25 p-4 rounded-2xl text-xs space-y-2 text-rose-700 dark:text-red-300">
              <p className="font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Gagal Memproses Analisis AI</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">{error}</p>
              <button
                type="button"
                onClick={runAIAnalysis}
                className="mt-2 inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 dark:text-red-300 border border-rose-500/30 rounded-xl font-semibold min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          )}

          {/* AI Result Card */}
          {aiData && !loading && (
            <div className="space-y-4 animate-fadeIn">
              {/* Risk Gauge */}
              <div className="glass-sub p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold block">
                    Penilaian Risiko AI
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getRiskBadge(
                        aiData.riskLevel
                      )}`}
                    >
                      {aiData.riskLevel}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Skor: {aiData.riskScore}/100
                    </span>
                  </div>
                </div>

                <div className="w-full sm:w-40 bg-slate-200 dark:bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-300 dark:border-slate-800 p-0.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full rounded-full"
                    style={{ width: `${aiData.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="glass-sub p-4 rounded-2xl space-y-1 text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest text-[10px] block">
                  Ringkasan Profil Risiko
                </span>
                <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {aiData.summary}
                </p>
              </div>

              {/* Threats & Documents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Threats */}
                <div className="glass-sub p-4 rounded-2xl space-y-2">
                  <span className="font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest text-[10px] flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Potensi Bahaya Hama/Penyakit</span>
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {aiData.potentialThreats?.map((threat, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2 text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 font-medium"
                      >
                        <span className="w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full mt-1.5 shrink-0" />
                        <span>{threat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div className="glass-sub p-4 rounded-2xl space-y-2">
                  <span className="font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest text-[10px] flex items-center space-x-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Dokumen Wajib Diperiksa</span>
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {aiData.requiredDocuments?.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2 text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <span>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions & Notes */}
              <div className="glass-sub p-4 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest text-[10px] flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Rekomendasi Tindakan Operasional Petugas</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  {aiData.quarantineActions?.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2 text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 font-medium"
                    >
                      <span className="w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
                {aiData.recommendationNote && (
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-800/80 italic font-medium">
                    Note: {aiData.recommendationNote}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with prominent "Selesai" button when finished */}
        {!loading && (aiData || error) && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200/60 dark:border-white/10 bg-white/45 dark:bg-slate-950/70 backdrop-blur-md flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {aiData
                ? 'Analisis AI Risk telah selesai ditampilkan.'
                : 'Silakan ulangi analisis atau tutup jendela ini.'}
            </span>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={runAIAnalysis}
                className="px-4 py-2.5 rounded-2xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-all min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Analisis Ulang</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center space-x-2 shadow-lg shadow-emerald-950/20 transition-all active:scale-95 min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>Selesai</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
