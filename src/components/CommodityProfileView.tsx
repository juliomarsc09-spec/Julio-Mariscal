import React, { useState, useEffect } from 'react';
import {
  Package,
  ShieldAlert,
  Search,
  Building2,
  Globe2,
  MapPin,
  FileCode,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Calendar,
  UserCheck,
  BookOpen,
} from 'lucide-react';
import {
  MediaPembawaRecord,
  TradeActivityType,
  WatchPriorityLevel,
} from '../types';
import {
  getCommodityProfile,
  getUniqueKomoditasList,
} from '../data/quarantineData';
import {
  getWatchlistCommodityItem,
  getAllWatchlistCommodities,
  normalizePriorityLevel,
  formatPriorityLabel,
} from '../data/watchlistData';
import { PriorityCommodityModal } from './PriorityCommodityModal';

interface CommodityProfileViewProps {
  data: MediaPembawaRecord[];
  selectedCommodityName: string;
  onSelectCommodityName: (name: string) => void;
  onSelectApplicant: (pemohon: string) => void;
  onSelectCountry?: (country: string) => void;
  onRunAIForCommodity: (komoditas: string) => void;
}

const getPriorityBadgeStyles = (level?: string) => {
  const norm: WatchPriorityLevel = normalizePriorityLevel(level);
  if (norm === 'LOW') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35';
  }
  if (norm === 'MEDIUM') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35';
  }
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35';
};

export const CommodityProfileView: React.FC<CommodityProfileViewProps> = ({
  data,
  selectedCommodityName,
  onSelectCommodityName,
  onSelectApplicant,
  onSelectCountry,
  onRunAIForCommodity,
}) => {
  const allCommodities = getUniqueKomoditasList(data);
  const [searchFilter, setSearchFilter] = useState('');
  const [watchlistFilterMode, setWatchlistFilterMode] = useState<'ALL' | 'WATCHLIST_ONLY'>('ALL');
  const [selectedTradeActivity, setSelectedTradeActivity] = useState<TradeActivityType | 'ALL'>('ALL');
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [watchlistKey, setWatchlistKey] = useState(0);

  useEffect(() => {
    const handleWatchlistUpdate = () => {
      setWatchlistKey((prev) => prev + 1);
    };
    window.addEventListener('watchlist_updated', handleWatchlistUpdate);
    return () => window.removeEventListener('watchlist_updated', handleWatchlistUpdate);
  }, []);

  const activeName = selectedCommodityName || allCommodities[0] || '';
  const profile = getCommodityProfile(data, activeName, selectedTradeActivity);

  const activeWatchItem = getWatchlistCommodityItem(activeName);
  const isActiveWatchlist = !!activeWatchItem;

  const watchlistItems = getAllWatchlistCommodities();
  const watchlistByName = new Map(
    watchlistItems.map((w) => [w.commodityName.toLowerCase(), normalizePriorityLevel(w.priorityLevel)])
  );

  const filteredCommodityList = allCommodities.filter((name) => {
    const matchesSearch = name.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (watchlistFilterMode === 'WATCHLIST_ONLY') {
      return watchlistByName.has(name.toLowerCase());
    }
    return true;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 animate-fadeIn pb-12" key={watchlistKey}>
      {/* Left Sidebar: Commodity Selector */}
      <div className="lg:col-span-4 xl:col-span-3 glass-panel rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col max-h-[300px] lg:max-h-[780px]">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            Katalog Media Pembawa
          </span>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Pilih Komoditas</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {allCommodities.length} Jenis
            </span>
          </div>
        </div>

        {/* Watchlist Filter Toggle */}
        <div className="flex items-center glass-sub p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setWatchlistFilterMode('ALL')}
            className={`flex-1 py-2 rounded-lg transition-all min-h-[38px] ${
              watchlistFilterMode === 'ALL'
                ? 'bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Semua ({allCommodities.length})
          </button>
          <button
            type="button"
            onClick={() => setWatchlistFilterMode('WATCHLIST_ONLY')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all min-h-[38px] ${
              watchlistFilterMode === 'WATCHLIST_ONLY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Pengawasan ({watchlistItems.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari jenis komoditas..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full glass-input text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-medium min-h-[40px]"
          />
        </div>

        {/* Commodity List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {filteredCommodityList.map((name) => {
            const isSelected = name.toLowerCase() === activeName.toLowerCase();
            const watchPriority = watchlistByName.get(name.toLowerCase());

            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectCommodityName(name)}
                className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs transition-all flex items-center justify-between group min-h-[44px] ${
                  isSelected
                    ? 'bg-cyan-600 text-white font-bold shadow-md border border-cyan-400/40'
                    : 'glass-sub hover:bg-white/75 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-300 font-medium'
                }`}
              >
                <div className="flex items-center space-x-2 truncate pr-2">
                  {watchPriority && (
                    <span
                      title={`Prioritas Pengawasan: ${formatPriorityLabel(watchPriority)}`}
                      className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[9px] font-extrabold uppercase ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : getPriorityBadgeStyles(watchPriority)
                      }`}
                    >
                      {formatPriorityLabel(watchPriority)}
                    </span>
                  )}
                  <span className="truncate">{name}</span>
                </div>
                <ArrowRight
                  className={`w-3.5 h-3.5 transition-transform shrink-0 ${
                    isSelected
                      ? 'text-white translate-x-0.5'
                      : 'text-slate-400 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-400'
                  }`}
                />
              </button>
            );
          })}
          {filteredCommodityList.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">
              {watchlistFilterMode === 'WATCHLIST_ONLY'
                ? 'Tidak ada komoditas dalam pengawasan utama'
                : 'Komoditas tidak ditemukan'}
            </p>
          )}
        </div>
      </div>

      {/* Main Panel: Commodity Deep-Dive Profile */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
        {profile ? (
          <>
            {/* Header Card */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Spesifikasi Media Pembawa
                    </span>
                    {isActiveWatchlist && activeWatchItem && (
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getPriorityBadgeStyles(
                          activeWatchItem.priorityLevel
                        )}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          Pengawasan Utama • {formatPriorityLabel(activeWatchItem.priorityLevel)}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
                      <Package className="w-6 h-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight break-words">
                          {profile.name}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-950 text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-800 uppercase">
                          {profile.kategori}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                        Media Pembawa Terdaftar di BBKHIT DKI Jakarta
                      </p>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWatchlistModalOpen(true)}
                    className={`inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95 border min-h-[44px] ${
                      isActiveWatchlist
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 shadow-sm'
                    }`}
                    title="Kelola status Pengawasan Utama Komoditas"
                  >
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        isActiveWatchlist
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-amber-600 dark:text-amber-500'
                      }`}
                    />
                    <span>{isActiveWatchlist ? 'Edit Pengawasan' : '+ Pengawasan Utama'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRunAIForCommodity(profile.name)}
                    className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 border border-indigo-400/30 min-h-[44px]"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Analisis AI</span>
                  </button>
                </div>
              </div>

              {/* Priority Watchlist Banner if active */}
              {isActiveWatchlist && activeWatchItem && (
                <div className="bg-amber-50/90 dark:bg-gradient-to-r dark:from-amber-950/70 dark:via-slate-950 dark:to-slate-950 border border-amber-300 dark:border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-amber-900 dark:text-amber-200 tracking-wide uppercase">
                          KOMODITAS DALAM PENGAWASAN UTAMA PETUGAS KARANTINA
                        </h4>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-amber-800 dark:text-amber-400/90 font-medium">
                            Tingkat Prioritas:
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getPriorityBadgeStyles(
                              activeWatchItem.priorityLevel
                            )}`}
                          >
                            {formatPriorityLabel(activeWatchItem.priorityLevel)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{new Date(activeWatchItem.addedAt).toLocaleDateString('id-ID')}</span>
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-2 border-t border-amber-200 dark:border-amber-500/20">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px]">
                        Alasan Pengawasan Petugas:
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed font-medium bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20">
                        "{activeWatchItem.reason}"
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {activeWatchItem.regulationRef && (
                        <div className="flex items-start space-x-2 text-[11px]">
                          <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-slate-600 dark:text-slate-400 block font-semibold">
                              Dasar Hukum / Regulasi:
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {activeWatchItem.regulationRef}
                            </span>
                          </div>
                        </div>
                      )}

                      {activeWatchItem.officerName && (
                        <div className="flex items-start space-x-2 text-[11px]">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-slate-600 dark:text-slate-400 block font-semibold">
                              Petugas Pengawas:
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {activeWatchItem.officerName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {activeWatchItem.targetActions && activeWatchItem.targetActions.length > 0 && (
                      <div className="pt-1">
                        <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px] mb-1">
                          Tindakan Karantina Khusus & Pengujian Lab Wajib:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeWatchItem.targetActions.map((action, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium"
                            >
                              ✓ {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pilihan Pembagian Jenis Arus */}
              <div className="glass-sub p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 pl-1">
                  Pilihan Arus Kegiatan:
                </span>
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTradeActivity('ALL')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                      selectedTradeActivity === 'ALL'
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Semua ({Object.values(profile.tradeActivitiesBreakdown).reduce((a, b) => a + b, 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTradeActivity('IMPOR')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                      selectedTradeActivity === 'IMPOR'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Impor ({profile.tradeActivitiesBreakdown['IMPOR'] || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTradeActivity('EKSPOR')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                      selectedTradeActivity === 'EKSPOR'
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Ekspor ({profile.tradeActivitiesBreakdown['EKSPOR'] || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTradeActivity('DOMESTIK MASUK')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                      selectedTradeActivity === 'DOMESTIK MASUK'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Domestik Masuk ({profile.tradeActivitiesBreakdown['DOMESTIK MASUK'] || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTradeActivity('DOMESTIK KELUAR')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
                      selectedTradeActivity === 'DOMESTIK KELUAR'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Domestik Keluar ({profile.tradeActivitiesBreakdown['DOMESTIK KELUAR'] || 0})
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Total Pengajuan
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {profile.totalDeclarations}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Record</span>
                  </p>
                </div>

                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Entitas Pelaku Usaha
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                    {profile.importers.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Pemohon</span>
                  </p>
                </div>

                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Kategori Kegiatan
                  </span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile.tradeActivities.map((act) => (
                      <span
                        key={act}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          act === 'EKSPOR'
                            ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30'
                            : act === 'DOMESTIK MASUK'
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                            : act === 'DOMESTIK KELUAR'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {act} ({profile.tradeActivitiesBreakdown[act] || 0})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Kategori Risiko
                  </span>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getRiskColor(
                        profile.riskLevel
                      )}`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                      {profile.riskLevel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Importers & Country Origins */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Importers List */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3 flex flex-col">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Perusahaan Pelaku Usaha
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Perusahaan yang Memasukkan / Mengimpor (
                      {profile.importerDetails?.length || profile.importers.length})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Daftar perusahaan terdaftar yang mentransaksikan {profile.name}
                  </p>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 pt-1 flex-1 scrollbar-thin">
                  {profile.importerDetails && profile.importerDetails.length > 0 ? (
                    profile.importerDetails.map((imp) => (
                      <div
                        key={imp.pemohon}
                        className="glass-sub hover:border-emerald-500/40 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 group transition-all"
                      >
                        <div className="space-y-1 truncate pr-2">
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 block truncate text-xs">
                            {imp.pemohon}
                          </span>
                          <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-800 font-bold">
                              {imp.count} Deklarasi
                            </span>
                            {imp.origins.length > 0 && (
                              <span className="truncate max-w-[160px]">
                                Asal: {imp.origins.slice(0, 2).join(', ')}
                                {imp.origins.length > 2 ? '...' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectApplicant(imp.pemohon)}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-600 text-slate-700 dark:text-slate-300 hover:text-white text-[11px] font-bold flex items-center space-x-1 border border-slate-200 dark:border-slate-800 transition-all self-start sm:self-center min-h-[36px]"
                        >
                          <span>Profil Perusahaan</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Tidak ada perusahaan pengimpor untuk filter ini.
                    </p>
                  )}
                </div>
              </div>

              {/* Origins */}
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3 flex flex-col">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Asal Geografis
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                    <Globe2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      Negara Asal Komoditas ({profile.originDetails?.length || profile.origins.length})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Negara pengirim dan asal komoditas {profile.name}
                  </p>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 pt-1 flex-1 scrollbar-thin">
                  {profile.originDetails && profile.originDetails.length > 0 ? (
                    profile.originDetails.map((orig) => (
                      <div
                        key={orig.country}
                        className="glass-sub hover:border-indigo-500/40 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 group transition-all"
                      >
                        <div className="space-y-1 truncate pr-2">
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 block truncate text-xs uppercase">
                            {orig.country}
                          </span>
                          <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 font-bold">
                              {orig.count} Pengiriman
                            </span>
                            {orig.companies.length > 0 && (
                              <span className="truncate max-w-[160px]">
                                Importir: {orig.companies.slice(0, 1).join(', ')}
                                {orig.companies.length > 1 ? ` (+${orig.companies.length - 1})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectCountry && onSelectCountry(orig.country)}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-600 text-slate-700 dark:text-slate-300 hover:text-white text-[11px] font-bold flex items-center space-x-1 border border-slate-200 dark:border-slate-800 transition-all self-start sm:self-center min-h-[36px]"
                        >
                          <span>Profil Negara</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Tidak ada data negara asal untuk filter ini.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Inspection Sites & HS Codes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Titik Pemeriksaan
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Tempat Pemeriksaan Utama</span>
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {profile.inspectionSites.map((site) => (
                    <span
                      key={site}
                      className="glass-sub text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-2xl text-xs font-semibold"
                    >
                      {site}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Pos Tarif Bea Cukai
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Kode HS Klasifikasi</span>
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {profile.hsCodes.map((code) => (
                    <span
                      key={code}
                      className="font-mono glass-sub text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-2xl text-xs font-bold"
                    >
                      HS {code}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quarantine Document Checklist & Inspection Procedures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Checklist Dokumen Masuk
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Persyaratan Dokumen Karantina</span>
                </h3>
                <div className="space-y-2 pt-1">
                  {profile.requiredDocuments.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300 glass-sub p-3 rounded-2xl"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <span className="font-medium">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  SOP Tindakan Fisik & Lab
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Prosedur Tindakan Karantina</span>
                </h3>
                <div className="space-y-2 pt-1">
                  {profile.inspectionProcedures.map((proc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300 glass-sub p-3 rounded-2xl"
                    >
                      <span className="w-4 h-4 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{proc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-600 dark:text-slate-400 font-medium">
            Pilih komoditas di sebelah kiri untuk melihat profil lengkap.
          </div>
        )}
      </div>

      {/* Modal Kelola Pengawasan Utama Komoditas */}
      <PriorityCommodityModal
        isOpen={isWatchlistModalOpen}
        onClose={() => setIsWatchlistModalOpen(false)}
        currentCommodityName={profile?.name || activeName}
        currentCategory={profile?.kategori || 'HEWAN'}
        allAvailableCommodities={allCommodities}
        onUpdated={() => {
          setWatchlistKey((k) => k + 1);
        }}
      />
    </div>
  );
};
