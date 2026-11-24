export interface UploadProgressState {
  percent: number;
  phase: string;
  detail?: string;
}

export type UploadProgressCallback = (progress: UploadProgressState) => void;

export function formatBytesToMB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.00 MB';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatUploadErrorMessage(err: unknown, fallback = 'Terjadi kesalahan saat menyimpan data.'): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Not JSON
  }
  return raw;
}

export async function verifyExcelImportPasscode(passcode: string): Promise<void> {
  const clean = String(passcode || '').trim();
  if (!clean) {
    throw new Error('Password petugas wajib diisi sebelum menambahkan data impor Excel.');
  }
  const res = await fetch('/api/auth/verify-action-passcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: clean, context: 'excel_import' }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error || 'Password salah. Masukkan password yang benar untuk penambahan impor Excel.'
    );
  }
}

/**
 * Posts JSON payload using XMLHttpRequest so browser upload.onprogress emits real
 * byte-level upload percentage (0%..85%), server processing (85%..96%), and 100% on HTTP completion.
 */
export function postJsonWithProgress<T = any>(
  url: string,
  payload: unknown,
  onProgress?: UploadProgressCallback,
  labels?: {
    uploadingPhase?: string;
    processingPhase?: string;
    donePhase?: string;
  }
): Promise<T> {
  const uploadingPhase = labels?.uploadingPhase || 'Mengunggah data ke server...';
  const processingPhase = labels?.processingPhase || 'Memproses & menyimpan data di server...';
  const donePhase = labels?.donePhase || 'Data berhasil diunggah & tersimpan di server!';

  return new Promise<T>((resolve, reject) => {
    const jsonString = JSON.stringify(payload);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const totalPayloadBytes = blob.size;
    const totalLabel = formatBytesToMB(totalPayloadBytes);

    onProgress?.({
      percent: 5,
      phase: uploadingPhase,
      detail: `Menyiapkan paket data (${totalLabel})...`,
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let processingTimer: ReturnType<typeof setInterval> | null = null;
    const clearProcessingTimer = () => {
      if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
      }
    };

    xhr.upload.onprogress = (event: ProgressEvent) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : totalPayloadBytes;
      const loaded = Math.min(event.loaded, total);
      const ratio = total > 0 ? loaded / total : 0;
      const pct = Math.min(85, Math.max(5, Math.round(5 + ratio * 80)));

      onProgress?.({
        percent: pct,
        phase: uploadingPhase,
        detail: `${formatBytesToMB(loaded)} / ${formatBytesToMB(total)} terkirim ke server`,
      });
    };

    xhr.upload.onload = () => {
      let currentPct = 86;
      onProgress?.({
        percent: currentPct,
        phase: processingPhase,
        detail: `${totalLabel} terkirim • Menulis ke penyimpanan server...`,
      });
      clearProcessingTimer();
      processingTimer = setInterval(() => {
        if (currentPct < 96) {
          currentPct += 2;
          onProgress?.({
            percent: currentPct,
            phase: processingPhase,
            detail: 'Menyelaraskan & mengindeks data di server...',
          });
        }
      }, 220);
    };

    xhr.onload = () => {
      clearProcessingTimer();
      let parsed: any = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        parsed = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({
          percent: 100,
          phase: donePhase,
          detail: `${totalLabel} berhasil diproses server`,
        });
        resolve(parsed as T);
      } else {
        reject(new Error(parsed?.error || `Server mengembalikan status HTTP ${xhr.status}.`));
      }
    };

    xhr.onerror = () => {
      clearProcessingTimer();
      reject(new Error('Koneksi jaringan terputus saat mengunggah data ke server.'));
    };

    xhr.onabort = () => {
      clearProcessingTimer();
      reject(new Error('Proses unggah ke server dibatalkan.'));
    };

    xhr.send(blob);
  });
}
