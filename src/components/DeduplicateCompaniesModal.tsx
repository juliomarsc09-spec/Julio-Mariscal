import React, { useState } from 'react';
import {
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { MediaPembawaRecord } from '../types';

interface DeduplicateCompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeduplicate: () => Promise<{
    mergedDuplicatesCount: number;
    unifiedCompanyGroupsCount: number;
    sampleMerged: string[];
  }>;
  totalRecordsCount: number;
  uniqueCompaniesCount: number;
}

export const DeduplicateCompaniesModal: React.FC<DeduplicateCompaniesModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeduplicate,
  totalRecordsCount,
  uniqueCompaniesCount,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    mergedDuplicatesCount: number;
    unifiedCompanyGroupsCount: number;
    sampleMerged: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await onConfirmDeduplicate();
      setResult(res);
    } catch (err: any) {
      console.error('Deduplication failed:', err);
      setError(err?.message || 'Gagal menjalankan penyatuan data.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-4 sm:my-8 max-h-[92dvh] overflow-y-auto animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <Layers className="w-5 h-5 text-purple-100" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Penyatuan & Deduplikasi Nama Perusahaan (PT)</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Menstandarkan penulisan nama PT / Non-PT dan menyatukan record transaksi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-900/10 dark:border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Explanation */}
        <div className="glass-sub rounded-2xl p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <div className="space-y-1.5 text-xs">
              <p className="text-slate-900 dark:text-slate-200 font-bold">
                Bagaimana Sistem Menyatukan Data Perusahaan?
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Sistem memindai seluruh entitas pemohon yang memiliki kesamaan nama inti:
              </p>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                <li>
                  Menyatukan variasi nama dengan atau tanpa awalan <strong>PT</strong> (contoh: <span className="text-purple-700 dark:text-purple-300 font-mono">S & C Mitra Abadi</span> disatukan dengan <span className="text-purple-700 dark:text-purple-300 font-mono">PT S & C Mitra Abadi</span>).
                </li>
                <li>
                  Menghilangkan pengulangan penulisan seperti <strong>PT PT</strong> atau <strong>PT. PT.</strong>.
                </li>
                <li>
                  Mengonsolidasikan baris komoditas yang sama: menggabungkan lokasi periksa, negara asal, kode HS, dan menjumlahkan frekuensi pengajuan.
                </li>
                <li>
                  Mempertahankan seluruh lingkup kegiatan (Impor, Ekspor, Domestik Masuk, Domestik Keluar) dan multi-kategori karantina (Hewan, Ikan, Tumbuhan) yang dimiliki perusahaan.
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/10 dark:border-slate-800 text-xs">
            <div className="bg-white/75 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-900/10 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Total Record Saat Ini</span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">{totalRecordsCount.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white/75 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-900/10 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Entitas Perusahaan</span>
              <p className="text-base font-extrabold text-purple-700 dark:text-purple-400 mt-0.5 tabular-nums">{uniqueCompaniesCount.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>

        {/* Success Report */}
        {result && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Proses Penyatuan Selesai & Data Tersimpan!</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-emerald-500/25">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Baris Duplikat Digabung</span>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">{result.mergedDuplicatesCount}</p>
              </div>
              <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-emerald-500/25">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Grup Entitas Disatukan</span>
                <p className="text-lg font-black text-cyan-700 dark:text-cyan-300 mt-0.5 tabular-nums">{result.unifiedCompanyGroupsCount}</p>
              </div>
            </div>

            {result.sampleMerged && result.sampleMerged.length > 0 && (
              <div className="space-y-1.5 pt-1 text-xs">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Contoh Entitas yang Berhasil Disatukan:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-900/10 dark:border-slate-800">
                  {result.sampleMerged.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                      <span className="text-purple-600 dark:text-purple-400">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-500/15 dark:bg-red-950/50 border border-rose-500/35 rounded-2xl p-3.5 text-xs text-rose-800 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-900/10 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-900/15 dark:border-slate-800 transition-all"
          >
            {result ? 'Selesai' : 'Batal'}
          </button>

          {!result ? (
            <button
              type="button"
              onClick={handleExecute}
              disabled={isRunning}
              className="min-h-[44px] inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Penyatuan Data...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Jalankan Penyatuan Sekarang</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow"
            >
              Tutup & Tinjau Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
