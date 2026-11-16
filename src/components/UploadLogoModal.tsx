import React, { useState, useRef, useEffect } from 'react';
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
  onSaveLogo: (logoDataUrl: string | null) => void;
}

export const UploadLogoModal: React.FC<UploadLogoModalProps> = ({
  isOpen,
  onClose,
  currentLogo,
  onSaveLogo,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogo);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentLogo);
      setFileError(null);
      setIsSuccess(false);
    }
  }, [isOpen, currentLogo]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setFileError('Format file harus berupa gambar (PNG, JPG, JPEG, SVG, WebP).');
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFileError('Ukuran file maksimal 5MB.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError('Format file harus berupa gambar (PNG, JPG, JPEG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('Ukuran file maksimal 5MB.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSaveLogo(previewUrl);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setPreviewUrl(null);
    onSaveLogo(null);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="glass-modal rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-5 my-4 max-h-[92dvh] overflow-y-auto animate-scaleUp text-slate-800 dark:text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Ganti Logo Q-BIOCHECK</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Upload foto/logo (latar transparan otomatis)
              </p>
            </div>
          </div>
          <button
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Latar transparan • Mendukung PNG, JPG, SVG, WebP</p>
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
                Latar upload transparan • Maksimal 5MB • Rasio ideal 1:1
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
            <span>Logo berhasil diperbarui!</span>
          </div>
        )}

        {/* Live Header Preview (Transparent Logo Container Preserved) */}
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
              onClick={handleReset}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-900/15 dark:border-white/15 transition-colors flex items-center space-x-1.5"
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
              onClick={handleSave}
              disabled={!previewUrl && !currentLogo}
              className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Logo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
