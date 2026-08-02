import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { 
  Printer, Volume2, VolumeX, Eye, Edit3, Trash2, CheckCircle2, 
  Layers, Clock, FileText, FileImage, Settings, RefreshCw, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const { apiUrl, soundEnabled, toggleSound, rateBW, rateColor, currencySymbol, setPricing } = useStore();
  const queryClient = useQueryClient();

  // Extract shopId from URL query string
  const queryParams = new URLSearchParams(window.location.search);
  const shopId = queryParams.get('shop') || 'quickprint';

  // Local UI States
  const [activeTab, setActiveTab] = useState('waiting'); // 'waiting' | 'printing' | 'done'
  const [previewJob, setPreviewJob] = useState(null); // job object
  const [editJob, setEditJob] = useState(null); // job object for inline options
  const [printConfirmationJob, setPrintConfirmationJob] = useState(null); // job that was just opened to print

  // Audio trigger helper: Synthesized chimes (avoids external static file load errors)
  const prevWaitingIdsRef = useRef(new Set());
  
  const playNewJobChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(830.61, audioCtx.currentTime); // Ab5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.08); // C6
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start(audioCtx.currentTime + 0.08);
      osc1.stop(audioCtx.currentTime + 0.4);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (err) {
      console.warn('Audio chime failed:', err);
    }
  };

  // React Query Fetch Jobs
  const { data: jobs = [], isLoading, isFetching } = useQuery({
    queryKey: ['jobs', shopId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/jobs?shopId=${shopId}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Sound triggering on new jobs
  useEffect(() => {
    if (jobs.length > 0) {
      const waitingJobs = jobs.filter(j => j.status === 'waiting');
      const currentWaitingIds = new Set(waitingJobs.map(j => j.id));
      
      // Determine if there are new job IDs that we didn't have before
      let hasNewJob = false;
      for (const id of currentWaitingIds) {
        if (!prevWaitingIdsRef.current.has(id)) {
          hasNewJob = true;
          break;
        }
      }
      
      if (hasNewJob && prevWaitingIdsRef.current.size > 0) {
        playNewJobChime();
      }
      
      // Update ref
      prevWaitingIdsRef.current = currentWaitingIds;
    } else {
      prevWaitingIdsRef.current = new Set();
    }
  }, [jobs, soundEnabled]);

  // Mutations
  // 1. Update options
  const updateMutation = useMutation({
    mutationFn: async (updatedData) => {
      const res = await fetch(`${apiUrl}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error('Failed to update job options');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', shopId] });
      setEditJob(null);
    }
  });

  // 2. Confirm printed & Delete file
  const printDoneMutation = useMutation({
    mutationFn: async (jobId) => {
      const res = await fetch(`${apiUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error('Failed to mark job as printed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', shopId] });
      setPrintConfirmationJob(null);
    }
  });

  // Action Handlers
  const handlePrintTrigger = (job) => {
    // 1. Update status to 'printing' (optimistic UI update immediately)
    updateMutation.mutate({ jobId: job.id, status: 'printing' });
    
    // 2. Open print page in a new tab
    window.open(`/print/${job.id}`, '_blank');
    
    // 3. Show confirmation modal on dashboard to clean up
    setPrintConfirmationJob(job);
  };

  const handleUpdateOptionsSave = (e) => {
    e.preventDefault();
    if (!editJob) return;
    updateMutation.mutate({
      jobId: editJob.id,
      copies: editJob.copies,
      color: editJob.color,
      paperSize: editJob.paperSize,
      duplex: editJob.duplex,
    });
  };

  // Helper Stats
  const waitingJobsCount = jobs.filter(j => j.status === 'waiting').length;
  const printingJobsCount = jobs.filter(j => j.status === 'printing').length;
  const totalPagesToPrint = jobs
    .filter(j => j.status === 'waiting' || j.status === 'printing')
    .reduce((acc, job) => acc + (job.pages * job.copies), 0);
  const totalEstRevenue = jobs
    .filter(j => j.status === 'waiting' || j.status === 'printing')
    .reduce((acc, job) => acc + (job.pages * job.copies * (job.color ? rateColor : rateBW)), 0);

  // Filtered jobs array
  const filteredJobs = jobs.filter(job => job.status === activeTab);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col md:flex-row relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Sidebar Panel */}
      <aside className="w-full md:w-80 bg-slate-900/40 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 z-10">
        <div className="space-y-6">
          {/* Logo Header */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-primary to-indigo-400 flex items-center justify-center shadow-glow">
              <Printer className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Dashboard</h1>
              <p className="text-[10px] text-slate-400 capitalize font-mono">Shop ID: {shopId}</p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Jobs Active</span>
              <span className="text-2xl font-extrabold text-indigo-400">{waitingJobsCount + printingJobsCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Est. Revenue</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono truncate block" title={`${currencySymbol}${totalEstRevenue.toFixed(2)}`}>
                {currencySymbol}{totalEstRevenue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Settings / Controls */}
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard Settings</h3>
            
            {/* Audio Alert Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 flex items-center gap-2">
                {soundEnabled ? <Volume2 className="h-4 w-4 text-brand-primary" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
                Chime Notification
              </span>
              <button
                type="button"
                onClick={toggleSound}
                className={`h-5 w-9 rounded-full transition-all duration-300 relative ${
                  soundEnabled ? 'bg-brand-primary' : 'bg-slate-800'
                }`}
              >
                <div className={`h-3 w-3 rounded-full bg-white absolute top-1 transition-all ${
                  soundEnabled ? 'right-1' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Pricing Configuration Form */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Price Settings</span>
              
              {/* Currency Symbol Selection */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] text-slate-400">Currency</span>
                <select
                  value={currencySymbol}
                  onChange={(e) => setPricing(rateBW, rateColor, e.target.value)}
                  className="px-1.5 py-1 bg-slate-950 border border-slate-850 rounded text-slate-200 text-[11px] outline-none"
                >
                  <option value="₹">₹ (INR)</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                </select>
              </div>

              {/* B&W Rate Input */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] text-slate-400">B&W Rate</span>
                <input
                  type="number"
                  step="0.5"
                  value={rateBW}
                  onChange={(e) => setPricing(parseFloat(e.target.value) || 0, rateColor, currencySymbol)}
                  className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono text-right outline-none focus:border-brand-primary"
                />
              </div>

              {/* Color Rate Input */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] text-slate-400">Color Rate</span>
                <input
                  type="number"
                  step="0.5"
                  value={rateColor}
                  onChange={(e) => setPricing(rateBW, parseFloat(e.target.value) || 0, currencySymbol)}
                  className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono text-right outline-none focus:border-brand-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Link to user interface */}
        <div className="pt-6 md:pt-0 mt-6 border-t border-slate-800/60 flex flex-col space-y-3">
          <a
            href={`/admin`}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
          >
            Manage Shop QR
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
          <span className="text-[10px] text-slate-600 text-center font-mono tracking-wider block">
            Developed by <strong className="text-indigo-400 font-semibold uppercase">Nanda</strong>
          </span>
        </div>
      </aside>

      {/* Main Jobs Listing Panel */}
      <main className="flex-1 p-6 md:p-8 flex flex-col z-10 max-h-screen overflow-y-auto">
        {/* Navigation Tabs and Refresh indicators */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-850 shrink-0 w-fit">
            {[
              { id: 'waiting', label: 'Waiting', count: waitingJobsCount, color: 'text-indigo-400 bg-indigo-500/10' },
              { id: 'printing', label: 'Printing', count: printingJobsCount, color: 'text-amber-400 bg-amber-500/10' },
              { id: 'done', label: 'Done', count: null }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-card text-white shadow border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono ${tab.color}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-primary" />}
            <span>Real-time polling active (3s)</span>
          </div>
        </div>

        {/* Jobs Feed */}
        {isLoading ? (
          // Skeleton Loader
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-[210px] rounded-3xl glass-card border-slate-800 animate-pulse p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
                  <div className="h-5 w-16 bg-slate-800 rounded"></div>
                </div>
                <div className="h-8 w-2/3 bg-slate-800 rounded"></div>
                <div className="flex gap-2">
                  <div className="h-6 w-12 bg-slate-800 rounded"></div>
                  <div className="h-6 w-12 bg-slate-800 rounded"></div>
                </div>
                <div className="h-10 bg-slate-800 rounded-xl pt-2"></div>
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-850 rounded-3xl bg-slate-950/10 min-h-[300px]">
            <Layers className="h-12 w-12 text-slate-700 mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No print jobs found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Active jobs in the "{activeTab}" stage will appear here.
            </p>
          </div>
        ) : (
          // Grid List
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="glass-card rounded-3xl hover:border-slate-700 transition-all duration-300 p-5 flex flex-col justify-between space-y-4"
              >
                {/* Header info */}
                <div className="flex justify-between items-start gap-3">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-1.5">
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      job.status === 'waiting' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      job.status === 'printing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                </div>

                {/* File Title */}
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-200 truncate leading-snug" title={job.originalName}>
                    {job.originalName}
                  </h3>
                  <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-500">
                    <span>ID: {job.id.substring(0, 8)}</span>
                    <span>•</span>
                    <span>{job.pages} {job.pages === 1 ? 'page' : 'pages'}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sender:</span>
                    <span className="truncate max-w-[140px]" title={job.customerName}>{job.customerName || 'Anonymous'}</span>
                  </div>
                  {/* Print Cost Badge */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Charge Amount:</span>
                    <span className="font-extrabold text-emerald-400 font-mono text-xs">
                      {currencySymbol}{(job.pages * job.copies * (job.color ? rateColor : rateBW)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Print Specs Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                    {job.copies} {job.copies === 1 ? 'copy' : 'copies'}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                    job.color ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {job.color ? 'Color' : 'B&W'}
                  </span>
                  <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                    {job.paperSize}
                  </span>
                  <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                    {job.duplex ? 'Double-Sided' : 'Single-Sided'}
                  </span>
                </div>

                {/* Card Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-900/60">
                  {/* File preview */}
                  <button
                    onClick={() => setPreviewJob(job)}
                    disabled={!job.hasFile}
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Preview File"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  
                  {/* Edit settings */}
                  <button
                    onClick={() => setEditJob(job)}
                    disabled={job.status === 'done'}
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Edit Settings"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>

                  {/* Print Command */}
                  {job.status !== 'done' && (
                    <button
                      onClick={() => handlePrintTrigger(job)}
                      disabled={!job.hasFile}
                      className="flex-1 py-2 bg-brand-primary hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-glow hover:scale-[1.01] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print File
                    </button>
                  )}

                  {/* Re-enqueue / Archive for Done state */}
                  {job.status === 'done' && (
                    <div className="w-full text-center py-2 text-[10px] font-mono text-slate-500 bg-slate-950/20 rounded-xl border border-slate-900">
                      File auto-deleted
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: PREVIEW SYSTEM */}
      <AnimatePresence>
        {previewJob && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl h-[85vh] bg-[#0f172a] rounded-3xl border border-slate-800 shadow-premium overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-850 flex justify-between items-center">
                <div className="truncate pr-4">
                  <h3 className="text-sm font-bold text-white truncate">{previewJob.originalName}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">File preview portal</p>
                </div>
                <button
                  onClick={() => setPreviewJob(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Body: Embedded Viewer */}
              <div className="flex-1 bg-slate-950 relative flex items-center justify-center">
                {(() => {
                  const ext = previewJob.filename.slice(previewJob.filename.lastIndexOf('.')).toLowerCase();
                  const fileUrl = `${apiUrl}/file/${previewJob.id}`;
                  
                  // Image preview
                  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                    return (
                      <img
                        src={fileUrl}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain p-4"
                      />
                    );
                  }

                  // PDF or Converted DOCX preview
                  if (ext === '.pdf' || ['.doc', '.docx'].includes(ext)) {
                    // For Word docs, append preview=true so the server compiles it to PDF first
                    const docUrl = ['.doc', '.docx'].includes(ext) 
                      ? `${fileUrl}?preview=true` 
                      : fileUrl;
                    
                    return (
                      <iframe
                        src={`${docUrl}#toolbar=0`}
                        className="w-full h-full border-0"
                        title="PDF Preview"
                      />
                    );
                  }

                  // Fallback
                  return (
                    <div className="text-center text-xs text-slate-500">
                      Preview not supported for this file format.
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDIT PRINT CONFIG OPTIONS */}
      <AnimatePresence>
        {editJob && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-sm glass-panel p-6 rounded-3xl shadow-premium border-slate-800"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-bold text-white">Edit Configurations</h3>
                <button
                  onClick={() => setEditJob(null)}
                  className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateOptionsSave} className="space-y-4 text-xs">
                {/* Copies stepper */}
                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <span className="font-semibold text-slate-300">Copies</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setEditJob({ ...editJob, copies: Math.max(1, editJob.copies - 1) })}
                      className="h-7 w-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold font-mono text-white">{editJob.copies}</span>
                    <button
                      type="button"
                      onClick={() => setEditJob({ ...editJob, copies: editJob.copies + 1 })}
                      className="h-7 w-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Color Print Switch */}
                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <span className="font-semibold text-slate-300">Color Print</span>
                  <button
                    type="button"
                    onClick={() => setEditJob({ ...editJob, color: !editJob.color })}
                    className={`h-5 w-9 rounded-full transition-all duration-300 relative ${
                      editJob.color ? 'bg-brand-success' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`h-3 w-3 rounded-full bg-white absolute top-1 transition-all ${
                      editJob.color ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Paper size selector */}
                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <span className="font-semibold text-slate-300">Paper Size</span>
                  <select
                    value={editJob.paperSize}
                    onChange={(e) => setEditJob({ ...editJob, paperSize: e.target.value })}
                    className="h-8 rounded px-2 bg-slate-800 border border-slate-700 text-white outline-none"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="A3">A3</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>

                {/* Duplex double sided */}
                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <span className="font-semibold text-slate-300">Double Sided</span>
                  <button
                    type="button"
                    onClick={() => setEditJob({ ...editJob, duplex: !editJob.duplex })}
                    className={`h-5 w-9 rounded-full transition-all duration-300 relative ${
                      editJob.duplex ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`h-3 w-3 rounded-full bg-white absolute top-1 transition-all ${
                      editJob.duplex ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-brand-primary hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-glow hover:scale-[1.01]"
                >
                  Save Settings
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: POST-PRINT ACTION CONFIRMATION BANNER */}
      <AnimatePresence>
        {printConfirmationJob && (
          <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="p-5 rounded-3xl glass-panel shadow-premium border-amber-500/20 bg-slate-900 border space-y-4"
            >
              <div className="flex gap-3">
                <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Printing Status</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Did the print dialog finish successfully for: <span className="text-slate-300 font-medium">{printConfirmationJob.originalName}</span>?
                  </p>
                </div>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setPrintConfirmationJob(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel / Re-print
                </button>
                <button
                  onClick={() => printDoneMutation.mutate(printConfirmationJob.id)}
                  className="flex-1 py-2 bg-brand-success hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-md"
                >
                  Confirm Printed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
