import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  History,
  X,
  Search,
  FileSpreadsheet,
  PlusCircle,
  Layers,
  Trash2,
  ShieldAlert,
  Clock,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { DataUpdateLog, UpdateActionType } from '../types';

interface DataUpdateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DataUpdateLog[];
}

export const DataUpdateHistoryModal: React.FC<DataUpdateHistoryModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<UpdateActionType | 'ALL'>('ALL');

  if (!isOpen || typeof document === 'undefined') return null;

  const filteredLogs = logs.filter((log) => {
    if (selectedType !== 'ALL' && log.actionType !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = log.title.toLowerCase().includes(q);
      const matchDesc = log.description.toLowerCase().includes(q);
      const matchOfficer = (log.officerName || '').toLowerCase().includes(q);
      return matchTitle || matchDesc || matchOfficer;
    }
    return true;
  });

  const getActionBadge = (type: UpdateActionType) => {
    switch (type) {
      case 'DEDUPLIKASI_PERUSAHAAN':
        return {
          icon: Layers,
          color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
          label: 'Penyatuan Entitas PT',
        };
      case 'IMPOR_EXCEL':
        return {
          icon: FileSpreadsheet,
          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
          label: 'Impor Excel',
        };
      case 'TAMBAH_DATA':
        return {
          icon: PlusCircle,
          color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          label: 'Tambah Record',
        };
      case 'HAPUS_SELEKTIF':
        return {
          icon: Trash2,
          color: 'bg-rose-500/15 text-rose-700 dark:text-red-300 border-rose-500/30',
          label: 'Hapus Data',
        };
      case 'PENILAIAN_SKOR':
        return {
          icon: ShieldAlert,
          color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
          label: 'Skor Kepatuhan',
        };
      case 'PENGAWASAN_UTAMA':
        return {
          icon: AlertTriangle,
          color: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
          label: 'Pengawasan Utama',
        };
      case 'KONTAK_PERUSAHAAN':
        return {
          icon: UserCheck,
          color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
          label: 'Kontak Perusahaan',
        };
      default:
        return {
          icon: History,
          color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
          label: 'Aktivitas Data',
        };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-3xl max-w-4xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[90dvh] overflow-y-auto animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                <span>Riwayat Pembaruan Data</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                  {logs.length} Log Audit
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Log jejak audit perubahan data, impor Excel, deduplikasi nama PT, dan penyesuaian skor
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/10 dark:border-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari deskripsi, judul atau petugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[42px] glass-input rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Action Filter Pills */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedType === 'ALL'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-900/15 dark:border-slate-800'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('IMPOR_EXCEL')}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedType === 'IMPOR_EXCEL'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-900/15 dark:border-slate-800'
              }`}
            >
              Impor
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('TAMBAH_DATA')}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedType === 'TAMBAH_DATA'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-900/15 dark:border-slate-800'
              }`}
            >
              Tambah
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('DEDUPLIKASI_PERUSAHAAN')}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedType === 'DEDUPLIKASI_PERUSAHAAN'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-900/15 dark:border-slate-800'
              }`}
            >
              Satukan PT
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('PENILAIAN_SKOR')}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedType === 'PENILAIAN_SKOR'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-900/15 dark:border-slate-800'
              }`}
            >
              Skor
            </button>
          </div>
        </div>

        {/* Logs Feed */}
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.actionType);
              const IconComp = badge.icon;
              const dateObj = new Date(log.timestamp);
              const formattedDate = dateObj.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="glass-sub hover:border-cyan-500/40 dark:hover:border-white/25 rounded-2xl p-4 transition-all space-y-2 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center space-x-1.5 ${badge.color}`}>
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                        {log.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{formattedDate}, {formattedTime} WIB</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    {log.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900/10 dark:border-slate-900 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Oleh: <strong className="text-slate-900 dark:text-slate-200">{log.officerName}</strong></span>
                    </span>

                    {log.recordsAffected > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-900/10 dark:border-slate-800 font-bold">
                        {log.recordsAffected} Record Terdampak
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 space-y-2 glass-sub rounded-2xl">
              <History className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Tidak ada catatan pembaruan</p>
              <p className="text-[11px] text-slate-500">
                Belum ada log riwayat yang sesuai dengan kriteria filter saat ini.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-900/10 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Audit Trail Sistem Q-BIOCHECK</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
