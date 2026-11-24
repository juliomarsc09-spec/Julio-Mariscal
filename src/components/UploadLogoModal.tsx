import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  X,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Camera,
  AlertCircle,
} from 'lucide-react';

interface UploadLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogo: string | null;
  onSaveLogo: (logoDataUrl: string | null) => void | Promise<void>;
}

async function processLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Format file harus berupa gambar (PNG, JPG, JPEG, SVG, WebP).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 10MB (mendukung minimal 5MB).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  // Preserve lightweight SVG logos directly when compact
  if (file.type === 'image/svg+xml' && rawDataUrl.length <= 180_000) {
    return rawDataUrl;
  }

  // Downscale raster images cleanly onto transparent PNG canvas so logo fits reliably in local & cloud storage
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 320;
      let targetW = img.naturalWidth || maxDim;
      let targetH = img.naturalHeight || maxDim;
      if (targetW > maxDim || targetH > maxDim) {
        const scale = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.max(1, Math.round(targetW * scale));
        targetH = Math.max(1, Math.round(targetH * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export const UploadLogoModal: React.FC<UploadLogoModalProps> = ({
  isOpen,
  onClose,
  currentLogo,
  onSaveLogo,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogo);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentLogo);
      setFileError(null);
      setIsProcessing(false);
      setIsSuccess(false);
    }
  }, [isOpen, currentLogo]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSelectedFile = async (file?: File) => {
    if (!file) return;
    setFileError(null);
    setIsProcessing(true);
    try {
      const processed = await processLogoFile(file);
      setPreviewUrl(processed);
    } catch (err: any) {
      setFileError(err?.message || 'Gagal memproses gambar logo.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleSelectedFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    void handleSelectedFile(e.dataTransfer.files?.[0]);
  };

  const handleSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onSaveLogo(previewUrl);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 650);
    } catch (err: any) {
      setFileError(err?.message || 'Gagal menyimpan logo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      setPreviewUrl(null);
      await onSaveLogo(null);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 650);
    } catch (err: any) {
      setFileError(err?.message || 'Gagal mereset logo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="glass-modal rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 my-auto max-h-[90dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Ganti Logo Q-BIOCHECK</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Upload foto/logo (latar transparan otomatis & tersimpan permanen)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload & Dropzone Area (Transparent Background Preserved) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-900/20 dark:border-white/25 hover:border-indigo-500 dark:hover:border-indigo-400/80 rounded-3xl p-6 text-center cursor-pointer transition-all bg-transparent hover:bg-slate-900/5 dark:hover:bg-white/5 flex flex-col items-center justify-center space-y-3 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="space-y-3 flex flex-col items-center">
              <div className="w-24 h-24 rounded-2xl bg-transparent border border-slate-900/20 dark:border-white/25 p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Preview Logo"
                  className="w-full h-full object-contain rounded-xl bg-transparent"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 group-hover:underline">
                  Klik untuk mengganti foto logo lain
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Latar transparan • Mendukung PNG, JPG, SVG, WebP
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-transparent border border-slate-900/20 dark:border-white/20 group-hover:border-indigo-500 dark:group-hover:border-indigo-400/60 flex items-center justify-center text-slate-500 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Pilih atau seret foto/logo ke area ini
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Latar upload transparan • Kapasitas min. 5MB hingga 10MB • Rasio ideal 1:1
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <div className="p-3 bg-rose-500/15 dark:bg-red-950/60 border border-rose-500/40 rounded-xl text-rose-800 dark:text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-red-400" />
            <span>{fileError}</span>
          </div>
        )}

        {isSuccess && (
          <div className="p-3 bg-emerald-500/15 dark:bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Logo berhasil diperbarui dan disimpan!</span>
          </div>
        )}

        {/* Live Header Preview */}
        <div className="glass-sub p-3.5 rounded-2xl space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 block">
            Pratinjau Tampilan Header (Latar Transparan)
          </span>
          <div className="flex items-center space-x-3 bg-transparent p-2.5 rounded-xl border border-slate-900/10 dark:border-white/10">
            <div className="w-11 h-11 bg-transparent rounded-2xl flex items-center justify-center border border-slate-900/15 dark:border-white/20 overflow-hidden shrink-0">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Logo"
                  className="w-full h-full object-contain p-0.5 bg-transparent"
                />
              ) : (
                <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">Q-BIOCHECK</span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-300">BBKHIT DKI Jakarta</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
          {currentLogo ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handleReset()}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-900/15 dark:border-white/15 transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-900/10 dark:border-white/10 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isProcessing || (!previewUrl && !currentLogo)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'Menyimpan...' : 'Simpan Logo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
