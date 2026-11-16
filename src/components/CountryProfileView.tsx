import React, { useState, useEffect } from 'react';
import {
  Globe2,
  Search,
  Building2,
  Package,
  MapPin,
  ArrowRight,
  AlertTriangle,
  Calendar,
  UserCheck,
  BookOpen,
  Microscope,
  FlaskConical,
  Activity,
  PlusCircle,
} from 'lucide-react';
import {
  MediaPembawaRecord,
  WatchPriorityLevel,
} from '../types';
import {
  getCountryProfile,
  getUniqueCountryList,
} from '../data/quarantineData';
import {
  getAllWatchlistCountries,
  getWatchlistCountryItem,
  normalizePriorityLevel,
  formatPriorityLabel,
} from '../data/watchlistData';
import { PriorityCountryModal } from './PriorityCountryModal';

interface CountryProfileViewProps {
  data: MediaPembawaRecord[];
  selectedCountryName: string;
  onSelectCountryName: (name: string) => void;
  onSelectApplicant: (pemohon: string) => void;
  onSelectCommodity: (komoditas: string) => void;
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

export const CountryProfileView: React.FC<CountryProfileViewProps> = ({
  data,
  selectedCountryName,
  onSelectCountryName,
  onSelectApplicant,
  onSelectCommodity,
}) => {
  const allCountries = getUniqueCountryList(data);
  const [searchFilter, setSearchFilter] = useState('');
  const [watchlistFilterMode, setWatchlistFilterMode] = useState<'ALL' | 'WATCHLIST_ONLY'>('ALL');
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [watchlistKey, setWatchlistKey] = useState(0);

  useEffect(() => {
    const handleWatchlistUpdate = () => {
      setWatchlistKey((prev) => prev + 1);
    };
    window.addEventListener('watchlist_updated', handleWatchlistUpdate);
    return () => window.removeEventListener('watchlist_updated', handleWatchlistUpdate);
  }, []);

  const activeCountry = selectedCountryName || allCountries[0] || 'INDIA';
  const profile = getCountryProfile(data, activeCountry);

  const watchlistItems = getAllWatchlistCountries();
  const watchlistByCountry = new Map(
    watchlistItems.map((w) => [w.countryName.trim().toUpperCase(), normalizePriorityLevel(w.priorityLevel)])
  );

  const filteredCountryList = allCountries.filter((name) => {
    const matchesSearch = name.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (watchlistFilterMode === 'WATCHLIST_ONLY') {
      return watchlistByCountry.has(name.toUpperCase());
    }
    return true;
  });

  const activeWatchItem = getWatchlistCountryItem(activeCountry);
  const isActiveWatchlist = !!activeWatchItem;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 animate-fadeIn pb-12" key={watchlistKey}>
      {/* Left Sidebar: Country Directory */}
      <div className="lg:col-span-4 xl:col-span-3 glass-panel rounded-3xl p-4 sm:p-5 space-y-4 flex flex-col max-h-[320px] lg:max-h-[780px]">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            Direktori Geografis Karantina
          </span>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Globe2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Daftar Negara Asal</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {allCountries.length} Negara
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
            Semua ({allCountries.length})
          </button>
          <button
            type="button"
            onClick={() => setWatchlistFilterMode('WATCHLIST_ONLY')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all min-h-[38px] ${
              watchlistFilterMode === 'WATCHLIST_ONLY'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 dark:text-red-400 hover:text-rose-800 dark:hover:text-red-300'
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
            placeholder="Cari negara asal..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full glass-input text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium uppercase min-h-[40px]"
          />
        </div>

        {/* Country List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {filteredCountryList.map((cName) => {
            const isSelected = cName.toUpperCase() === activeCountry.toUpperCase();
            const watchPriority = watchlistByCountry.get(cName.toUpperCase());

            return (
              <button
                key={cName}
                type="button"
                onClick={() => onSelectCountryName(cName)}
                className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs transition-all flex items-center justify-between group min-h-[44px] ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-md border border-indigo-400/40'
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
                  <span className="truncate uppercase font-semibold">{cName}</span>
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
          {filteredCountryList.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">
              {watchlistFilterMode === 'WATCHLIST_ONLY'
                ? 'Tidak ada negara dalam pengawasan utama'
                : 'Negara tidak ditemukan'}
            </p>
          )}
        </div>

        {/* Quick Add Country to Watchlist Button */}
        <button
          type="button"
          onClick={() => setIsWatchlistModalOpen(true)}
          className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/35 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm min-h-[42px]"
        >
          <PlusCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>+ Tambah Negara Pengawasan</span>
        </button>
      </div>

      {/* Main Panel: Country Deep-Dive Profile */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
        {profile ? (
          <>
            {/* Country Header Card */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Profil Negara Asal Komoditas
                    </span>
                    {isActiveWatchlist && activeWatchItem && (
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getPriorityBadgeStyles(
                          activeWatchItem.priorityLevel
                        )}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          PENGAWASAN UTAMA • {formatPriorityLabel(activeWatchItem.priorityLevel)}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Globe2 className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase break-words">
                        {profile.countryName}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                        Wilayah Geografis Lalu Lintas Komoditas • BBKHIT DKI Jakarta
                      </p>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsWatchlistModalOpen(true)}
                    className={`inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95 border min-h-[44px] ${
                      isActiveWatchlist
                        ? 'bg-rose-500/15 text-rose-700 dark:text-red-300 border-rose-500/40 hover:bg-rose-500/25'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 shadow-sm'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        isActiveWatchlist
                          ? 'text-rose-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <span>
                      {isActiveWatchlist ? 'Edit Pengawasan Negara' : '+ Pengawasan Utama Negara'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Priority Country Watchlist Banner if active */}
              {isActiveWatchlist && activeWatchItem && (
                <div className="bg-rose-50/90 dark:bg-gradient-to-r dark:from-red-950/70 dark:via-slate-950 dark:to-slate-950 border border-rose-300 dark:border-red-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 dark:text-red-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-rose-900 dark:text-red-200 tracking-wide uppercase">
                          NEGARA DALAM PENGAWASAN UTAMA PETUGAS KARANTINA
                        </h4>
                        <div className="flex items-center flex-wrap gap-2 mt-0.5 text-[11px] text-rose-800 dark:text-red-300 font-medium">
                          <span>Tingkat Prioritas:</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getPriorityBadgeStyles(
                              activeWatchItem.priorityLevel
                            )}`}
                          >
                            {formatPriorityLabel(activeWatchItem.priorityLevel)}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            • Kategori:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {activeWatchItem.affectedCategories.join(', ')}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{new Date(activeWatchItem.addedAt).toLocaleDateString('id-ID')}</span>
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-2 border-t border-rose-200 dark:border-red-500/20">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px]">
                        Alasan Penetapan Petugas:
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed font-medium bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-rose-200 dark:border-red-500/20">
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
                              Petugas Pengawas / NIP:
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {activeWatchItem.officerName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {activeWatchItem.quarantineMeasures &&
                      activeWatchItem.quarantineMeasures.length > 0 && (
                        <div className="pt-1">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px] mb-1">
                            Tindakan Karantina Wajib di Pintu Masuk:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeWatchItem.quarantineMeasures.map((measure, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-rose-500/15 text-rose-800 dark:text-red-300 border border-rose-500/30 rounded-lg text-[11px] font-medium"
                              >
                                ✓ {measure}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

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
                    Asal Perusahaan
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {profile.companies.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Entitas</span>
                  </p>
                </div>

                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Jenis Komoditas
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                    {profile.commodities.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Komoditas</span>
                  </p>
                </div>

                <div className="glass-sub p-4 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Suspect Penyakit
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {profile.suspectDiseases.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Target</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Suspect Penyakit */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Biosecurity & Epidemiologi Karantina
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Suspect Penyakit & Hama Karantina Asal Negara Ini</span>
                  </h3>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  Berdasarkan komoditas data upload & intelijen biosecurity
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.suspectDiseases.map((dis, idx) => (
                  <div
                    key={idx}
                    className="glass-sub p-4 rounded-2xl hover:border-amber-500/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              dis.type === 'HPHK'
                                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                : dis.type === 'HPIK'
                                ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {dis.type}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {dis.diseaseName}
                          </h4>
                        </div>
                        {dis.scientificName && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pl-1">
                            {dis.scientificName}
                          </p>
                        )}
                      </div>

                      {dis.outbreakNotice && (
                        <span className="text-[9px] bg-rose-500/15 text-rose-700 dark:text-red-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                          Prioritas
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {dis.riskDescription}
                    </p>

                    {dis.targetCommodities && dis.targetCommodities.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                          Media Pembawa Rentan:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {dis.targetCommodities.map((comm, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-medium"
                            >
                              {comm}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {dis.mandatoryLabTests && dis.mandatoryLabTests.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-900 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                          <Microscope className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          <span>Pengujian Laboratorium BBKHIT:</span>
                        </span>
                        <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 pl-1">
                          {dis.mandatoryLabTests.map((test, tIdx) => (
                            <li key={tIdx} className="flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shrink-0" />
                              <span>{test}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Asal Perusahaan */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Pelaku Usaha Terkait
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Asal Perusahaan Pemohon ({profile.companies.length})</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Klik perusahaan untuk membuka Profil Perusahaan
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {profile.companies.map((comp) => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => onSelectApplicant(comp)}
                    className="group text-left glass-sub hover:bg-emerald-50/75 dark:hover:bg-emerald-950/60 text-slate-800 dark:text-slate-200 hover:border-emerald-500/40 p-3 rounded-2xl text-xs transition-all flex items-center justify-between min-h-[48px]"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold block truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                        {comp}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Pemohon Karantina
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
                {profile.companies.length === 0 && (
                  <p className="col-span-full text-xs text-slate-500 py-4 text-center">
                    Belum ada data perusahaan untuk negara ini pada record yang diunggah.
                  </p>
                )}
              </div>
            </div>

            {/* Jenis Komoditas */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Katalog Komoditas
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Jenis Komoditas dari Negara Ini ({profile.commodities.length})</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Klik komoditas untuk membuka Profil Komoditas
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {profile.commodities.map((comm) => (
                  <button
                    key={comm.name}
                    type="button"
                    onClick={() => onSelectCommodity(comm.name)}
                    className="group text-left glass-sub hover:bg-cyan-50/75 dark:hover:bg-cyan-950/60 text-slate-800 dark:text-slate-200 hover:border-cyan-500/40 p-3.5 rounded-2xl text-xs transition-all flex items-center justify-between min-h-[52px]"
                  >
                    <div className="space-y-1 truncate pr-2">
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 block truncate">
                        {comm.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            comm.category === 'HEWAN'
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              : comm.category === 'IKAN'
                              ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300'
                              : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {comm.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {comm.count} deklarasi
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
                {profile.commodities.length === 0 && (
                  <p className="col-span-full text-xs text-slate-500 py-4 text-center">
                    Belum ada data komoditas dari negara ini pada record yang diunggah.
                  </p>
                )}
              </div>
            </div>

            {/* Trade Activity Breakdown & Inspection Sites */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Arus Perdagangan
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Kategori Kegiatan Perdagangan</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {profile.tradeActivities.map((act) => (
                    <div
                      key={act}
                      className="glass-sub p-3 rounded-2xl text-xs flex flex-col justify-between"
                    >
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        {act}
                      </span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        {profile.tradeActivitiesBreakdown[act] || 0}{' '}
                        <span className="text-[10px] font-normal text-slate-500">Record</span>
                      </span>
                    </div>
                  ))}
                  {profile.tradeActivities.length === 0 && (
                    <p className="text-xs text-slate-500 col-span-2 py-2">
                      Tidak ada transaksi tercatat
                    </p>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Lokasi & Klasifikasi
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Tempat Pemeriksaan & Kode HS</span>
                </h3>
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Tempat Pemeriksaan:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.inspectionSites.map((site) => (
                        <span
                          key={site}
                          className="glass-sub text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                        >
                          {site}
                        </span>
                      ))}
                      {profile.inspectionSites.length === 0 && (
                        <span className="text-xs text-slate-500">Standar Pelabuhan BBKHIT DKI</span>
                      )}
                    </div>
                  </div>

                  {profile.hsCodes.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Pos Tarif (Kode HS):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.hsCodes.map((code) => (
                          <span
                            key={code}
                            className="font-mono glass-sub text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl text-[11px] font-bold"
                          >
                            HS {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-600 dark:text-slate-400 font-medium">
            Pilih negara asal di sebelah kiri untuk melihat profil lengkap.
          </div>
        )}
      </div>

      {/* Modal Kelola Pengawasan Utama Negara */}
      <PriorityCountryModal
        isOpen={isWatchlistModalOpen}
        onClose={() => setIsWatchlistModalOpen(false)}
        currentCountryName={profile?.countryName || activeCountry}
        allAvailableCountries={allCountries}
        onUpdated={() => {
          setWatchlistKey((k) => k + 1);
        }}
      />
    </div>
  );
};
