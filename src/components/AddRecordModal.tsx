import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  X,
  Building2,
  Package,
  Globe2,
  MapPin,
  FileCode,
  Beef,
  Fish,
  Sprout,
  AlertTriangle,
} from 'lucide-react';
import { QuarantineCategory, MediaPembawaRecord, TradeActivityType } from '../types';
import { calculateAutomaticRisk } from '../data/quarantineData';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: MediaPembawaRecord) => void | Promise<void>;
  nextNo: number;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  nextNo,
}) => {
  const [kategori, setKategori] = useState<QuarantineCategory>('HEWAN');
  const [jenisKegiatan, setJenisKegiatan] = useState<TradeActivityType>('IMPOR');
  const [pemohon, setPemohon] = useState('');
  const [pemilik, setPemilik] = useState('');
  const [email, setEmail] = useState('');
  const [komoditas, setKomoditas] = useState('');
  const [tempatPeriksa, setTempatPeriksa] = useState('JICT');
  const [asal, setAsal] = useState('AUSTRALIA');
  const [kodeHs, setKodeHs] = useState('02023000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pemohon.trim() || !komoditas.trim() || isSubmitting) return;

    const parsedAsal = asal.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const parsedSite = tempatPeriksa.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const parsedHs = kodeHs.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    const { riskLevel } = calculateAutomaticRisk(kategori, komoditas, parsedAsal);

    const newRecord: MediaPembawaRecord = {
      id: `custom-${Date.now()}`,
      no: nextNo,
      kategori,
      jenisKegiatan,
      pemohon: pemohon.trim().toUpperCase(),
      pemilik: pemilik.trim(),
      email: email.trim(),
      komoditas: komoditas.trim(),
      tempatPeriksa: parsedSite,
      tempatPeriksaRaw: tempatPeriksa,
      asal: parsedAsal,
      asalRaw: asal,
      kodeHs: parsedHs,
      kodeHsRaw: kodeHs,
      tingkatRisiko: riskLevel,
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAddRecord(newRecord);
      setPemohon('');
      setPemilik('');
      setEmail('');
      setKomoditas('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan data transaksi ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 my-4 sm:my-8 max-h-[92dvh] overflow-y-auto animate-scaleUp">
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/15 rounded-2xl text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tambah Data Media Pembawa</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Menambahkan transaksi baru tanpa mereset data sebelumnya
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white glass-sub rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Category Choice Cards */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px]">
              Pilih Kategori Karantina (Wajib)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setKategori('HEWAN')}
                className={`min-h-[58px] p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                  kategori === 'HEWAN'
                    ? 'bg-indigo-600 dark:bg-indigo-600/40 border-indigo-500 dark:border-indigo-400 text-white shadow-md ring-2 ring-indigo-400/30'
                    : 'glass-sub text-slate-700 dark:text-slate-300 hover:border-indigo-400/50'
                }`}
              >
                <Beef className={`w-4 h-4 ${kategori === 'HEWAN' ? 'text-white dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="font-bold text-[11px]">Hewan</span>
              </button>

              <button
                type="button"
                onClick={() => setKategori('IKAN')}
                className={`min-h-[58px] p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                  kategori === 'IKAN'
                    ? 'bg-cyan-600 dark:bg-cyan-600/40 border-cyan-500 dark:border-cyan-400 text-white shadow-md ring-2 ring-cyan-400/30'
                    : 'glass-sub text-slate-700 dark:text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                <Fish className={`w-4 h-4 ${kategori === 'IKAN' ? 'text-white dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="font-bold text-[11px]">Ikan</span>
              </button>

              <button
                type="button"
                onClick={() => setKategori('TUMBUHAN')}
                className={`min-h-[58px] p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                  kategori === 'TUMBUHAN'
                    ? 'bg-emerald-600 dark:bg-emerald-600/40 border-emerald-500 dark:border-emerald-400 text-white shadow-md ring-2 ring-emerald-400/30'
                    : 'glass-sub text-slate-700 dark:text-slate-300 hover:border-emerald-400/50'
                }`}
              >
                <Sprout className={`w-4 h-4 ${kategori === 'TUMBUHAN' ? 'text-white dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="font-bold text-[11px]">Tumbuhan</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">Jenis Kegiatan Perdagangan</label>
            <select
              value={jenisKegiatan}
              onChange={(e) => setJenisKegiatan(e.target.value as TradeActivityType)}
              className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
            >
              <option value="IMPOR">Impor</option>
              <option value="EKSPOR">Ekspor</option>
              <option value="DOMESTIK MASUK">Domestik Masuk</option>
              <option value="DOMESTIK KELUAR">Domestik Keluar</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Nama Pemohon / Perusahaan</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: PT. BERSAMA MAKMUR LOGISTIK"
              value={pemohon}
              onChange={(e) => setPemohon(e.target.value)}
              className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Pemilik Perusahaan (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={pemilik}
                onChange={(e) => setPemilik(e.target.value)}
                className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Alamat Email (Opsional)</label>
              <input
                type="email"
                placeholder="Contoh: info@perusahaan.co.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Komoditas / Media Pembawa</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Daging Sapi / Ikan Salmon / Keju"
              value={komoditas}
              onChange={(e) => setKomoditas(e.target.value)}
              className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <Globe2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Asal / Tujuan</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: AUSTRALIA / JEPANG / SURABAYA"
                value={asal}
                onChange={(e) => setAsal(e.target.value)}
                className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Tempat Periksa</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: JICT, MTICA, NPCT1"
                value={tempatPeriksa}
                onChange={(e) => setTempatPeriksa(e.target.value)}
                className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Kode HS</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: 02023000"
              value={kodeHs}
              onChange={(e) => setKodeHs(e.target.value)}
              className="w-full min-h-[42px] glass-input rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start space-x-2 rounded-xl bg-rose-500/15 border border-rose-500/35 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-900/10 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl glass-sub text-slate-700 dark:text-slate-200 font-semibold hover:bg-white/80 dark:hover:bg-white/15"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold shadow"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
