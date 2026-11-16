import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Building2,
  Package,
  Globe2,
  MapPin,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  PlusCircle,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { MediaPembawaRecord, ThemeMode, TradeActivityType } from '../types';
import { CommodityDistributionMaps } from './CommodityDistributionMaps';
import { TopCommodityCategoryCharts } from './TopCommodityCategoryCharts';

interface DashboardViewProps {
  data: MediaPembawaRecord[];
  onSelectApplicant: (pemohon: string) => void;
  onSelectCommodity: (komoditas: string) => void;
  onOpenAIAnalysis: () => void;
  onOpenImportModal?: () => void;
  onOpenAddRecord?: () => void;
  themeMode?: ThemeMode;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onSelectApplicant,
  onSelectCommodity,
  onOpenAIAnalysis,
  onOpenImportModal,
  onOpenAddRecord,
  themeMode = 'night',
}) => {
  const isDay = themeMode === 'day';

  const tooltipStyle = isDay
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: '12px',
        color: '#0f172a',
        fontSize: '12px',
        boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.18)',
      }
    : {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '12px',
        backdropFilter: 'blur(12px)',
      };

  const axisPrimaryStroke = isDay ? '#334155' : '#cbd5e1';
  const axisSecondaryStroke = isDay ? '#64748b' : '#94a3b8';

  const totalSubmissions = data.length;

  const pemohonCountMap = new Map<string, number>();
  const commodityCountMap = new Map<string, number>();
  const originCountMap = new Map<string, number>();
  const siteCountMap = new Map<string, number>();

  let categoryHewanImpor = 0;
  let categoryIkanImpor = 0;
  let categoryTumbuhanImpor = 0;

  let categoryHewanEkspor = 0;
  let categoryIkanEkspor = 0;
  let categoryTumbuhanEkspor = 0;

  let countEkspor = 0;
  let countImpor = 0;
  let countDomestikMasuk = 0;
  let countDomestikKeluar = 0;

  let highRiskCount = 0;

  data.forEach((r) => {
    const act = (r.jenisKegiatan || 'IMPOR') as TradeActivityType;
    if (act === 'EKSPOR') {
      countEkspor++;
      if (r.kategori === 'HEWAN') categoryHewanEkspor++;
      else if (r.kategori === 'IKAN') categoryIkanEkspor++;
      else if (r.kategori === 'TUMBUHAN') categoryTumbuhanEkspor++;
    } else if (act === 'DOMESTIK MASUK') {
      countDomestikMasuk++;
    } else if (act === 'DOMESTIK KELUAR') {
      countDomestikKeluar++;
    } else {
      countImpor++;
      if (r.kategori === 'HEWAN') categoryHewanImpor++;
      else if (r.kategori === 'IKAN') categoryIkanImpor++;
      else if (r.kategori === 'TUMBUHAN') categoryTumbuhanImpor++;
    }

    if (r.tingkatRisiko === 'SANGAT TINGGI' || r.tingkatRisiko === 'TINGGI') {
      highRiskCount++;
    }

    if (r.pemohon) {
      pemohonCountMap.set(r.pemohon, (pemohonCountMap.get(r.pemohon) || 0) + 1);
    }

    if (r.komoditas) {
      commodityCountMap.set(r.komoditas, (commodityCountMap.get(r.komoditas) || 0) + 1);
    }

    r.asal.forEach((country) => {
      if (country) {
        originCountMap.set(country, (originCountMap.get(country) || 0) + 1);
      }
    });

    r.tempatPeriksa.forEach((site) => {
      if (site) {
        siteCountMap.set(site, (siteCountMap.get(site) || 0) + 1);
      }
    });
  });

  const totalUniquePemohon = pemohonCountMap.size;
  const totalUniqueCommodities = commodityCountMap.size;
  const totalUniqueOrigins = originCountMap.size;
  const highRiskPercentage = totalSubmissions
    ? Math.round((highRiskCount / totalSubmissions) * 100)
    : 0;

  const topApplicantsData = Array.from(pemohonCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const topCommoditiesData = Array.from(commodityCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const topOriginsData = Array.from(originCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const topSitesData = Array.from(siteCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (totalSubmissions === 0) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 text-center space-y-6 max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-400/30 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Database Karantina Saat Ini Kosong
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Semua data telah dikosongkan secara permanen. Anda dapat mengimpor data pengajuan karantina (Ekspor, Impor, Domestik Masuk, Domestik Keluar) dari file Excel atau menambahkan data baru tanpa mereset data sebelumnya.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all active:scale-95 min-h-[44px]"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>Import dari Excel (.xlsx / .csv)</span>
              </button>
            )}
            {onOpenAddRecord && (
              <button
                type="button"
                onClick={onOpenAddRecord}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/15 shadow transition-all active:scale-95 min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                <span>Tambah Data Manual</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const imporCategoryPieData = [
    { name: 'Karantina Hewan', value: categoryHewanImpor, color: '#f59e0b' },
    { name: 'Karantina Ikan', value: categoryIkanImpor, color: '#06b6d4' },
    { name: 'Karantina Tumbuhan', value: categoryTumbuhanImpor, color: '#10b981' },
  ].filter((d) => d.value > 0);

  const eksporCategoryPieData = [
    { name: 'Karantina Hewan', value: categoryHewanEkspor, color: '#f59e0b' },
    { name: 'Karantina Ikan', value: categoryIkanEkspor, color: '#06b6d4' },
    { name: 'Karantina Tumbuhan', value: categoryTumbuhanEkspor, color: '#10b981' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fadeIn pb-12">
      {/* Bento Top Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 glass-panel rounded-3xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-2.5 sm:space-y-3 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-700 dark:text-indigo-200 text-[10px] font-extrabold uppercase tracking-widest">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Dashboard Q-BIOCHECK</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Dashboard Profiling Media Pembawa Karantina
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl font-medium">
              Pusat kendali, monitoring koridor ekspor-impor, dan visualisasi spasial media pembawa karantina terintegrasi (Hewan, Ikan, Tumbuhan) di BBKHIT DKI Jakarta.
            </p>
          </div>

          <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Penyimpanan Server
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-1.5 mt-0.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Database Aktif & Tersimpan</span>
                </span>
              </div>
              <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-white/15" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Satuan Kerja
                </span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">
                  BBKHIT DKI Jakarta
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenImportModal && (
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 border border-emerald-400/30 min-h-[42px]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAIAnalysis}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs shadow-lg flex items-center space-x-2 transition-all active:scale-95 border border-indigo-400/30 min-h-[42px]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Jalankan Profiling AI</span>
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Metric Card */}
        <div className="lg:col-span-4 bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-600/80 dark:to-indigo-900/75 backdrop-blur-xl rounded-3xl p-5 sm:p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between border border-indigo-400/40 dark:border-indigo-300/30">
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">
                Peringatan Risiko Karantina
              </span>
              <span className="p-2 bg-white/15 rounded-2xl backdrop-blur-md border border-white/15">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums">
                {highRiskCount.toLocaleString('id-ID')}
              </h3>
              <p className="text-xs font-semibold opacity-95 mt-1">
                Pengajuan Kategori Risiko Tinggi / Sangat Tinggi ({highRiskPercentage}%)
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/20 relative z-10 flex items-center justify-between text-xs gap-2">
            <span className="font-medium opacity-95 tabular-nums">
              Total {totalSubmissions.toLocaleString('id-ID')} Record Data
            </span>
            <span className="bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/15 shrink-0">
              Monitoring Karantina
            </span>
          </div>

          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>

      {/* Trade Activity Breakdown Row */}
      <div className="glass-panel rounded-3xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Kategori Operasional Perdagangan
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              Distribusi Layanan Ekspor, Impor & Domestik
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            Total {totalSubmissions.toLocaleString('id-ID')} Pengajuan
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="glass-sub p-4 rounded-2xl border-emerald-500/35 hover:border-emerald-500/60 transition-colors">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
              <span className="text-xs font-extrabold uppercase tracking-wider">Impor</span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
              {countImpor.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {totalSubmissions ? Math.round((countImpor / totalSubmissions) * 100) : 0}% dari total
            </p>
          </div>

          <div className="glass-sub p-4 rounded-2xl border-sky-500/35 hover:border-sky-500/60 transition-colors">
            <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
              <span className="text-xs font-extrabold uppercase tracking-wider">Ekspor</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
              {countEkspor.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {totalSubmissions ? Math.round((countEkspor / totalSubmissions) * 100) : 0}% dari total
            </p>
          </div>

          <div className="glass-sub p-4 rounded-2xl border-purple-500/35 hover:border-purple-500/60 transition-colors">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
              <span className="text-xs font-extrabold uppercase tracking-wider">Domestik Masuk</span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
              {countDomestikMasuk.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {totalSubmissions ? Math.round((countDomestikMasuk / totalSubmissions) * 100) : 0}% dari total
            </p>
          </div>

          <div className="glass-sub p-4 rounded-2xl border-amber-500/35 hover:border-amber-500/60 transition-colors">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span className="text-xs font-extrabold uppercase tracking-wider">Domestik Keluar</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
              {countDomestikKeluar.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {totalSubmissions ? Math.round((countDomestikKeluar / totalSubmissions) * 100) : 0}% dari total
            </p>
          </div>
        </div>
      </div>

      {/* KPI Bento Grid Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel rounded-3xl p-4 sm:p-5 hover:border-indigo-400/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Pelaku Usaha
            </span>
            <div className="p-2 bg-blue-500/15 border border-blue-400/25 rounded-xl text-blue-700 dark:text-blue-300">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalUniquePemohon.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Entitas Terdaftar
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-4 sm:p-5 hover:border-indigo-400/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Komoditas
            </span>
            <div className="p-2 bg-purple-500/15 border border-purple-400/25 rounded-xl text-purple-700 dark:text-purple-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalUniqueCommodities.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Media Pembawa
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-4 sm:p-5 hover:border-indigo-400/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Asal / Tujuan
            </span>
            <div className="p-2 bg-cyan-500/15 border border-cyan-400/25 rounded-xl text-cyan-700 dark:text-cyan-300">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalUniqueOrigins.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Negara / Daerah
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-4 sm:p-5 hover:border-indigo-400/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Lokasi Periksa
            </span>
            <div className="p-2 bg-amber-500/15 border border-amber-400/25 rounded-xl text-amber-700 dark:text-amber-300">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {siteCountMap.size.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              TPS & Terminal
            </p>
          </div>
        </div>
      </div>

      {/* 2 PETA SEBARAN KOMODITAS: IMPOR DAN EKSPOR */}
      <CommodityDistributionMaps
        data={data}
        onSelectCommodity={onSelectCommodity}
        themeMode={themeMode}
      />

      {/* 3 BAGAN 10 TOP KOMODITAS: HEWAN, IKAN, TUMBUHAN */}
      <TopCommodityCategoryCharts
        data={data}
        onSelectCommodity={onSelectCommodity}
        themeMode={themeMode}
      />

      {/* Analytics Bento Grid: Top Pemohon + Proporsi Kategori Impor & Ekspor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 glass-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
                Aktivitas Perusahaan
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Top Pemohon Teraktif</span>
              </h3>
            </div>
            <span className="px-2.5 py-1 glass-sub rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase shrink-0">
              Frekuensi Deklarasi
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topApplicantsData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <XAxis type="number" stroke={axisSecondaryStroke} fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={axisPrimaryStroke}
                  fontSize={10}
                  width={130}
                  tickFormatter={(val) =>
                    val.length > 20 ? `${val.substring(0, 18)}...` : val
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [`${value} Deklarasi`, 'Jumlah']}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Proporsi Kategori Karantina - IMPOR */}
        <div className="lg:col-span-3 glass-panel rounded-3xl p-5 border-emerald-500/35 dark:border-emerald-400/25 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest block">
                Arus Impor
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 tabular-nums">
                {countImpor.toLocaleString('id-ID')}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5 mt-1">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Proporsi Kategori Impor</span>
            </h3>

            {imporCategoryPieData.length > 0 ? (
              <div className="h-44 w-full flex items-center justify-center my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={imporCategoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={66}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {imporCategoryPieData.map((entry, index) => (
                        <Cell key={`cell-impor-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center px-3">
                Belum ada transaksi Impor pada filter aktif.
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
            {[
              { name: 'Karantina Hewan', value: categoryHewanImpor, color: '#f59e0b' },
              { name: 'Karantina Ikan', value: categoryIkanImpor, color: '#06b6d4' },
              { name: 'Karantina Tumbuhan', value: categoryTumbuhanImpor, color: '#10b981' },
            ].map((item) => (
              <div key={`impor-${item.name}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{item.name}</span>
                </div>
                <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                  {item.value.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Proporsi Kategori Karantina - EKSPOR */}
        <div className="lg:col-span-3 glass-panel rounded-3xl p-5 border-sky-500/35 dark:border-sky-400/25 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-widest block">
                Arus Ekspor
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-800 dark:text-sky-200 border border-sky-500/30 tabular-nums">
                {countEkspor.toLocaleString('id-ID')}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5 mt-1">
              <ArrowUpRight className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Proporsi Kategori Ekspor</span>
            </h3>

            {eksporCategoryPieData.length > 0 ? (
              <div className="h-44 w-full flex items-center justify-center my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eksporCategoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={66}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {eksporCategoryPieData.map((entry, index) => (
                        <Cell key={`cell-ekspor-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center px-3">
                Belum ada transaksi Ekspor pada filter aktif.
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
            {[
              { name: 'Karantina Hewan', value: categoryHewanEkspor, color: '#f59e0b' },
              { name: 'Karantina Ikan', value: categoryIkanEkspor, color: '#06b6d4' },
              { name: 'Karantina Tumbuhan', value: categoryTumbuhanEkspor, color: '#10b981' },
            ].map((item) => (
              <div key={`ekspor-${item.name}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{item.name}</span>
                </div>
                <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                  {item.value.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Origins & Inspection Sites Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
              Mitra Pemasok & Tujuan
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
              <Globe2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Top Negara Asal / Tujuan Komoditas</span>
            </h3>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOriginsData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <XAxis dataKey="name" stroke={axisPrimaryStroke} fontSize={10} />
                <YAxis stroke={axisSecondaryStroke} fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any) => [`${val} Pengajuan`, 'Jumlah']}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
              Titik Pemeriksaan FISIK
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
              <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Top Lokasi Pemeriksaan (Tempat Periksa)</span>
            </h3>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSitesData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  stroke={axisPrimaryStroke}
                  fontSize={10}
                  tickFormatter={(val) => (val.length > 10 ? `${val.substring(0, 8)}..` : val)}
                />
                <YAxis stroke={axisSecondaryStroke} fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any) => [`${val} Lokasi Periksa`, 'Frekuensi']}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Profiling Bento Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
                Akses Cepat Profil
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Pilih Pemohon Terpopuler</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">
              Klik Profil
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {topApplicantsData.slice(0, 6).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => onSelectApplicant(item.name)}
                className="group flex items-center space-x-2 glass-sub hover:bg-indigo-600 text-slate-800 dark:text-slate-100 hover:text-white p-2.5 rounded-2xl text-xs font-semibold transition-all text-left min-h-[44px]"
              >
                <span className="truncate max-w-[170px] sm:max-w-[190px]">{item.name}</span>
                <span className="bg-indigo-500/15 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-200 group-hover:bg-white/20 group-hover:text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold tabular-nums">
                  {item.count}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest block">
                Akses Cepat Komoditas
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Pilih Komoditas Terpopuler</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase">
              Klik Profil
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {topCommoditiesData.slice(0, 6).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => onSelectCommodity(item.name)}
                className="group flex items-center space-x-2 glass-sub hover:bg-cyan-600 text-slate-800 dark:text-slate-100 hover:text-white p-2.5 rounded-2xl text-xs font-semibold transition-all text-left min-h-[44px]"
              >
                <span className="truncate max-w-[170px] sm:max-w-[190px]">{item.name}</span>
                <span className="bg-cyan-500/15 dark:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 group-hover:bg-white/20 group-hover:text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold tabular-nums">
                  {item.count}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
