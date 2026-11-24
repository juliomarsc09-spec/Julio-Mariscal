import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };
  declare props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan sistem.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendlyMsg = `Akses penyimpanan cloud (${parsed.operationType || 'read'}): ${parsed.error}`;
        }
      } catch {
        // Keep raw error string
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
          <div className="max-w-md w-full rounded-3xl p-6 bg-slate-900/90 border border-rose-500/40 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Kendala Koneksi Penyimpanan</h2>
            <p className="text-xs text-slate-300 leading-relaxed break-words">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center space-x-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
