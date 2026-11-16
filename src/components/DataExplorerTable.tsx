import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import {
  MediaPembawaRecord,
  QuarantineCategory,
  RiskLevel,
  TradeActivityType,
} from '../types';
import {
  getUniquePemohonList,
  getUniqueKomoditasList,
  getUniqueOrigins,
  getUniqueInspectionSites,
} from '../data/quarantineData';
import {
  getAllComplianceScores,
  calculateTierRiskLevel,
} from '../data/complianceScores';

interface DataExplorerTableProps {
  data: MediaPembawaRecord[];
  onSelectApplicant: (pemohon: string) => void;
  onSelectCommodity: (komoditas: string) => void;
  onSelectCountry?: (country: string) => void;
  onRunAI: (record: MediaPembawaRecord) => void;
  onOpenImportModal?: () => void;
}

export const DataExplorerTable: React.FC<DataExplorerTableProps> = ({
  data,
  onSelectApplicant,
  onSelectCommodity,
  onSelectCountry,
  onRunAI,
  onOpenImportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuarantineCategory | 'ALL'>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<TradeActivityType | 'ALL'>('ALL');
  const [selectedPemohon] = useState<string>('ALL');
  const [selectedKomoditas] = useState<string>('ALL');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('ALL');
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | 'ALL'>('ALL');

  const [activeRecord, setActiveRecord] = useState<MediaPembawaRecord | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [complianceVersion, setComplianceVersion] = useState(0);
  useEffect(() => {
    const handleScoreUpdated = () => setComplianceVersion((v) => v + 1);
    window.addEventListener('compliance_scores_updated', handleScoreUpdated);
    return () => window.removeEventListener('compliance_scores_updated', handleScoreUpdated);
  }, []);

  const allComplianceScores = useMemo(() => getAllComplianceScores(), [complianceVersion]);

  useMemo(() => getUniquePemohonList(data), [data]);
  useMemo(() => getUniqueKomoditasList(data), [data]);
  const originOptions = useMemo(() => getUniqueOrigins(data), [data]);
  const siteOptions = useMemo(() => getUniqueInspectionSites(data), [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (selectedCategory !== 'ALL' && item.kategori !== selectedCategory) return false;
      if (selectedActivity !== 'ALL' && (item.jenisKegiatan || 'IMPOR') !== selectedActivity)
        return false;
      if (
        selectedPemohon !== 'ALL' &&
        item.pemohon.toLowerCase() !== selectedPemohon.toLowerCase()
      )
        return false;
      if (
        selectedKomoditas !== 'ALL' &&
        item.komoditas.toLowerCase() !== selectedKomoditas.toLowerCase()
      )
        return false;
      if (
        selectedOrigin !== 'ALL' &&
        !item.asal.some((a) => a.toLowerCase() === selectedOrigin.toLowerCase())
      )
        return false;
      if (
        selectedSite !== 'ALL' &&
        !item.tempatPeriksa.some((s) => s.toLowerCase().includes(selectedSite.toLowerCase()))
      )
        return false;
      if (selectedRisk !== 'ALL' && item.tingkatRisiko !== selectedRisk) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPemohon = item.pemohon.toLowerCase().includes(q);
        const matchesKomoditas = item.komoditas.toLowerCase().includes(q);
        const matchesAsal = item.asalRaw.toLowerCase().includes(q);
        const matchesSite = item.tempatPeriksaRaw.toLowerCase().includes(q);
        const matchesHs = item.kodeHsRaw.toLowerCase().includes(q);
        const matchesActivity = (item.jenisKegiatan || 'IMPOR').toLowerCase().includes(q);
        if (
          !matchesPemohon &&
          !matchesKomoditas &&
          !matchesAsal &&
          !matchesSite &&
          !matchesHs &&
          !matchesActivity
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    data,
    selectedCategory,
    selectedActivity,
    selectedPemohon,
    selectedKomoditas,
    selectedOrigin,
    selectedSite,
    selectedRisk,
    searchQuery,
  ]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleCategoryChange = (cat: QuarantineCategory | 'ALL') => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = [
      'No',
      'Kategori Karantina',
      'Jenis Kegiatan',
      'Pemohon',
      'Komoditas Media Pembawa',
      'Tempat Pemeriksaan',
      'Asal / Tujuan',
      'Kode HS',
      'Tingkat Risiko',
      'Catatan',
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      `"${r.kategori}"`,
      `"${r.jenisKegiatan || 'IMPOR'}"`,
      `"${r.pemohon.replace(/"/g, '""')}"`,
      `"${r.komoditas.replace(/"/g, '""')}"`,
      `"${r.tempatPeriksaRaw.replace(/"/g, '""')}"`,
      `"${r.asalRaw.replace(/"/g, '""')}"`,
      `"${r.kodeHsRaw.replace(/"/g, '""')}"`,
      `"${r.tingkatRisiko || 'SEDANG'}"`,
      `"${(r.catatanKarantina || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Master_Data_Karantina_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActivityBadge = (act?: TradeActivityType) => {
    switch (act) {
      case 'EKSPOR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 whitespace-nowrap">
            EKSPOR
          </span>
        );
      case 'DOMESTIK MASUK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 whitespace-nowrap">
            DOM. MASUK
          </span>
        );
      case 'DOMESTIK KELUAR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
            DOM. KELUAR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
            IMPOR
          </span>
        );
    }
  };

  const getRiskBadge = (risk?: RiskLevel) => {
    switch (risk) {
      case 'SANGAT TINGGI':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-700 dark:text-red-400 border border-rose-500/30 uppercase tracking-wider whitespace-nowrap">
            S. TINGGI
          </span>
        );
      case 'TINGGI':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider whitespace-nowrap">
            TINGGI
          </span>
        );
      case 'SEDANG':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border border-yellow-500/30 uppercase tracking-wider whitespace-nowrap">
            SEDANG
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider whitespace-nowrap">
            RENDAH
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Table Controls & Filter Bento Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
              Eksplorasi Master Data
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Tabel Master Data Media Pembawa Karantina ({filteredData.length} Record)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Database Karantina BBKHIT DKI Jakarta
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={exportToCSV}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl glass-sub hover:bg-white/80 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-sm transition-all active:scale-95 min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 pt-3 border-t border-slate-900/10 dark:border-white/10">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari pemohon/komoditas/asal/HS..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full glass-input text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) =>
                handleCategoryChange(e.target.value as QuarantineCategory | 'ALL')
              }
              className="w-full glass-input text-xs rounded-xl px-2.5 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="HEWAN">Karantina Hewan</option>
              <option value="IKAN">Karantina Ikan</option>
              <option value="TUMBUHAN">Karantina Tumbuhan</option>
            </select>
          </div>

          <div>
            <select
              value={selectedActivity}
              onChange={(e) => {
                setSelectedActivity(e.target.value as TradeActivityType | 'ALL');
                setCurrentPage(1);
              }}
              className="w-full glass-input text-xs rounded-xl px-2.5 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            >
              <option value="ALL">Semua Kegiatan</option>
              <option value="IMPOR">Impor</option>
              <option value="EKSPOR">Ekspor</option>
              <option value="DOMESTIK MASUK">Domestik Masuk</option>
              <option value="DOMESTIK KELUAR">Domestik Keluar</option>
            </select>
          </div>

          <div>
            <select
              value={selectedRisk}
              onChange={(e) => {
                setSelectedRisk(e.target.value as RiskLevel | 'ALL');
                setCurrentPage(1);
              }}
              className="w-full glass-input text-xs rounded-xl px-2.5 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            >
              <option value="ALL">Semua Risiko</option>
              <option value="SANGAT TINGGI">Sangat Tinggi</option>
              <option value="TINGGI">Tinggi</option>
              <option value="SEDANG">Sedang</option>
              <option value="RENDAH">Rendah</option>
            </select>
          </div>

          <div>
            <select
              value={selectedOrigin}
              onChange={(e) => {
                setSelectedOrigin(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full glass-input text-xs rounded-xl px-2.5 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            >
              <option value="ALL">Semua Asal/Tujuan</option>
              {originOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full glass-input text-xs rounded-xl px-2.5 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium min-h-[42px]"
            >
              <option value="ALL">Semua Lokasi</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/45 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-b border-slate-900/10 dark:border-white/15 font-bold text-[10px] uppercase tracking-widest">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Kegiatan</th>
                <th className="py-3.5 px-4">Pemohon</th>
                <th className="py-3.5 px-4">Komoditas Media Pembawa</th>
                <th className="py-3.5 px-4">Asal / Tujuan</th>
                <th className="py-3.5 px-4">Tempat Periksa</th>
                <th className="py-3.5 px-4">Kode HS</th>
                <th className="py-3.5 px-4 text-center">Risiko</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-white/10 text-slate-700 dark:text-slate-200 font-medium">
              {paginatedData.map((item, index) => {
                const globalIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-950/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono">
                      {item.no || globalIndex}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          item.kategori === 'HEWAN'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                            : item.kategori === 'IKAN'
                            ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-400 border border-cyan-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {item.kategori}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">{getActivityBadge(item.jenisKegiatan)}</td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                      <button
                        type="button"
                        onClick={() => onSelectApplicant(item.pemohon)}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                        title={item.pemohon}
                      >
                        {item.pemohon}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-cyan-700 dark:text-cyan-300 max-w-[180px] truncate">
                      <button
                        type="button"
                        onClick={() => onSelectCommodity(item.komoditas)}
                        className="hover:text-cyan-900 dark:hover:text-cyan-200 transition-colors text-left"
                        title={item.komoditas}
                      >
                        {item.komoditas}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                      {onSelectCountry && item.asal && item.asal.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => onSelectCountry(item.asal[0])}
                          className="hover:text-indigo-600 dark:hover:text-indigo-300 text-left transition-colors font-medium underline-offset-2 hover:underline"
                          title={`Buka Profil Negara ${item.asal[0]}`}
                        >
                          {item.asalRaw}
                        </button>
                      ) : (
                        item.asalRaw
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-amber-800 dark:text-amber-300/90 max-w-[180px] truncate">
                      {item.tempatPeriksaRaw}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-indigo-700 dark:text-indigo-300 font-bold">
                      {item.kodeHsRaw}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {(() => {
                        const compKey = item.pemohon.trim().toUpperCase();
                        const compScore = allComplianceScores[compKey];
                        const effectiveRisk = compScore
                          ? calculateTierRiskLevel(compScore.tier, compScore.currentScore)
                          : item.tingkatRisiko;
                        return getRiskBadge(effectiveRisk);
                      })()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveRecord(item)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Lihat Detail Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRunAI(item)}
                          className="p-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/30 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Analisis AI"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400 font-medium space-y-3">
                    <p className="text-sm">Tidak ada data profil karantina yang sesuai dengan filter.</p>
                    {onOpenImportModal && (
                      <button
                        type="button"
                        onClick={onOpenImportModal}
                        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all min-h-[42px]"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Import dari Excel</span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-white/40 dark:bg-slate-950/55 px-4 sm:px-5 py-3.5 border-t border-slate-900/10 dark:border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center space-x-2">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="glass-input text-slate-900 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none font-medium min-h-[38px]"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>baris per halaman</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="font-medium">
              Halaman <strong className="text-slate-900 dark:text-white font-bold">{currentPage}</strong> dari{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{totalPages}</strong>
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-xl glass-sub text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl glass-sub text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Detail Modal Drawer */}
      {activeRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="glass-modal rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 animate-scaleUp max-h-[92dvh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                  Detail Profiling Media Pembawa #{activeRecord.no}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeRecord.komoditas}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRecord(null)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pemohon / Importir
                </span>
                <p className="text-slate-900 dark:text-white font-bold text-sm">{activeRecord.pemohon}</p>
                {(activeRecord.pemilik || activeRecord.email) && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                    {activeRecord.pemilik ? `Pemilik: ${activeRecord.pemilik}` : ''}
                    {activeRecord.pemilik && activeRecord.email ? ' • ' : ''}
                    {activeRecord.email ? `Email: ${activeRecord.email}` : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Kategori
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold">{activeRecord.kategori}</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Kegiatan
                  </span>
                  <div className="pt-0.5">{getActivityBadge(activeRecord.jenisKegiatan)}</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Tingkat Risiko
                  </span>
                  <p className="text-amber-700 dark:text-amber-400 font-bold">
                    {activeRecord.tingkatRisiko || 'SEDANG'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Asal / Tujuan
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold">{activeRecord.asalRaw}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Tempat Pemeriksaan
                </span>
                <p className="text-amber-800 dark:text-amber-300 font-semibold">
                  {activeRecord.tempatPeriksaRaw}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Kode HS Kepabeanan
                </span>
                <p className="text-indigo-700 dark:text-indigo-300 font-mono font-bold text-sm">
                  HS {activeRecord.kodeHsRaw}
                </p>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = activeRecord.pemohon;
                    setActiveRecord(null);
                    onSelectApplicant(p);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold hover:bg-indigo-500/25 transition-all min-h-[42px]"
                >
                  Profil Perusahaan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const k = activeRecord.komoditas;
                    setActiveRecord(null);
                    onSelectCommodity(k);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/25 transition-all min-h-[42px]"
                >
                  Profil Komoditas
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const rec = activeRecord;
                  setActiveRecord(null);
                  onRunAI(rec);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg flex items-center justify-center space-x-1.5 active:scale-95 transition-all min-h-[42px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Analisis AI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
