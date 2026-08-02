import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Printer, Loader, AlertCircle } from 'lucide-react';

export default function PrintLayout({ jobId }) {
  const { apiUrl } = useStore();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) {
      setError('No Job ID specified.');
      setLoading(false);
      return;
    }

    // Fetch the single job details
    fetch(`${apiUrl}/job/${jobId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Job not found or file has been deleted.');
        return res.json();
      })
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load file details.');
        setLoading(false);
      });
  }, [jobId, apiUrl]);

  // Auto-trigger window.print() after a short delay
  useEffect(() => {
    if (job) {
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print failed to trigger:', e);
        }
      }, 1200); // 1.2s delay to allow content rendering
      return () => clearTimeout(timer);
    }
  }, [job]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 no-print">
        <Loader className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-base font-semibold">Loading document...</h2>
        <p className="text-xs text-slate-500 mt-1">Preparing printer communication</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4 no-print">
        <div className="h-12 w-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-white">Print Error</h2>
        <p className="text-xs text-slate-400 mt-1 text-center max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={() => window.close()}
          className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
        >
          Close Tab
        </button>
      </div>
    );
  }

  const fileUrl = `${apiUrl}/file/${jobId}`;
  const isImage = job.filename.match(/\.(png|jpg|jpeg|webp)$/i);
  const isWord = job.filename.match(/\.(doc|docx)$/i);

  // For word documents, load with preview=true query to trigger pdf compilation
  const finalFileUrl = isWord ? `${fileUrl}?preview=true` : fileUrl;

  return (
    <div className="min-h-screen bg-white text-black relative">
      
      {/* Visual Indicator (hidden during print) */}
      <div className="fixed top-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-slate-100 no-print z-50 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold">Print Preview Active</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Press <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-[9px]">Ctrl + P</kbd> if the print dialog did not open.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="py-1.5 px-3 bg-brand-primary hover:bg-indigo-600 text-white text-[11px] font-semibold rounded-lg transition-colors"
          >
            Trigger Print Dialog
          </button>
          <button
            onClick={() => window.close()}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition-colors"
          >
            Close Tab
          </button>
        </div>
      </div>

      {/* Main Print Area */}
      <div className="w-full min-h-screen flex items-center justify-center p-0">
        {isImage ? (
          <img
            src={finalFileUrl}
            alt="Print Content"
            className="max-w-full max-h-screen object-contain block page-break"
          />
        ) : (
          <iframe
            src={`${finalFileUrl}#toolbar=0`}
            className="w-screen h-screen border-0 block page-break"
            title="Print PDF Document"
          />
        )}
      </div>

      {/* Special Inline Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body, html {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .page-break {
            page-break-before: always;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
