import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertTriangle,
  Trash2,
  BookmarkPlus,
  CheckCircle2,
} from 'lucide-react';
import {
  QuarantineCategory,
  PriorityCommodityWatchItem,
  WatchPriorityLevel,
} from '../types';
import {
  saveWatchlistCommodity,
  removeWatchlistCommodity,
  getWatchlistCommodityItem,
  normalizePriorityLevel,
} from '../data/watchlistData';

interface PriorityCommodityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCommodityName: string;
  currentCategory?: QuarantineCategory;
  allAvailableCommodities: string[];
  onUpdated: () => void;
}

const PRIORITY_OPTIONS: Array<{
  value: WatchPriorityLevel;
  label: string;
  desc: string;
  activeClass: string;
  dotClass: string;
}> = [
  {
    value: 'LOW',
    label: 'Low',
    desc: 'Monitoring rutin & verifikasi dokumen',
    activeClass:
      'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/60 shadow-sm',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    desc: 'Pemeriksaan fisik & uji sampling berkala',
    activeClass:
      'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/60 shadow-sm',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'HIGH',
    label: 'High',
    desc: 'Pengawasan ketat 100% & uji laboratorium wajib',
    activeClass:
      'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/60 shadow-sm',
    dotClass: 'bg-rose-500',
  },
];

export const PriorityCommodityModal: React.FC<PriorityCommodityModalProps> = ({
  isOpen,
  onClose,
  currentCommodityName,
  currentCategory = 'HEWAN',
  allAvailableCommodities,
  onUpdated,
}) => {
  const [commodityName, setCommodityName] = useState(currentCommodityName);
  const [category, setCategory] = useState<QuarantineCategory>(currentCategory);
  const [priorityLevel, setPriorityLevel] = useState<WatchPriorityLevel>('MEDIUM');
  const [reason, setReason] = useState('');
  const [regulationRef, setRegulationRef] = useState('');
  const [targetActionsText, setTargetActionsText] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [isExistingWatchlist, setIsExistingWatchlist] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeName = currentCommodityName || allAvailableCommodities[0] || '';
      setCommodityName(activeName);
      setErrorMsg(null);
      setConfirmDelete(false);
      loadExistingData(activeName);
    }
  }, [isOpen, currentCommodityName]);

  const loadExistingData = (name: string) => {
    const existing = getWatchlistCommodityItem(name);
    if (existing) {
      setIsExistingWatchlist(true);
      setCategory(existing.category);
      setPriorityLevel(normalizePriorityLevel(existing.priorityLevel));
      setReason(existing.reason);
      setRegulationRef(existing.regulationRef || '');
      setTargetActionsText(existing.targetActions.join('\n'));
      setOfficerName(existing.officerName || '');
    } else {
      setIsExistingWatchlist(false);
      setCategory(currentCategory || 'HEWAN');
      setPriorityLevel('MEDIUM');
      setReason('');
      setRegulationRef('');
      setTargetActionsText(
        'Pemeriksaan fisik 100% sampel peti kemas\nPengujian Laboratorium Uji Virologi/Mikrobiologi\nVerifikasi dokumen perizinan impor & sertifikat pelepasan'
      );
      setOfficerName('Petugas Pengawas Karantina BBKHIT DKI');
    }
  };

  const handleCommodityChange = (name: string) => {
    setCommodityName(name);
    setConfirmDelete(false);
    setErrorMsg(null);
    loadExistingData(name);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodityName.trim()) {
      setErrorMsg('Nama komoditas wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Alasan pengawasan utama wajib diisi oleh petugas.');
      return;
    }

    const actions = targetActionsText
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const watchItem: PriorityCommodityWatchItem = {
      id: `p-comm-${Date.now()}`,
      commodityName: commodityName.trim(),
      category,
      reason: reason.trim(),
      regulationRef: regulationRef.trim() || 'Instruksi Pengawasan Teknis Karantina',
      targetActions:
        actions.length > 0 ? actions : ['Pemeriksaan Fisik dan Pengujian Laboratorium Wajib'],
      officerName: officerName.trim() || 'Petugas Karantina BBKHIT DKI',
      addedAt: new Date().toISOString(),
      priorityLevel,
    };

    saveWatchlistCommodity(watchItem);
    onUpdated();
    onClose();
  };

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeWatchlistCommodity(commodityName);
    onUpdated();
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-500/12 via-white/30 to-transparent dark:from-amber-950/60 dark:via-slate-900/40 dark:to-transparent border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                <span>Pengawasan Utama Komoditas</span>
                {isExistingWatchlist && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase font-bold">
                    Aktif Dalam Daftar
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate">
                Input manual pengawasan prioritas karantina oleh pejabat pemeriksa BBKHIT DKI Jakarta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSave}
          className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin"
        >
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Commodity Name Selector / Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Komoditas Target <span className="text-amber-600 dark:text-amber-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={commodityName}
                onChange={(e) => handleCommodityChange(e.target.value)}
                placeholder="Contoh: Daging Sapi, Gandum, Udang..."
                className="flex-1 glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium min-h-[42px]"
                required
              />
              {allAvailableCommodities.length > 0 && (
                <select
                  value={commodityName}
                  onChange={(e) => handleCommodityChange(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-amber-500 sm:max-w-[200px] min-h-[42px]"
                >
                  <option value="">Pilih dari data...</option>
                  {allAvailableCommodities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Kategori Karantina
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as QuarantineCategory)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 min-h-[42px]"
            >
              <option value="HEWAN">Hewan (HPHK)</option>
              <option value="IKAN">Ikan (HPIK)</option>
              <option value="TUMBUHAN">Tumbuhan (OPTK)</option>
            </select>
          </div>

          {/* Priority Level: 3 Categories (Low, Medium, High) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tingkat Prioritas Pengawasan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priorityLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriorityLevel(opt.value)}
                    className={`p-3 rounded-2xl border text-left transition-all min-h-[56px] flex flex-col justify-between ${
                      isSelected
                        ? opt.activeClass
                        : 'glass-sub text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wide">
                        <span className={`w-2.5 h-2.5 rounded-full ${opt.dotClass}`} />
                        <span>{opt.label}</span>
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </div>
                    <span className="text-[10px] opacity-85 font-medium mt-1 leading-snug">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alasan Pengawasan Utama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                Alasan Pengawasan Utama Petugas <span className="text-amber-600 dark:text-amber-400">*</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Wajib diisi</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Peningkatan kasus transmisi virus PMK di negara pengekspor, temuan parasit berulang pada batch sebelumnya, atau instruksi pencegahan wabah."
              className="w-full glass-input rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              required
            />
          </div>

          {/* Dasar Hukum / Surat Edaran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Dasar Hukum / Surat Edaran / Instruksi Teknis
            </label>
            <input
              type="text"
              value={regulationRef}
              onChange={(e) => setRegulationRef(e.target.value)}
              placeholder="Contoh: Surat Edaran Kepala Badan Karantina No. 04/SE/K.1/2024"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]"
            />
          </div>

          {/* Tindakan Karantina Khusus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tindakan Karantina Khusus / Target Pengujian (1 baris per tindakan)
            </label>
            <textarea
              rows={3}
              value={targetActionsText}
              onChange={(e) => setTargetActionsText(e.target.value)}
              placeholder="Contoh:&#10;Uji RT-PCR konfirmasi patogen&#10;Pemeriksaan suhu kontainer berkala&#10;Fumigasi di pelabuhan muat"
              className="w-full glass-input rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono text-[11px]"
            />
          </div>

          {/* Nama Petugas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Petugas Pengawas / NIP
            </label>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="Contoh: drh. Hendra K., M.Si (NIP. 19850314...)"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {isExistingWatchlist ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all min-h-[44px] ${
                    confirmDelete
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/35'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmDelete ? 'Konfirmasi Hapus' : 'Hapus dari Pengawasan'}</span>
                </button>
                {confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 min-h-[40px]"
                  >
                    Batal
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center space-x-2 shadow-lg transition-all active:scale-95 min-h-[44px]"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Simpan Pengawasan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
