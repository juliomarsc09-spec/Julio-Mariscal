import React, { useState, useMemo, useEffect } from 'react';
import {
  Trash2,
  X,
  AlertTriangle,
  Beef,
  Fish,
  Sprout,
  Layers,
  Filter,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MediaPembawaRecord, QuarantineCategory, TradeActivityType } from '../types';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: MediaPembawaRecord[];
  onConfirmClear: (
    activity: TradeActivityType | 'ALL',
    category: QuarantineCategory | 'ALL',
    passcode: string
  ) => void | Promise<void>;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  records,
  onConfirmClear,
}) => {
  const [selectedActivity, setSelectedActivity] = useState<TradeActivityType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<QuarantineCategory | 'ALL'>('ALL');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setShowPasscode(false);
      setErrorMsg('');
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Calculate matching records to delete
  const matchingRecords = useMemo(() => {
    return records.filter((r) => {
      const matchActivity =
        selectedActivity === 'ALL' ||
        (r.jenisKegiatan || 'IMPOR').toUpperCase() === selectedActivity.toUpperCase();

      const matchCategory =
        selectedCategory === 'ALL' ||
        (r.kategori || '').toUpperCase() === selectedCategory.toUpperCase();

      return matchActivity && matchCategory;
    });
  }, [records, selectedActivity, selectedCategory]);

  const deleteCount = matchingRecords.length;
  const remainingCount = records.length - deleteCount;

  if (!isOpen) return null;

  const handleExecuteClear = async () => {
    if (deleteCount === 0 || isDeleting) return;
    if (!passcode.trim()) {
      setErrorMsg('Kode sandi otorisasi wajib diisi untuk menghapus data.');
      return;
    }
    setIsDeleting(true);
    setErrorMsg('');
    try {
      await onConfirmClear(selectedActivity, selectedCategory, passcode.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Kode sandi penghapusan tidak valid atau gagal menghapus data.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="glass-modal rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 my-4 max-h-[92dvh] overflow-y-auto text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Kosongkan / Hapus Data Permanen
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Menghapus permanen data yang diupload dari server sesuai arus & bidang karantina
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white glass-sub rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Pilih Arus Perdagangan */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>1. Pilih Arus Kegiatan Perdagangan</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'ALL', label: 'Semua Arus' },
              { id: 'IMPOR', label: 'Hanya Impor' },
              { id: 'EKSPOR', label: 'Hanya Ekspor' },
              { id: 'DOMESTIK MASUK', label: 'Domestik Masuk' },
              { id: 'DOMESTIK KELUAR', label: 'Domestik Keluar' },
            ].map((item) => {
              const isSelected = selectedActivity === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedActivity(item.id as any)}
                  className={`min-h-[42px] px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'glass-sub text-slate-800 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Pilih Kategori Karantina (KH, KI, KT) */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>2. Pilih Bidang Karantina (KH / KI / KT)</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'ALL', label: 'Semua Bidang', icon: Layers, color: 'text-slate-600 dark:text-slate-300' },
              { id: 'HEWAN', label: 'KH (Hewan)', icon: Beef, color: 'text-amber-600 dark:text-amber-400' },
              { id: 'IKAN', label: 'KI (Ikan)', icon: Fish, color: 'text-cyan-600 dark:text-cyan-400' },
              { id: 'TUMBUHAN', label: 'KT (Tumbuhan)', icon: Sprout, color: 'text-emerald-600 dark:text-emerald-400' },
            ].map((item) => {
              const isSelected = selectedCategory === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedCategory(item.id as any)}
                  className={`min-h-[68px] p-3 rounded-xl text-xs font-bold text-left transition-all border flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'glass-sub text-slate-800 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : item.color}`} />
                  <span className="block truncate text-[11px]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Calculation & Impact Preview */}
        <div className="glass-sub p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
              Ringkasan Tindakan
            </span>
            <span className="text-slate-800 dark:text-slate-200 tabular-nums">
              Total Database: {records.length.toLocaleString('id-ID')} Record
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-rose-500/12 dark:bg-rose-950/45 border border-rose-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300 tracking-wider block">
                Akan Dihapus Permanen
              </span>
              <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-0.5 tabular-nums">
                {deleteCount.toLocaleString('id-ID')} Record
              </p>
              <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 truncate">
                {selectedActivity === 'ALL' ? 'Semua Arus' : selectedActivity} •{' '}
                {selectedCategory === 'ALL' ? 'Semua KH/KI/KT' : selectedCategory}
              </p>
            </div>

            <div className="bg-emerald-500/12 dark:bg-emerald-950/45 border border-emerald-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider block">
                Tetap Tersimpan
              </span>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                {remainingCount.toLocaleString('id-ID')} Record
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                Data lain tetap aman di server
              </p>
            </div>
          </div>

          {deleteCount > 0 && (
            <div className="flex items-start space-x-2 text-[11px] text-amber-800 dark:text-amber-200/90 pt-1">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p>
                Tindakan ini menghapus {deleteCount.toLocaleString('id-ID')} record secara permanen
                dari server dan tersinkron ke semua perangkat.
              </p>
            </div>
          )}

          {deleteCount === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-1">
              Tidak ada data yang cocok dengan kombinasi filter arus & bidang di atas.
            </p>
          )}
        </div>

        {/* Section 3: Kode / Sandi Otorisasi Penghapusan */}
        <div className="space-y-2">
          <label
            htmlFor="clear-data-passcode"
            className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2"
          >
            <KeyRound className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>3. Kode / Sandi Otorisasi Penghapusan</span>
          </label>
          <div className="relative">
            <input
              id="clear-data-passcode"
              type={showPasscode ? 'text' : 'password'}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleExecuteClear();
                }
              }}
              autoComplete="off"
              placeholder="Masukkan kode sandi otorisasi..."
              className="w-full min-h-[44px] glass-input rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
            <button
              type="button"
              onClick={() => setShowPasscode((prev) => !prev)}
              aria-label={showPasscode ? 'Sembunyikan sandi' : 'Lihat sandi'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg transition-colors"
            >
              {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-start space-x-2 rounded-xl bg-rose-500/15 border border-rose-500/35 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white glass-sub hover:bg-white/75 dark:hover:bg-white/10 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={deleteCount === 0 || !passcode.trim() || isDeleting}
            onClick={() => void handleExecuteClear()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isDeleting
                ? 'Menghapus Permanen...'
                : deleteCount === records.length && records.length > 0
                ? `Hapus Semua (${records.length.toLocaleString('id-ID')} Record)`
                : `Hapus Permanen ${deleteCount.toLocaleString('id-ID')} Record`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
