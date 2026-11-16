import React, { useState, useEffect } from 'react';
import {
  X,
  Globe2,
  Trash2,
  BookmarkPlus,
  CheckCircle2,
} from 'lucide-react';
import {
  QuarantineCategory,
  PriorityCountryWatchItem,
  WatchPriorityLevel,
} from '../types';
import {
  saveWatchlistCountry,
  removeWatchlistCountry,
  getWatchlistCountryItem,
  normalizePriorityLevel,
} from '../data/watchlistData';

interface PriorityCountryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCountryName: string;
  allAvailableCountries: string[];
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
    desc: 'Verifikasi dokumen standar negara asal',
    activeClass:
      'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/60 shadow-sm',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    desc: 'Inspeksi fisik & sampling laboratorium berkala',
    activeClass:
      'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/60 shadow-sm',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'HIGH',
    label: 'High',
    desc: 'Kewaspadaan penuh, perlakuan & uji lab wajib',
    activeClass:
      'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/60 shadow-sm',
    dotClass: 'bg-rose-500',
  },
];

export const PriorityCountryModal: React.FC<PriorityCountryModalProps> = ({
  isOpen,
  onClose,
  currentCountryName,
  allAvailableCountries,
  onUpdated,
}) => {
  const [countryName, setCountryName] = useState(currentCountryName);
  const [affectedCategories, setAffectedCategories] = useState<QuarantineCategory[]>(['HEWAN']);
  const [priorityLevel, setPriorityLevel] = useState<WatchPriorityLevel>('HIGH');
  const [suspectDiseasesText, setSuspectDiseasesText] = useState('');
  const [reason, setReason] = useState('');
  const [regulationRef, setRegulationRef] = useState('');
  const [quarantineMeasuresText, setQuarantineMeasuresText] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [isExistingWatchlist, setIsExistingWatchlist] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeName = (currentCountryName || allAvailableCountries[0] || '').toUpperCase();
      setCountryName(activeName);
      setErrorMsg(null);
      setConfirmDelete(false);
      loadExistingData(activeName);
    }
  }, [isOpen, currentCountryName]);

  const loadExistingData = (name: string) => {
    const existing = getWatchlistCountryItem(name);
    if (existing) {
      setIsExistingWatchlist(true);
      setAffectedCategories(existing.affectedCategories || ['HEWAN']);
      setPriorityLevel(normalizePriorityLevel(existing.priorityLevel));
      setSuspectDiseasesText((existing.suspectDiseases || []).join('\n'));
      setReason(existing.reason);
      setRegulationRef(existing.regulationRef || '');
      setQuarantineMeasuresText((existing.quarantineMeasures || []).join('\n'));
      setOfficerName(existing.officerName || '');
    } else {
      setIsExistingWatchlist(false);
      setAffectedCategories(['HEWAN']);
      setPriorityLevel('HIGH');
      setSuspectDiseasesText(
        'Penyakit Mulut dan Kuku (PMK / FMD)\nAfrican Swine Fever (ASF)\nHighly Pathogenic Avian Influenza (HPAI)'
      );
      setReason('');
      setRegulationRef('Surat Edaran Kepala Badan Karantina Indonesia tentang Kewaspadaan Pemasukan');
      setQuarantineMeasuresText(
        'Pemeriksaan fisik 100% sampel peti kemas di dermaga/palka\nPengujian Laboratorium RT-PCR / Virologi di BBKHIT\nVerifikasi perlakuan karantina (fumigasi/cold treatment) di negara asal'
      );
      setOfficerName('Tim Pengawas Biosecurity BBKHIT DKI');
    }
  };

  const handleCountryChange = (name: string) => {
    const upper = name.toUpperCase();
    setCountryName(upper);
    setConfirmDelete(false);
    setErrorMsg(null);
    loadExistingData(upper);
  };

  const toggleCategory = (cat: QuarantineCategory) => {
    setAffectedCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryName.trim()) {
      setErrorMsg('Nama negara target wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Alasan penetapan pengawasan utama negara wajib diisi oleh petugas.');
      return;
    }

    const diseases = suspectDiseasesText
      .split('\n')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const measures = quarantineMeasuresText
      .split('\n')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    const watchItem: PriorityCountryWatchItem = {
      id: `p-coun-${Date.now()}`,
      countryName: countryName.trim().toUpperCase(),
      affectedCategories,
      suspectDiseases:
        diseases.length > 0 ? diseases : ['Patogen / Hama Karantina Berisiko Tinggi'],
      reason: reason.trim(),
      regulationRef: regulationRef.trim() || 'Instruksi Pengawasan Teknis Karantina BBKHIT',
      quarantineMeasures:
        measures.length > 0 ? measures : ['Pemeriksaan Fisik dan Uji Lab Karantina Wajib'],
      officerName: officerName.trim() || 'Petugas Pengawas Karantina BBKHIT DKI',
      addedAt: new Date().toISOString(),
      priorityLevel,
    };

    saveWatchlistCountry(watchItem);
    onUpdated();
    onClose();
  };

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeWatchlistCountry(countryName);
    onUpdated();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-rose-500/12 via-white/30 to-transparent dark:from-red-950/60 dark:via-slate-900/40 dark:to-transparent border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-red-400 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                <span>Pengawasan Utama Negara Asal</span>
                {isExistingWatchlist && (
                  <span className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-red-300 border border-rose-500/30 px-2 py-0.5 rounded-full uppercase font-bold">
                    Aktif Dalam Daftar
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate">
                Penetapan manual negara berisiko oleh petugas karantina BBKHIT DKI Jakarta
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

          {/* Country Name Selector / Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Negara Target <span className="text-rose-600 dark:text-red-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={countryName}
                onChange={(e) => handleCountryChange(e.target.value)}
                placeholder="Contoh: INDIA, CHINA, AUSTRALIA, BRASIL..."
                className="flex-1 glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-bold uppercase tracking-wide min-h-[42px]"
                required
              />
              {allAvailableCountries.length > 0 && (
                <select
                  value={countryName}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-rose-500 sm:max-w-[200px] min-h-[42px]"
                >
                  <option value="">Pilih dari data...</option>
                  {allAvailableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Affected Categories Checkboxes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Kategori Karantina Terdampak (Pilih Minimal 1)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['HEWAN', 'IKAN', 'TUMBUHAN'] as QuarantineCategory[]).map((cat) => {
                const isChecked = affectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border min-h-[42px] ${
                      isChecked
                        ? cat === 'HEWAN'
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/60'
                          : cat === 'IKAN'
                          ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border-cyan-500/60'
                          : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/60'
                        : 'glass-sub text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Level: 3 Categories (Low, Medium, High) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tingkat Prioritas Pengawasan Negara
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

          {/* Suspect Penyakit / Hama Karantina Utama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
              <span>
                Suspect Penyakit / Hama Karantina Asal Negara (1 baris per penyakit){' '}
                <span className="text-rose-600 dark:text-red-400">*</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal shrink-0">HPHK / HPIK / OPTK</span>
            </label>
            <textarea
              rows={3}
              value={suspectDiseasesText}
              onChange={(e) => setSuspectDiseasesText(e.target.value)}
              placeholder="Contoh:&#10;Penyakit Mulut dan Kuku (PMK)&#10;Lumpy Skin Disease (LSD)&#10;Kumbang Khapra (Trogoderma granarium)"
              className="w-full glass-input rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
              required
            />
          </div>

          {/* Alasan Penetapan Pengawasan Utama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>
                Alasan Penetapan Pengawasan Utama Petugas{' '}
                <span className="text-rose-600 dark:text-red-400">*</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Wajib diisi</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Laporan epidemiologi WOAH mengenai outbreak PMK tipe baru, penolakan kontainer berulang pada pintu masuk BBKHIT DKI Jakarta, atau regulasi pembatasan impor."
              className="w-full glass-input rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              required
            />
          </div>

          {/* Dasar Hukum / Regulasi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Dasar Hukum / Surat Edaran / Protokol Bilateral
            </label>
            <input
              type="text"
              value={regulationRef}
              onChange={(e) => setRegulationRef(e.target.value)}
              placeholder="Contoh: Surat Edaran Kepala Badan Karantina Indonesia No. 11/2023"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]"
            />
          </div>

          {/* Tindakan Karantina Wajib */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tindakan Karantina Wajib di Pintu Masuk (1 baris per tindakan)
            </label>
            <textarea
              rows={3}
              value={quarantineMeasuresText}
              onChange={(e) => setQuarantineMeasuresText(e.target.value)}
              placeholder="Contoh:&#10;Wajib Sertifikat Bebas Penyakit dari Otoritas Asal&#10;Pengujian Laboratorium RT-PCR Virologi&#10;Pemeriksaan In-transit Cold Treatment"
              className="w-full glass-input rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono text-[11px]"
            />
          </div>

          {/* Nama Petugas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Petugas Pengawas / Tim Biosecurity
            </label>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="Contoh: drh. Hendra K., M.Si & Ir. Sri Wahyuni"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]"
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
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg transition-all active:scale-95 min-h-[44px]"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Simpan Pengawasan Negara</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
