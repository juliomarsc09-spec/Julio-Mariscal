import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, KeyRound, Eye, EyeOff, X, AlertCircle, ShieldCheck } from 'lucide-react';

interface MenuAksiPasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export const MenuAksiPasscodeModal: React.FC<MenuAksiPasscodeModalProps> = ({
  isOpen,
  onClose,
  onUnlocked,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setShowPasscode(false);
      setErrorMsg('');
      setIsVerifying(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg('Harap masukkan password untuk membuka Menu Aksi.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/verify-action-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || 'Password salah. Akses Menu Aksi ditolak.');
        return;
      }

      onClose();
      onUnlocked();
    } catch {
      setErrorMsg('Gagal memverifikasi password ke server. Coba lagi.');
    } finally {
      setIsVerifying(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal rounded-3xl w-full max-w-md p-6 space-y-5 border border-white/25 shadow-2xl text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-900/10 dark:border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Otorisasi Menu Aksi
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Masukkan password petugas untuk membuka Menu Aksi Operasional
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
            aria-label="Tutup dialog password"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label
              htmlFor="menu-aksi-passcode"
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Password Menu Aksi
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                id="menu-aksi-passcode"
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Masukkan password akses..."
                autoComplete="off"
                className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-11 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                title={showPasscode ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold glass-sub text-slate-700 dark:text-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="min-h-[40px] inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'Memverifikasi...' : 'Buka Menu Aksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
