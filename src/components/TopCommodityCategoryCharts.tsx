import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Beef,
  Fish,
  Sprout,
  Package,
} from 'lucide-react';
import { MediaPembawaRecord, ThemeMode } from '../types';

interface TopCommodityCategoryChartsProps {
  data: MediaPembawaRecord[];
  onSelectCommodity?: (comm: string) => void;
  themeMode?: ThemeMode;
}

interface CommodityStatItem {
  name: string;
  total: number;
  impor: number;
  ekspor: number;
}

export const TopCommodityCategoryCharts: React.FC<TopCommodityCategoryChartsProps> = ({
  data,
  onSelectCommodity,
  themeMode = 'night',
}) => {
  const isDay = themeMode === 'day';
  const xStroke = isDay ? '#64748b' : '#64748b';
  const yStroke = isDay ? '#334155' : '#94a3b8';
  const tooltipStyle = isDay
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: '12px',
        color: '#0f172a',
        fontSize: '11px',
        boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.18)',
      }
    : {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '11px',
      };

  const { topHewan, topIkan, topTumbuhan } = useMemo(() => {
    const hewanMap = new Map<string, { total: number; impor: number; ekspor: number }>();
    const ikanMap = new Map<string, { total: number; impor: number; ekspor: number }>();
    const tumbuhanMap = new Map<string, { total: number; impor: number; ekspor: number }>();

    data.forEach((r) => {
      const comm = (r.komoditas || '').trim();
      if (!comm) return;

      const isEkspor = (r.jenisKegiatan || '').toUpperCase() === 'EKSPOR';
      const cat = r.kategori;

      let targetMap: typeof hewanMap | null = null;
      if (cat === 'HEWAN') targetMap = hewanMap;
      else if (cat === 'IKAN') targetMap = ikanMap;
      else if (cat === 'TUMBUHAN') targetMap = tumbuhanMap;

      if (targetMap) {
        const prev = targetMap.get(comm) || { total: 0, impor: 0, ekspor: 0 };
        targetMap.set(comm, {
          total: prev.total + 1,
          impor: prev.impor + (isEkspor ? 0 : 1),
          ekspor: prev.ekspor + (isEkspor ? 1 : 0),
        });
      }
    });

    const formatList = (map: typeof hewanMap): CommodityStatItem[] => {
      return Array.from(map.entries())
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    };

    return {
      topHewan: formatList(hewanMap),
      topIkan: formatList(ikanMap),
      topTumbuhan: formatList(tumbuhanMap),
    };
  }, [data]);

  const charts = [
    {
      key: 'hewan',
      title: 'Top 10 Komoditas Hewan',
      subtitle: 'Karantina Hewan (KH)',
      icon: Beef,
      borderClass: 'border-amber-500/30 dark:border-amber-400/30',
      iconBgClass: 'bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-400',
      badgeClass:
        'bg-amber-500/15 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-500/30 dark:border-amber-700/60',
      hoverBtnClass: 'hover:bg-amber-600 hover:text-white',
      emptyText: 'Tidak ada data transaksi Hewan pada filter ini.',
      items: topHewan,
    },
    {
      key: 'ikan',
      title: 'Top 10 Komoditas Ikan',
      subtitle: 'Karantina Ikan (KI)',
      icon: Fish,
      borderClass: 'border-cyan-500/30 dark:border-cyan-400/30',
      iconBgClass: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-600 dark:text-cyan-400',
      badgeClass:
        'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-500/30 dark:border-cyan-700/60',
      hoverBtnClass: 'hover:bg-cyan-600 hover:text-white',
      emptyText: 'Tidak ada data transaksi Ikan pada filter ini.',
      items: topIkan,
    },
    {
      key: 'tumbuhan',
      title: 'Top 10 Komoditas Tumbuhan',
      subtitle: 'Karantina Tumbuhan (KT)',
      icon: Sprout,
      borderClass: 'border-emerald-500/30 dark:border-emerald-400/30',
      iconBgClass: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-600 dark:text-emerald-400',
      badgeClass:
        'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-700/60',
      hoverBtnClass: 'hover:bg-emerald-600 hover:text-white',
      emptyText: 'Tidak ada data transaksi Tumbuhan pada filter ini.',
      items: topTumbuhan,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
              Analisis Komparasi 3 Bidang Karantina
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
              Top 10 Komoditas
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2 mt-1">
            <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Top 10 Komoditas Hewan, Ikan & Tumbuhan (Impor vs Ekspor)</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Perbandingan volume transaksi karantina antara arus impor dan ekspor untuk setiap kategori
          </p>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center space-x-3 glass-sub px-3.5 py-2 rounded-2xl self-start sm:self-auto text-xs">
          <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span>Impor</span>
          </div>
          <div className="flex items-center space-x-1.5 text-sky-700 dark:text-sky-400 font-bold">
            <span className="w-3 h-3 rounded-md bg-sky-500" />
            <span>Ekspor</span>
          </div>
        </div>
      </div>

      {/* 3 Bagan Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {charts.map((chart) => {
          const Icon = chart.icon;
          const totalSum = chart.items.reduce((acc, c) => acc + c.total, 0);

          return (
            <div
              key={chart.key}
              className={`glass-panel rounded-3xl p-5 ${chart.borderClass} flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center ${chart.iconBgClass}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {chart.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-300 font-medium">
                        {chart.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border tabular-nums ${chart.badgeClass}`}
                  >
                    {totalSum} Total
                  </span>
                </div>

                {chart.items.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chart.items}
                        layout="vertical"
                        margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                      >
                        <XAxis type="number" stroke={xStroke} fontSize={10} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke={yStroke}
                          fontSize={10}
                          width={105}
                          tickFormatter={(val) =>
                            val.length > 14 ? `${val.substring(0, 13)}..` : val
                          }
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: any, name: any) => [
                            `${value} Pengajuan`,
                            name === 'impor' ? 'Impor' : 'Ekspor',
                          ]}
                        />
                        <Bar dataKey="impor" fill="#10b981" radius={[0, 4, 4, 0]} name="impor" />
                        <Bar dataKey="ekspor" fill="#0284c7" radius={[0, 4, 4, 0]} name="ekspor" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    {chart.emptyText}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 mt-2 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Komoditas Utama:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {chart.items.slice(0, 4).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => onSelectCommodity?.(item.name)}
                      className={`px-2.5 py-1 rounded-lg glass-sub ${chart.hoverBtnClass} text-slate-700 dark:text-slate-200 text-[10px] font-medium transition-colors`}
                    >
                      {item.name} ({item.total})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
