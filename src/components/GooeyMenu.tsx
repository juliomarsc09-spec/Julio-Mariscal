import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  History,
  Layers,
  FileSpreadsheet,
  PlusCircle,
  ShieldAlert,
  Trash2,
  Camera,
  Sun,
  Moon,
} from 'lucide-react';
import { ThemeMode } from '../types';

interface GooeyMenuProps {
  onOpenUpdateHistory: () => void;
  onOpenDeduplicate: () => void;
  onOpenImportExcel: () => void;
  onOpenAddRecord: () => void;
  onOpenSimulation: () => void;
  onOpenUploadLogo: () => void;
  onClearAllData: () => void;
  totalRecordsCount?: number;
  isOpenControlled?: boolean;
  onToggleControlled?: (open: boolean) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export const GooeyMenu: React.FC<GooeyMenuProps> = ({
  onOpenUpdateHistory,
  onOpenDeduplicate,
  onOpenImportExcel,
  onOpenAddRecord,
  onOpenSimulation,
  onOpenUploadLogo,
  onClearAllData,
  isOpenControlled,
  onToggleControlled,
  themeMode,
  onToggleTheme,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (onToggleControlled) {
      onToggleControlled(val);
    } else {
      setInternalOpen(val);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const menuActions = [
    {
      id: 'theme',
      label: themeMode === 'night' ? 'Mode Day Light' : 'Mode Night',
      sublabel: themeMode === 'night' ? 'Ubah ke Tampilan Cerah Siang' : 'Ubah ke Tampilan Gelap Malam',
      icon: themeMode === 'night' ? Sun : Moon,
      color:
        themeMode === 'night'
          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/35'
          : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 shadow-slate-900/35',
      border: themeMode === 'night' ? 'border-amber-300/60' : 'border-indigo-400/40',
      action: () => {
        onToggleTheme();
        setIsOpen(false);
      },
    },
    {
      id: 'history',
      label: 'Riwayat Update',
      sublabel: 'Audit Trail & Histori Perubahan',
      icon: History,
      color: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40',
      border: 'border-indigo-400/40',
      action: () => {
        onOpenUpdateHistory();
        setIsOpen(false);
      },
    },
    {
      id: 'dedupe',
      label: 'Satukan Nama PT',
      sublabel: 'Deduplikasi Variasi PT / Non-PT',
      icon: Layers,
      color: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40',
      border: 'border-purple-400/40',
      action: () => {
        onOpenDeduplicate();
        setIsOpen(false);
      },
    },
    {
      id: 'import',
      label: 'Impor Excel',
      sublabel: 'Tambah Data Excel & Spreadsheet',
      icon: FileSpreadsheet,
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40',
      border: 'border-emerald-400/40',
      action: () => {
        onOpenImportExcel();
        setIsOpen(false);
      },
    },
    {
      id: 'add',
      label: 'Tambah Data',
      sublabel: 'Input Data Manual Transaksi Baru',
      icon: PlusCircle,
      color: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40',
      border: 'border-blue-400/40',
      action: () => {
        onOpenAddRecord();
        setIsOpen(false);
      },
    },
    {
      id: 'simulate',
      label: 'Simulasi Karantina',
      sublabel: 'Uji Penilaian Profil & Alur Pemeriksaan',
      icon: ShieldAlert,
      color: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40',
      border: 'border-amber-400/40',
      action: () => {
        onOpenSimulation();
        setIsOpen(false);
      },
    },
    {
      id: 'logo',
      label: 'Ganti Logo',
      sublabel: 'Upload Foto Logo Transparan Manual',
      icon: Camera,
      color: 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/40',
      border: 'border-teal-400/40',
      action: () => {
        onOpenUploadLogo();
        setIsOpen(false);
      },
    },
    {
      id: 'clear',
      label: 'Kosongkan Data',
      sublabel: 'Hapus Selektif KH/KI/KT & Arus Perdagangan',
      icon: Trash2,
      color: 'bg-red-700 hover:bg-red-600 text-white shadow-red-950/40',
      border: 'border-red-400/40',
      action: () => {
        onClearAllData();
        setIsOpen(false);
      },
      danger: true,
    },
  ];

  return (
    <>
      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-sm transition-opacity animate-fadeIn"
        />
      )}

      {/* Floating Crisp Glassy Speed-Dial Container (Bottom-Right) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
        {/* Sharp Unfiltered Action List */}
        <div
          className={`flex flex-col items-end space-y-2 mb-3 max-h-[78dvh] overflow-y-auto px-1 py-1 transition-all duration-200 origin-bottom-right ${
            isOpen
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
          }`}
        >
          {menuActions.map((item) => {
            const IconComp = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className="group flex items-center space-x-2.5 cursor-pointer text-left focus:outline-none"
                title={`${item.label} - ${item.sublabel}`}
              >
                {/* High-Contrast Crisp Text Card */}
                <div
                  className={`px-3.5 py-2 rounded-2xl border shadow-lg backdrop-blur-xl transition-transform duration-150 group-hover:scale-[1.02] max-w-[calc(100vw-6.5rem)] sm:max-w-[300px] ${
                    'danger' in item && item.danger
                      ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-100'
                      : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-white/15 text-slate-900 dark:text-white group-hover:border-indigo-400/60'
                  }`}
                >
                  <div className="text-xs font-extrabold leading-snug whitespace-nowrap truncate">
                    {item.label}
                  </div>
                  <div
                    className={`text-[10px] font-medium leading-tight truncate ${
                      'danger' in item && item.danger
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.sublabel}
                  </div>
                </div>

                {/* Circular Action Icon Badge */}
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${item.color} border ${item.border} flex items-center justify-center shadow-lg transition-transform duration-150 group-hover:scale-105 active:scale-95 shrink-0 overflow-hidden`}
                >
                  <IconComp className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Central Menu Aksi Trigger Button */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-200 transform active:scale-90 border backdrop-blur-xl ${
              isOpen
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 rotate-90 shadow-rose-950/60'
                : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 border-white/30 shadow-indigo-950/70 hover:scale-105'
            }`}
            title="Menu Aksi Operasional (Mode Tampilan, Riwayat, Satukan PT, Impor, Tambah, Simulasi, Ganti Logo, Kosongkan Data)"
            aria-label="Buka Menu Aksi Operasional"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Floating Tooltip when closed (desktop hover) */}
          {!isOpen && (
            <div className="hidden sm:block absolute right-16 top-1/2 -translate-y-1/2 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-slate-100 px-3 py-1.5 rounded-xl shadow-xl text-xs font-bold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              Menu Aksi Operasional
            </div>
          )}
        </div>
      </div>
    </>
  );
};
