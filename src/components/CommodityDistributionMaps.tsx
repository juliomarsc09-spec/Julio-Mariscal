import React, { useState, useMemo } from 'react';
import {
  Globe2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { MediaPembawaRecord, ThemeMode } from '../types';
import { resolveCountryGeo } from '../data/worldCountryCoords';
import { GlobeMap3D, GlobeCountryPoint } from './GlobeMap3D';

interface CommodityDistributionMapsProps {
  data: MediaPembawaRecord[];
  onSelectCommodity?: (comm: string) => void;
  themeMode?: ThemeMode;
}

export const CommodityDistributionMaps: React.FC<CommodityDistributionMapsProps> = ({
  data,
  themeMode = 'night',
}) => {
  const [activeMapView, setActiveMapView] = useState<'BOTH' | 'IMPOR' | 'EKSPOR'>('BOTH');
  const [hoveredImpor, setHoveredImpor] = useState<string | null>(null);
  const [focusedImpor, setFocusedImpor] = useState<string | null>(null);
  const [hoveredEkspor, setHoveredEkspor] = useState<string | null>(null);
  const [focusedEkspor, setFocusedEkspor] = useState<string | null>(null);

  const { imporStats, eksporStats } = useMemo(() => {
    const imporCountryMap = new Map<string, { count: number; commodities: Map<string, number> }>();
    const eksporCountryMap = new Map<string, { count: number; commodities: Map<string, number> }>();

    let totalImpor = 0;
    let totalEkspor = 0;

    data.forEach((r) => {
      const activity = (r.jenisKegiatan || '').toUpperCase();
      const isEkspor = activity === 'EKSPOR' || activity === 'DOMESTIK KELUAR';
      const targetMap = isEkspor ? eksporCountryMap : imporCountryMap;

      if (isEkspor) totalEkspor++;
      else totalImpor++;

      const countryList = r.asal && r.asal.length > 0 ? r.asal : ['INDONESIA'];
      countryList.forEach((rawCountry) => {
        const country = rawCountry.trim().toUpperCase();
        if (!targetMap.has(country)) {
          targetMap.set(country, { count: 0, commodities: new Map() });
        }
        const item = targetMap.get(country)!;
        item.count++;

        if (r.komoditas) {
          const comm = r.komoditas.trim();
          item.commodities.set(comm, (item.commodities.get(comm) || 0) + 1);
        }
      });
    });

    const formatCountries = (map: typeof imporCountryMap): GlobeCountryPoint[] => {
      return Array.from(map.entries())
        .map(([name, stat]) => {
          const topComms = Array.from(stat.commodities.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cName, cCount]) => ({ name: cName, count: cCount }));

          const geo = resolveCountryGeo(name);

          return {
            name,
            displayName: geo.name,
            code: geo.code,
            region: geo.region,
            lat: geo.lat,
            lon: geo.lon,
            count: stat.count,
            topCommodities: topComms,
          };
        })
        .sort((a, b) => b.count - a.count);
    };

    return {
      imporStats: {
        total: totalImpor,
        countries: formatCountries(imporCountryMap),
      },
      eksporStats: {
        total: totalEkspor,
        countries: formatCountries(eksporCountryMap),
      },
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Map Control & Section Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
              Visualisasi Spasial 3D & Koridor Perdagangan
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
              Dual Globe 3D
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2 mt-1">
            <Globe2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Peta 3D Sebaran Komoditas Karantina (Impor & Ekspor)</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Pemetaan bola dunia 3D interaktif untuk jalur masuk barang impor dan arus keluar ekspor melalui BBKHIT DKI Jakarta
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex flex-wrap items-center glass-sub p-1 rounded-2xl self-start md:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveMapView('BOTH')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
              activeMapView === 'BOTH'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Kedua Peta 3D
          </button>
          <button
            type="button"
            onClick={() => setActiveMapView('IMPOR')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 min-h-[40px] ${
              activeMapView === 'IMPOR'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300" />
            <span>Peta Impor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapView('EKSPOR')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 min-h-[40px] ${
              activeMapView === 'EKSPOR'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-sky-500 dark:text-sky-300" />
            <span>Peta Ekspor</span>
          </button>
        </div>
      </div>

      {/* Grid of the 2 Interactive 3D Globes */}
      <div
        className={`grid gap-5 ${
          activeMapView === 'BOTH' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* PETA 3D 1: IMPOR */}
        {(activeMapView === 'BOTH' || activeMapView === 'IMPOR') && (
          <div className="glass-panel rounded-3xl p-5 border-emerald-500/35 dark:border-emerald-400/30 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                      <span>Peta 3D Sebaran Komoditas Impor</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase">
                        Inbound
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                      Negara Asal Pemasok Menuju BBKHIT DKI Jakarta ({imporStats.total.toLocaleString('id-ID')} Pengajuan)
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {imporStats.countries.length} Negara
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Mitra Pemasok</span>
                </div>
              </div>

              <GlobeMap3D
                mode="IMPOR"
                countries={imporStats.countries}
                hoveredCountry={hoveredImpor}
                focusedCountry={focusedImpor}
                onHoverCountry={setHoveredImpor}
                onSelectCountry={(name) => setFocusedImpor(name)}
                themeMode={themeMode}
              />

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Top 4 Negara Pemasok Utama & Komoditas Masuk (Klik untuk Fokus Globe)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {imporStats.countries.slice(0, 4).map((c) => {
                    const isActive = hoveredImpor === c.name || focusedImpor === c.name;
                    return (
                      <button
                        type="button"
                        key={c.name}
                        onMouseEnter={() => setHoveredImpor(c.name)}
                        onMouseLeave={() => setHoveredImpor(null)}
                        onClick={() => setFocusedImpor(c.name)}
                        className={`text-left glass-sub p-2.5 rounded-xl transition-all flex flex-col justify-between ${
                          isActive
                            ? 'border-emerald-500/70 bg-emerald-500/10'
                            : 'hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {c.displayName}
                            </span>
                          </div>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 tabular-nums shrink-0">
                            {c.count.toLocaleString('id-ID')} Dok
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate w-full">
                          Komoditas: {c.topCommodities.map((k) => k.name).join(', ') || '-'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pemeriksaan Dokumen & Fisik 100% Terintegrasi</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">Pelabuhan & Bandara DKI</span>
            </div>
          </div>
        )}

        {/* PETA 3D 2: EKSPOR */}
        {(activeMapView === 'BOTH' || activeMapView === 'EKSPOR') && (
          <div className="glass-panel rounded-3xl p-5 border-sky-500/35 dark:border-sky-400/30 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                      <span>Peta 3D Sebaran Komoditas Ekspor</span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-extrabold uppercase">
                        Outbound
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                      Dari BBKHIT DKI Jakarta Menuju Negara Tujuan Global ({eksporStats.total.toLocaleString('id-ID')} Pengajuan)
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-sky-700 dark:text-sky-400 tabular-nums">
                    {eksporStats.countries.length} Negara
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Tujuan Ekspor</span>
                </div>
              </div>

              <GlobeMap3D
                mode="EKSPOR"
                countries={eksporStats.countries}
                hoveredCountry={hoveredEkspor}
                focusedCountry={focusedEkspor}
                onHoverCountry={setHoveredEkspor}
                onSelectCountry={(name) => setFocusedEkspor(name)}
                themeMode={themeMode}
              />

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Top 4 Negara Tujuan Ekspor Utama & Komoditas Keluar (Klik untuk Fokus Globe)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eksporStats.countries.slice(0, 4).map((c) => {
                    const isActive = hoveredEkspor === c.name || focusedEkspor === c.name;
                    return (
                      <button
                        type="button"
                        key={c.name}
                        onMouseEnter={() => setHoveredEkspor(c.name)}
                        onMouseLeave={() => setHoveredEkspor(null)}
                        onClick={() => setFocusedEkspor(c.name)}
                        className={`text-left glass-sub p-2.5 rounded-xl transition-all flex flex-col justify-between ${
                          isActive
                            ? 'border-sky-500/70 bg-sky-500/10'
                            : 'hover:border-sky-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {c.displayName}
                            </span>
                          </div>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30 tabular-nums shrink-0">
                            {c.count.toLocaleString('id-ID')} Dok
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate w-full">
                          Komoditas: {c.topCommodities.map((k) => k.name).join(', ') || '-'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center space-x-1 text-sky-700 dark:text-sky-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sertifikasi Phytosanitary & Health Certificate Standar Internasional</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">Akurasi Traceability</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
