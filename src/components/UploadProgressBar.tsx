import React from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { UploadProgressState } from '../utils/uploadWithProgress';

interface UploadProgressBarProps {
  progress: UploadProgressState | null;
  accent?: 'emerald' | 'indigo' | 'cyan';
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  accent = 'emerald',
}) => {
  if (!progress) return null;

  const pct = Math.max(0, Math.min(100, Math.round(progress.percent)));
  const isDone = pct >= 100;

  const fillClass =
    accent === 'indigo'
      ? 'from-indigo-500 via-violet-500 to-cyan-500'
      : accent === 'cyan'
        ? 'from-cyan-500 via-teal-500 to-indigo-500'
        : 'from-emerald-500 via-teal-500 to-cyan-500';

  const badgeClass =
    accent === 'indigo'
      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
      : accent === 'cyan'
        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="glass-sub p-3.5 sm:p-4 rounded-2xl border border-slate-900/10 dark:border-white/15 space-y-2.5 animate-fadeIn"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
              isDone
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                : badgeClass
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <UploadCloud className="w-4 h-4 animate-bounce" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {progress.phase}
            </p>
            {progress.detail && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {progress.detail}
              </p>
            )}
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-xl border text-xs font-black tabular-nums shrink-0 ${
            isDone
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
              : badgeClass
          }`}
        >
          {pct}%
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-3 rounded-full bg-slate-200/80 dark:bg-slate-800/80 overflow-hidden border border-slate-900/10 dark:border-white/10 p-0.5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            isDone ? 'from-emerald-500 to-teal-400' : fillClass
          } transition-all duration-200 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Milestones */}
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        <span className={pct >= 5 ? 'text-slate-800 dark:text-slate-200 font-bold' : ''}>
          1. Persiapan
        </span>
        <span className={pct >= 20 ? 'text-slate-800 dark:text-slate-200 font-bold' : ''}>
          2. Kirim ke Server ({Math.min(pct, 85)}%)
        </span>
        <span className={pct >= 86 ? 'text-slate-800 dark:text-slate-200 font-bold' : ''}>
          3. Proses Server
        </span>
        <span className={pct >= 100 ? 'text-emerald-700 dark:text-emerald-300 font-extrabold' : ''}>
          4. Selesai 100%
        </span>
      </div>
    </div>
  );
};
