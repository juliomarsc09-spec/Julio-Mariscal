import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ClipboardPaste,
  FileText,
  ArrowRight,
  ListOrdered,
  RefreshCw,
  Beef,
  Fish,
  Sprout,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MediaPembawaRecord, QuarantineCategory, RiskLevel, TradeActivityType } from '../types';
import { calculateAutomaticRisk, parseList } from '../data/quarantineData';
import { getCanonicalCompanyName } from '../data/companyNormalizer';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportRecords: (newRecords: MediaPembawaRecord[]) => void | Promise<void>;
  currentCount: number;
}


export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportRecords,
  currentCount,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<QuarantineCategory | null>(null);
  const [forceSelectedCategory, setForceSelectedCategory] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteContent, setPasteContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<MediaPembawaRecord[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Normalize Category string
  const normalizeCategory = (val: any): QuarantineCategory => {
    const s = String(val || '').toUpperCase();
    if (s.includes('IKAN') || s.includes('PERIKANAN') || s.includes('FISH')) return 'IKAN';
    if (s.includes('TUMBUHAN') || s.includes('TANAMAN') || s.includes('PLANT')) return 'TUMBUHAN';
    return 'HEWAN';
  };

  // Normalize Trade Activity string
  const normalizeTradeActivity = (val: any): TradeActivityType => {
    const s = String(val || '').toUpperCase();
    if (s.includes('EKSPOR') || s.includes('EXPORT')) return 'EKSPOR';
    if (s.includes('DOMESTIK MASUK') || s.includes('DOMESTIK_MASUK') || s.includes('DOM_MASUK') || s.includes('DM')) return 'DOMESTIK MASUK';
    if (s.includes('DOMESTIK KELUAR') || s.includes('DOMESTIK_KELUAR') || s.includes('DOM_KELUAR') || s.includes('DK')) return 'DOMESTIK KELUAR';
    return 'IMPOR';
  };

  // Normalize Risk Level string
  const normalizeRisk = (val: any, cat: QuarantineCategory, komoditas: string, origins: string[]): RiskLevel => {
    const s = String(val || '').toUpperCase().trim();
    if (s.includes('SANGAT') || s.includes('VERY HIGH')) return 'SANGAT TINGGI';
    if (s === 'TINGGI' || s === 'HIGH') return 'TINGGI';
    if (s === 'SEDANG' || s === 'MEDIUM') return 'SEDANG';
    if (s === 'RENDAH' || s === 'LOW') return 'RENDAH';
    return calculateAutomaticRisk(cat, komoditas, origins).riskLevel;
  };

  // Process rows array extracted from sheet or TSV
  const processRows = (rawRows: any[][]) => {
    if (!selectedCategory) {
      setErrorMsg('Wajib memilih Kategori Karantina (Hewan, Ikan, atau Tumbuhan) terlebih dahulu di Langkah 1 sebelum mengunggah data.');
      return;
    }

    if (!rawRows || rawRows.length < 2) {
      setErrorMsg('File atau data yang dimasukkan kosong atau tidak memiliki baris data.');
      return;
    }

    // Header row
    const headers = rawRows[0].map((h) => String(h || '').trim().toLowerCase());

    // Map column indices with expanded flexible matching
    const colIndex = {
      no: headers.findIndex((h) => h === 'no' || h === 'nomor' || h.includes('urut') || h === 'id' || h === 'no.'),
      kategori: headers.findIndex((h) => h.includes('kategori') || h.includes('jenis karantina') || h === 'bidang' || h.includes('sektor') || h.includes('kh/ki/kt')),
      kegiatan: headers.findIndex((h) => h.includes('kegiatan') || h.includes('layanan') || h.includes('tipe') || h.includes('ekspor') || h.includes('impor') || h.includes('perdagangan') || h.includes('arus')),
      pemohon: headers.findIndex((h) => h.includes('pemohon') || h.includes('perusahaan') || h.includes('importir') || h.includes('eksportir') || h.includes('nama') || h.includes('consignee') || h.includes('pengguna') || h.includes('shipper')),
      komoditas: headers.findIndex((h) => h.includes('komoditas') || h.includes('komoditi') || h.includes('media pembawa') || h.includes('barang') || h.includes('uraian') || h.includes('deskripsi') || h.includes('commodity')),
      tempat: headers.findIndex((h) => h.includes('tempat') || h.includes('lokasi') || h.includes('periksa') || h.includes('depo') || h.includes('pelabuhan') || h.includes('tps') || h.includes('tpf')),
      asal: headers.findIndex((h) => h.includes('asal') || h.includes('tujuan') || h.includes('negara') || h.includes('country') || h.includes('origin')),
      hs: headers.findIndex((h) => h.includes('hs') || h.includes('pos tarif') || h.includes('tarif') || h.includes('pos')),
      risiko: headers.findIndex((h) => h.includes('risiko') || h.includes('risk') || h.includes('tingkat risiko') || h.includes('level')),
      catatan: headers.findIndex((h) => h.includes('catatan') || h.includes('keterangan') || h.includes('note') || h.includes('uraian')),
      pemilik: headers.findIndex((h) => h.includes('pemilik') || h.includes('owner') || h.includes('direktur') || h.includes('penanggung jawab') || h.includes('pimpinan')),
      email: headers.findIndex((h) => h.includes('email') || h.includes('e-mail') || h.includes('surel')),
    };

    // Fallback column positions if headers aren't explicitly matched
    const idxNo = colIndex.no !== -1 ? colIndex.no : 0;
    const idxKategori = colIndex.kategori !== -1 ? colIndex.kategori : 1;
    const idxKegiatan = colIndex.kegiatan !== -1 ? colIndex.kegiatan : 2;
    const idxPemohon = colIndex.pemohon !== -1 ? colIndex.pemohon : (colIndex.kegiatan !== -1 ? 3 : 2);
    const idxKomoditas = colIndex.komoditas !== -1 ? colIndex.komoditas : (colIndex.kegiatan !== -1 ? 4 : 3);
    const idxTempat = colIndex.tempat !== -1 ? colIndex.tempat : (colIndex.kegiatan !== -1 ? 5 : 4);
    const idxAsal = colIndex.asal !== -1 ? colIndex.asal : (colIndex.kegiatan !== -1 ? 6 : 5);
    const idxHs = colIndex.hs !== -1 ? colIndex.hs : (colIndex.kegiatan !== -1 ? 7 : 6);
    const idxRisiko = colIndex.risiko !== -1 ? colIndex.risiko : 8;
    const idxCatatan = colIndex.catatan !== -1 ? colIndex.catatan : 9;
    const idxPemilik = colIndex.pemilik;
    const idxEmail = colIndex.email;

    const rawParsedList: MediaPembawaRecord[] = [];

    // Iterate through all data rows: pastikan data yang di upload excel masuk semua tanpa terkecuali
    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      // Skip only 100% empty rows
      if (!row || row.length === 0 || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      // 1. Robust Pemohon Extraction
      let rawPemohon = String(row[idxPemohon] !== undefined ? row[idxPemohon] : '').trim();
      if (!rawPemohon) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (val && c !== idxNo && c !== idxKomoditas) {
            if (/^(pt|cv|ud|tb|perum|koperasi|fa|nv)\b/i.test(val) || val.length > 4) {
              rawPemohon = val;
              break;
            }
          }
        }
      }
      if (!rawPemohon) {
        // Fallback so row is never skipped
        rawPemohon = `Perusahaan Baris #${r}`;
      }

      // 2. Robust Komoditas Extraction
      let rawKomoditas = String(row[idxKomoditas] !== undefined ? row[idxKomoditas] : '').trim();
      if (!rawKomoditas) {
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (val && c !== idxNo && val !== rawPemohon) {
            rawKomoditas = val;
            break;
          }
        }
      }
      if (!rawKomoditas) {
        rawKomoditas = `Komoditas Baris #${r}`;
      }

      const rawNo = row[idxNo];
      const parsedNumber = Number(rawNo);
      const rowSequenceNo = !isNaN(parsedNumber) && parsedNumber > 0 ? parsedNumber : r;

      const rawKategori = row[idxKategori];
      const kategori: QuarantineCategory = forceSelectedCategory
        ? selectedCategory
        : (colIndex.kategori !== -1 && rawKategori ? normalizeCategory(rawKategori) : selectedCategory);

      const jenisKegiatan = normalizeTradeActivity(row[idxKegiatan]);

      const rawTempat = String(row[idxTempat] !== undefined ? row[idxTempat] : 'JICT').trim();
      const rawAsal = String(row[idxAsal] !== undefined ? row[idxAsal] : '-').trim();
      const rawHs = String(row[idxHs] !== undefined ? row[idxHs] : '-').trim();
      const rawCatatan = String(row[idxCatatan] !== undefined ? row[idxCatatan] : '').trim();
      const rawPemilik = idxPemilik !== -1 && row[idxPemilik] !== undefined ? String(row[idxPemilik]).trim() : '';
      const rawEmail = idxEmail !== -1 && row[idxEmail] !== undefined ? String(row[idxEmail]).trim() : '';

      const parsedTempat = parseList(rawTempat);
      const parsedAsal = parseList(rawAsal);
      const parsedHs = parseList(rawHs);

      const tingkatRisiko = normalizeRisk(row[idxRisiko], kategori, rawKomoditas, parsedAsal);

      rawParsedList.push({
        id: `excel-${Date.now()}-${r}`,
        no: rowSequenceNo,
        kategori,
        jenisKegiatan,
        pemohon: rawPemohon.toUpperCase(),
        komoditas: rawKomoditas,
        tempatPeriksa: parsedTempat.length ? parsedTempat : [rawTempat || 'JICT'],
        tempatPeriksaRaw: rawTempat || 'JICT',
        asal: parsedAsal.length ? parsedAsal : [rawAsal || 'INDONESIA'],
        asalRaw: rawAsal || 'INDONESIA',
        kodeHs: parsedHs.length ? parsedHs : [rawHs || '-'],
        kodeHsRaw: rawHs || '-',
        tingkatRisiko,
        catatanKarantina: rawCatatan,
        pemilik: rawPemilik,
        email: rawEmail,
        createdAt: new Date().toISOString(),
      });
    }

    if (rawParsedList.length === 0) {
      setErrorMsg('Tidak ditemukan baris data yang valid dalam format yang dimasukkan.');
      setParsedPreview(null);
      return;
    }

    // Pastikan SEMUA data yang di-upload masuk semua datanya tanpa terkecuali
    const finalParsedList = rawParsedList.map((r, idx) => {
      const canonicalComp = getCanonicalCompanyName(r.pemohon);
      const unifiedCategory = forceSelectedCategory && selectedCategory
        ? selectedCategory
        : (r.kategori || selectedCategory);

      return {
        ...r,
        id: `excel-${Date.now()}-${idx + 1}-${Math.random().toString(36).substr(2, 6)}`,
        no: currentCount + idx + 1,
        pemohon: canonicalComp,
        kategori: unifiedCategory,
      };
    });

    setErrorMsg(null);
    setParsedPreview(finalParsedList);
  };

  const handleCategorySelect = (cat: QuarantineCategory) => {
    setSelectedCategory(cat);
    setErrorMsg(null);
    if (parsedPreview && forceSelectedCategory) {
      setParsedPreview((prev) =>
        prev
          ? prev.map((r) => ({
              ...r,
              kategori: cat,
              tingkatRisiko: normalizeRisk(r.tingkatRisiko, cat, r.komoditas, r.asal),
            }))
          : null
      );
    }
  };

  // Handle Excel or CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCategory) {
      setErrorMsg('Wajib memilih Kategori Karantina (Hewan, Ikan, atau Tumbuhan) terlebih dahulu sebelum memilih file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        processRows(data);
      } catch (err: any) {
        console.error('Error parsing file:', err);
        setErrorMsg('Gagal membaca file Excel. Pastikan file valid (.xlsx, .xls, .csv).');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Terjadi kesalahan saat membaca file.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  // Handle direct paste from Excel / Google Sheets
  const handleParsePastedText = () => {
    if (!selectedCategory) {
      setErrorMsg('Wajib memilih Kategori Karantina (Hewan, Ikan, atau Tumbuhan) terlebih dahulu sebelum memproses data tabel.');
      return;
    }

    if (!pasteContent.trim()) {
      setErrorMsg('Silakan tempel (paste) data tabel dari Excel terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Split rows by newline
      const lines = pasteContent.trim().split(/\r\n|\n|\r/);
      // Split by tab (Excel copy default) or comma/semicolon
      const rows = lines.map((line) => {
        if (line.includes('\t')) {
          return line.split('\t');
        } else if (line.includes(';')) {
          return line.split(';');
        } else {
          return line.split(',');
        }
      });

      processRows(rows);
    } catch (err: any) {
      console.error('Error parsing pasted data:', err);
      setErrorMsg('Gagal memproses data yang ditempel. Pastikan berformat tabel Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = (type: 'xlsx' | 'csv') => {
    const templateData = [
      [
        'No',
        'Kategori Karantina',
        'Jenis Kegiatan',
        'Nama Pemohon',
        'Pemilik',
        'Alamat Email',
        'Komoditas Media Pembawa',
        'Tempat Periksa',
        'Negara Asal / Tujuan',
        'Kode HS',
        'Tingkat Risiko',
        'Catatan Karantina',
      ],
      [
        1,
        'HEWAN',
        'IMPOR',
        'PT AGRO MAKMUR SEJAHTERA',
        'Budi Santoso',
        'budi.santoso@agromakmur.co.id',
        'Daging Sapi Beku',
        'JICT, NPCT-1',
        'AUSTRALIA',
        '02023000',
        'TINGGI',
        'Pemeriksaan rantai dingin (cold chain)',
      ],
      [
        2,
        'IKAN',
        'EKSPOR',
        'PT SAMUDERA SEAFOOD INDONESIA',
        'Ratna Wijaya',
        'ekspor@samuderaseafood.id',
        'Ikan Tuna Beku (Frozen Tuna)',
        'MTICA, CDC OB',
        'JEPANG',
        '03034200',
        'SEDANG',
        'Sertifikat Pelepasan Ekspor KI-11',
      ],
      [
        3,
        'TUMBUHAN',
        'IMPOR',
        'PT PANGAN NUSANTARA JAYA',
        'Hendra Gunawan',
        'hendra@pangannusantara.co.id',
        'Bawang Putih Segar',
        'JICT',
        'CHINA',
        '07032090',
        'TINGGI',
        'Pemeriksaan bebas Organisme Pengganggu Tumbuhan Karantina (OPTK)',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Profiling');

    if (type === 'xlsx') {
      XLSX.writeFile(wb, 'Template_Profiling_Media_Pembawa_Karantina.xlsx');
    } else {
      XLSX.writeFile(wb, 'Template_Profiling_Media_Pembawa_Karantina.csv', { bookType: 'csv' });
    }
  };

  const handleApplyImport = async () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      // Append mode: preserve existing data, sequence from currentCount + 1
      const finalRecords = parsedPreview.map((r, idx) => ({
        ...r,
        no: currentCount + idx + 1,
      }));

      await onImportRecords(finalRecords);
      onClose();
    } catch (err: any) {
      console.error('Error applying import:', err);
      setErrorMsg('Gagal menyimpan data ke database server: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };


  const getActivityBadge = (act?: TradeActivityType) => {
    switch (act) {
      case 'EKSPOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">EKSPOR</span>;
      case 'DOMESTIK MASUK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">DOMESTIK MASUK</span>;
      case 'DOMESTIK KELUAR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">DOMESTIK KELUAR</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">IMPOR</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-modal rounded-3xl max-w-4xl w-full p-5 sm:p-6 space-y-6 my-4 sm:my-6 max-h-[92dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/15 rounded-2xl text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Import Data dari Excel / Spreadsheet
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Tanpa Reset Data Lama
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Menambahkan data baru dari file Excel (.xlsx, .xls, .csv) ke database yang sudah ada tanpa menghapus data sebelumnya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white glass-sub rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Mandatory Category Selection */}
        <div className="glass-sub p-4 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black text-xs flex items-center justify-center border border-emerald-500/30 shrink-0">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Pilih Kategori Karantina (Wajib Sebelum Upload)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Tentukan jenis karantina untuk kelompok data yang akan ditambahkan
                </p>
              </div>
            </div>
            {selectedCategory ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Kategori Terpilih: Karantina {selectedCategory}</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 animate-pulse">
                <span>* Wajib Pilih Salah Satu di Bawah</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Karantina Hewan */}
            <button
              type="button"
              onClick={() => handleCategorySelect('HEWAN')}
              className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                selectedCategory === 'HEWAN'
                  ? 'bg-indigo-500/15 dark:bg-gradient-to-br dark:from-indigo-950/80 dark:to-slate-900 border-indigo-500 shadow-md ring-2 ring-indigo-500/35'
                  : 'bg-white dark:bg-slate-900/60 border-slate-900/15 dark:border-slate-800 hover:border-indigo-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Beef className="w-4 h-4" />
                </div>
                {selectedCategory === 'HEWAN' && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Karantina Hewan</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  Daging, ternak, susu, telur, produk olahan hewan
                </p>
              </div>
            </button>

            {/* Karantina Ikan */}
            <button
              type="button"
              onClick={() => handleCategorySelect('IKAN')}
              className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                selectedCategory === 'IKAN'
                  ? 'bg-cyan-500/15 dark:bg-gradient-to-br dark:from-cyan-950/80 dark:to-slate-900 border-cyan-500 shadow-md ring-2 ring-cyan-500/35'
                  : 'bg-white dark:bg-slate-900/60 border-slate-900/15 dark:border-slate-800 hover:border-cyan-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Fish className="w-4 h-4" />
                </div>
                {selectedCategory === 'IKAN' && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Karantina Ikan</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  Ikan segar/beku, udang, kepiting, rumput laut
                </p>
              </div>
            </button>

            {/* Karantina Tumbuhan */}
            <button
              type="button"
              onClick={() => handleCategorySelect('TUMBUHAN')}
              className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                selectedCategory === 'TUMBUHAN'
                  ? 'bg-emerald-500/15 dark:bg-gradient-to-br dark:from-emerald-950/80 dark:to-slate-900 border-emerald-500 shadow-md ring-2 ring-emerald-500/35'
                  : 'bg-white dark:bg-slate-900/60 border-slate-900/15 dark:border-slate-800 hover:border-emerald-400/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Sprout className="w-4 h-4" />
                </div>
                {selectedCategory === 'TUMBUHAN' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Karantina Tumbuhan</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  Buah-buahan, sayuran, bibit, kayu, pakan nabati
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 dark:text-slate-400">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceSelectedCategory}
                onChange={(e) => setForceSelectedCategory(e.target.checked)}
                className="rounded border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>Terapkan kategori ini untuk seluruh baris data Excel yang dimasukkan</span>
            </label>
          </div>
        </div>

        {/* Input Method Tabs & Template Download Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-950/50 p-2.5 rounded-2xl border border-slate-900/10 dark:border-white/10">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => {
                setActiveTab('upload');
                setErrorMsg(null);
              }}
              className={`min-h-[38px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'upload'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File (.xlsx / .csv)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('paste');
                setErrorMsg(null);
              }}
              className={`min-h-[38px] flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'paste'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-900'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Copy-Paste dari Excel</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 text-[11px] font-medium hidden md:inline">Unduh Contoh:</span>
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="min-h-[36px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-900/15 dark:border-slate-700/80 text-[11px] font-semibold transition-colors"
            >
              <Download className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Template .xlsx</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="min-h-[36px] inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-900/15 dark:border-slate-700/80 text-[11px] font-semibold transition-colors"
            >
              <Download className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span>Template .csv</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Upload File */}
        {activeTab === 'upload' && !parsedPreview && (
          <div
            onClick={() => {
              if (!selectedCategory) {
                setErrorMsg('Wajib memilih Kategori Karantina (Hewan, Ikan, atau Tumbuhan) pada Langkah 1 terlebih dahulu!');
                return;
              }
              fileInputRef.current?.click();
            }}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3 ${
              selectedCategory
                ? 'border-slate-900/20 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/80 dark:bg-slate-950/40 hover:bg-emerald-500/5 dark:hover:bg-slate-950/80 group'
                : 'border-slate-900/15 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/20 hover:border-amber-500/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center transition-transform ${
                selectedCategory
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 group-hover:scale-110'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <Upload className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedCategory
                  ? 'Klik atau seret file Excel ke sini'
                  : 'Pilih Kategori Karantina di Atas Terlebih Dahulu'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {selectedCategory ? (
                  <>
                    Mendukung format <span className="text-emerald-700 dark:text-emerald-400 font-mono">.xlsx</span>,{' '}
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">.xls</span>, atau{' '}
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">.csv</span>
                  </>
                ) : (
                  'Setelah kategori dipilih, area upload akan otomatis aktif'
                )}
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                Kolom dikenali otomatis: No, Kategori, Jenis Kegiatan (Ekspor, Impor, Domestik Masuk, Domestik Keluar), Pemohon, Komoditas, Tempat Periksa, Asal/Tujuan, Kode HS, Tingkat Risiko.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Copy Paste Text */}
        {activeTab === 'paste' && !parsedPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <p>Salin (Ctrl+C) baris tabel di Excel / Google Sheets lalu tempel (Ctrl+V) di bawah:</p>
            </div>
            <textarea
              rows={7}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Contoh salinan Excel:
No	Kategori	Jenis Kegiatan	Pemohon	Komoditas	Tempat Periksa	Asal	Kode HS
1	HEWAN	IMPOR	PT GLOBAL MEAT	Daging Sapi	JICT	AUSTRALIA	02023000
2	IKAN	EKSPOR	PT PACIFIC SEAFOOD	Tuna Beku	MTICA	JEPANG	03034200"
              className="w-full glass-input rounded-2xl p-4 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
            <button
              onClick={handleParsePastedText}
              disabled={!pasteContent.trim() || isProcessing}
              className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center space-x-2 ${
                selectedCategory
                  ? 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>{selectedCategory ? 'Proses & Tampilkan Urutan Data' : 'Pilih Kategori Karantina di Atas Terlebih Dahulu'}</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/35 rounded-2xl flex items-center space-x-3 text-xs text-rose-800 dark:text-red-300">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Preview parsed data */}
        {parsedPreview && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-sub p-4 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {parsedPreview.length} Baris Data Berhasil Dibaca
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {fileName ? `File: ${fileName} • ` : ''}Data terurut persis sesuai urutan baris Excel
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setParsedPreview(null);
                  setFileName(null);
                  setPasteContent('');
                }}
                className="min-h-[38px] inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-900/15 dark:border-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ganti / Upload Ulang</span>
              </button>
            </div>

            {/* Scrollable Preview Table */}
            <div className="border border-slate-900/10 dark:border-white/10 rounded-2xl overflow-hidden max-h-72 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-950/75 text-slate-700 dark:text-slate-300 font-bold uppercase sticky top-0 z-10 border-b border-slate-900/10 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Urutan</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Kegiatan</th>
                    <th className="py-2.5 px-3">Pemohon</th>
                    <th className="py-2.5 px-3">Komoditas</th>
                    <th className="py-2.5 px-3">Tempat Periksa</th>
                    <th className="py-2.5 px-3">Asal / Tujuan</th>
                    <th className="py-2.5 px-3">Kode HS</th>
                    <th className="py-2.5 px-3">Risiko</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/10 dark:divide-white/10 bg-white/75 dark:bg-slate-900/40 font-medium">
                  {parsedPreview.slice(0, 50).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400 font-mono">
                        {r.no || idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.kategori === 'HEWAN'
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/25'
                              : r.kategori === 'IKAN'
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                          }`}
                        >
                          {r.kategori}
                        </span>
                      </td>
                      <td className="py-2 px-3">{getActivityBadge(r.jenisKegiatan)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[150px]">
                        {r.pemohon}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {r.komoditas}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                        {r.tempatPeriksaRaw}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                        {r.asalRaw}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                        {r.kodeHsRaw}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                            r.tingkatRisiko === 'SANGAT TINGGI'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-red-400'
                              : r.tingkatRisiko === 'TINGGI'
                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400'
                              : r.tingkatRisiko === 'SEDANG'
                              ? 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-400'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {r.tingkatRisiko || 'SEDANG'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedPreview.length > 50 && (
                <div className="p-2 text-center text-xs text-slate-500 bg-slate-100 dark:bg-slate-950/80">
                  + {parsedPreview.length - 50} baris lainnya siap diimpor...
                </div>
              )}
            </div>

            {/* Actions: Append Only */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleApplyImport}
                disabled={isSaving}
                className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-emerald-100 animate-spin" />
                    <span>Menyimpan ke Server (+{parsedPreview.length} Record)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                    <span>Tambahkan ke Data yang Ada (+{parsedPreview.length} Record)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
