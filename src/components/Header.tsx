import React from 'react';
import {
  ShieldAlert,
  Search,
  Sparkles,
  BarChart3,
  Building2,
  Package,
  FileSpreadsheet,
  RotateCcw,
  Globe2,
  LayoutGrid,
  Camera,
  Sun,
  Moon,
} from 'lucide-react';
import { ActiveNavTab, ThemeMode } from '../types';

interface HeaderProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenAIAnalysis: () => void;
  onToggleGooeyMenu: () => void;
  isGooeyOpen: boolean;
  onResetFilters: () => void;
  totalRecordsCount: number;
  customLogo?: string | null;
  onOpenUploadLogo: () => void;
  themeMode: ThemeMode;
  onSelectThemeMode: (mode: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenAIAnalysis,
  onToggleGooeyMenu,
  isGooeyOpen,
  onResetFilters,
  totalRecordsCount,
  customLogo,
  onOpenUploadLogo,
  themeMode,
  onSelectThemeMode,
}) => {
  return (
    <header className="glass-header border-b text-slate-900 dark:text-white md:sticky md:top-0 z-40 pb-1 transition-colors duration-200">
      {/* Top Title & Quick Actions Bar */}
      <div className="max-w-[1860px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3 sm:pt-4 pb-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Brand identity with transparent logo container */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onOpenUploadLogo}
            className="relative group cursor-pointer shrink-0 focus:outline-none"
            title="Klik untuk ganti logo Q-BIOCHECK (tersedia juga di Menu Aksi)"
          >
            <div className="w-11 h-11 bg-transparent rounded-2xl flex items-center justify-center border border-slate-900/15 dark:border-white/20 overflow-hidden group-hover:border-indigo-500/70 group-hover:scale-105 transition-all">
              {customLogo ? (
                <img
                  src={customLogo}
                  alt="Logo Q-BIOCHECK"
                  className="w-full h-full object-contain p-0.5 bg-transparent"
                />
              ) : (
                <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
              )}
            </div>
            {/* Camera badge overlay */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white/95 dark:bg-slate-950/80 backdrop-blur-md border border-slate-900/15 dark:border-white/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 opacity-90 group-hover:opacity-100 shadow-md group-hover:scale-110 transition-all">
              <Camera className="w-2.5 h-2.5" />
            </div>
          </button>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white font-sans truncate">
                Q-BIOCHECK
              </h1>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium tracking-wide leading-snug">
              Profiling Media Pembawa Karantina • Ekspor, Impor & Domestik • BBKHIT DKI Jakarta ({totalRecordsCount.toLocaleString('id-ID')} Record)
            </p>
          </div>
        </div>

        {/* Header Right Actions: Mode Tampilan + AI Risk + Menu Aksi */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Day Light / Night Mode Selector */}
          <div
            role="group"
            aria-label="Pilih Mode Tampilan Day Light atau Night"
            className="inline-flex items-center glass-sub p-1 rounded-2xl shadow-inner"
          >
            <button
              type="button"
              onClick={() => onSelectThemeMode('day')}
              aria-pressed={themeMode === 'day'}
              className={`min-h-[38px] sm:min-h-[34px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                themeMode === 'day'
                  ? 'bg-white text-amber-700 shadow-sm border border-amber-400/40'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Aktifkan Mode Day Light (Terang)"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Day Light</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectThemeMode('night')}
              aria-pressed={themeMode === 'night'}
              className={`min-h-[38px] sm:min-h-[34px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                themeMode === 'night'
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-400/50'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Aktifkan Mode Night (Gelap)"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span>Night</span>
            </button>
          </div>

          {/* AI Risk Modal Launcher */}
          <button
            type="button"
            onClick={onOpenAIAnalysis}
            className="min-h-[42px] sm:min-h-[38px] inline-flex items-center space-x-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/20 dark:shadow-indigo-950/50 transition-all active:scale-95 border border-indigo-400/40 backdrop-blur-md whitespace-nowrap"
            title="Analisis Risiko Karantina Otomatis Berbasis AI"
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>AI Risk</span>
          </button>

          {/* Menu Aksi Launcher Button */}
          <button
            type="button"
            onClick={onToggleGooeyMenu}
            className={`min-h-[42px] sm:min-h-[38px] inline-flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all active:scale-95 border shadow-lg backdrop-blur-md whitespace-nowrap ${
              isGooeyOpen
                ? 'bg-rose-600 text-white border-rose-400/60 shadow-rose-950/30'
                : 'bg-slate-900/90 dark:bg-slate-900/60 hover:bg-slate-800 text-cyan-100 dark:text-cyan-200 border-slate-700 dark:border-white/15 hover:border-cyan-400/50 shadow-slate-900/15 dark:shadow-cyan-950/40'
            }`}
            title="Buka Menu Aksi: Riwayat Update, Satukan PT, Impor Excel, Tambah Data, Simulasi, Ganti Logo, Mode Tampilan & Kosongkan"
          >
            <LayoutGrid className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Menu Aksi</span>
          </button>
        </div>
      </div>

      {/* Bento Nav Ribbon */}
      <div className="max-w-[1860px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 py-1.5 sm:py-2">
        <div className="glass-sub rounded-2xl p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-inner">
          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`min-h-[42px] sm:min-h-[36px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/25 border border-indigo-400/40'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/8 dark:hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('applicant')}
              className={`min-h-[42px] sm:min-h-[36px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'applicant'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/25 border border-indigo-400/40'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/8 dark:hover:bg-white/10'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Profil Perusahaan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('commodity')}
              className={`min-h-[42px] sm:min-h-[36px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'commodity'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/25 border border-indigo-400/40'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/8 dark:hover:bg-white/10'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Profil Komoditas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('country')}
              className={`min-h-[42px] sm:min-h-[36px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'country'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/25 border border-indigo-400/40'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/8 dark:hover:bg-white/10'
              }`}
            >
              <Globe2 className="w-4 h-4 shrink-0" />
              <span>Profil Negara</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`min-h-[42px] sm:min-h-[36px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'table'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/25 border border-indigo-400/40'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/8 dark:hover:bg-white/10'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Tabel Master Data</span>
            </button>
          </nav>

          {/* Global Search Bar */}
          <div className="flex items-center space-x-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72 2xl:w-80">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari perusahaan / komoditas / asal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[40px] sm:min-h-[34px] glass-input text-slate-900 dark:text-slate-100 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Reset Filter Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={onResetFilters}
                title="Reset Pencarian"
                className="min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-white/90 dark:bg-slate-950/50 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl border border-slate-300 dark:border-white/15 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
