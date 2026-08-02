import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { 
  Upload, FileText, CheckCircle2, Plus, Minus, 
  Layers, RefreshCw, Sparkles, Trash2, User, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadPage() {
  const { apiUrl, customerName, setCustomerName } = useStore();
  
  // Extract shopId from URL query parameters
  const queryParams = new URLSearchParams(window.location.search);
  const shopId = queryParams.get('shop') || 'quickprint';

  // Shop details profile from database
  const [shopProfile, setShopProfile] = useState(null);

  // Fetch shop profile from backend on mount
  useEffect(() => {
    if (!apiUrl || !shopId) return;
    const fetchShopProfile = async () => {
      try {
        const res = await fetch(`${apiUrl}/shop/profile?shopId=${shopId}`);
        if (res.ok) {
          const data = await res.json();
          setShopProfile(data);
        }
      } catch (err) {
        console.warn('Failed to fetch shop profile:', err);
      }
    };
    fetchShopProfile();
  }, [apiUrl, shopId]);

  // Files & Profile state
  const [nameInput, setNameInput] = useState(customerName || '');
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, previewUrl, id, copies: 1, color: true, paperSize: 'A4', duplex: false }
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0 to 100
  const [uploadResults, setUploadResults] = useState([]); // Array of successful jobs

  const fileInputRef = useRef(null);

  // Add files helper
  const addFiles = (filesList) => {
    const validTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    const newFiles = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      
      // Validation: file type and max 200MB size
      if (!validTypes.includes(ext)) {
        alert(`File type not allowed: ${file.name}\nOnly PDF, PNG, JPG, DOC, DOCX are supported.`);
        continue;
      }
      if (file.size > 200 * 1024 * 1024) {
        alert(`File too large: ${file.name}\nMaximum file size is 200MB.`);
        continue;
      }

      // Generate preview URL if it's an image
      let previewUrl = null;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newFiles.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        previewUrl,
        copies: 1,
        color: true, // true = Color, false = B&W
        paperSize: 'A4',
        duplex: false // true = double sided
      });
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const removeFile = (id) => {
    setSelectedFiles((prev) => {
      const filtered = prev.filter(f => f.id !== id);
      // Clean up object URL to prevent memory leaks
      const removed = prev.find(f => f.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return filtered;
    });
  };

  // Stepper controls per file
  const updateFileSetting = (id, field, value) => {
    setSelectedFiles(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  // Submit files in parallel with retry mechanisms
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    try {
      const uploadPromises = selectedFiles.map(async (item) => {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('shopId', shopId);
        formData.append('copies', item.copies);
        formData.append('color', item.color);
        formData.append('paperSize', item.paperSize);
        formData.append('duplex', item.duplex);
        formData.append('customerName', customerName);

        let attempt = 0;
        let response;
        let success = false;
        let lastError;

        while (attempt < 3 && !success) {
          try {
            response = await fetch(`${apiUrl}/upload`, {
              method: 'POST',
              body: formData,
            });
            if (response.ok) {
              success = true;
            } else {
              const errData = await response.json();
              lastError = new Error(errData.error || `Upload failed with status ${response.status}`);
              attempt++;
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            lastError = err;
            attempt++;
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!success) {
          throw lastError || new Error(`Failed to upload ${item.name} after 3 attempts`);
        }

        const data = await response.json();
        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
        return data.job;
      });

      const results = await Promise.all(uploadPromises);
      setUploadResults(results);
      setSelectedFiles([]); // clear files
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadResults([]);
    setUploadProgress(0);
  };

  const handleSaveProfileName = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setCustomerName(nameInput.trim());
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Upload Container */}
      <div className="w-full max-w-lg z-10">
        
        {/* Shop logo & name header */}
        <div className="text-center mb-6 space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-primary to-indigo-400 flex items-center justify-center shadow-glow mb-2">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          {customerName ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Welcome back, <span className="text-indigo-400">{customerName}</span>!
              </h2>
              <div className="flex items-center justify-center gap-2 mt-1 text-slate-400 text-xs">
                <span>Shop: <strong className="text-slate-300 font-mono capitalize">{shopProfile?.name || shopId}</strong></span>
                {shopProfile?.purpose && <span className="text-slate-500 font-medium font-mono text-[10px]">({shopProfile.purpose})</span>}
                <span>•</span>
                <button 
                  onClick={() => {
                    setCustomerName('');
                    setNameInput('');
                  }}
                  className="text-[10px] text-brand-danger hover:underline font-semibold"
                  title="Change Name"
                >
                  Change Account
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Upload to <span className="text-indigo-400 capitalize font-mono">{shopProfile?.name || shopId}</span>
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {shopProfile?.purpose || "Scan & Print • Instant document upload portal"}
              </p>
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: INITIAL NAME SIGNUP DIALOG */}
          {!customerName ? (
            <motion.div
              key="name-signup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-6 rounded-3xl border-slate-800 shadow-premium space-y-5"
            >
              <div className="space-y-1.5 text-center">
                <h3 className="text-lg font-bold text-white tracking-tight">Welcome to {shopProfile?.name || 'PrintX'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your name so the shopkeeper can easily identify your files in the print queue.
                </p>
              </div>

              <form onSubmit={handleSaveProfileName} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. John Doe"
                    maxLength={30}
                    className="w-full px-4 py-3 rounded-xl glass-input text-white border-slate-800 bg-slate-950/40 text-center text-sm font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!nameInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-semibold rounded-xl transition-all shadow-glow hover:scale-[1.01] active:scale-[0.99]"
                >
                  Continue to Upload
                </button>
              </form>
            </motion.div>
          ) : uploadResults.length > 0 ? (
            /* SUCCESS SCREEN WITH COST SUMMARY */
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-6 rounded-3xl border-emerald-500/20 shadow-premium"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Uploaded Successfully!</h3>
                  <p className="text-slate-400 text-xs">Your print jobs are now queued in the shop dashboard.</p>
                </div>
                
                {/* Jobs Info List */}
                <div className="w-full space-y-3 pt-2">
                  {uploadResults.map((job) => {
                    return (
                      <div 
                        key={job.id}
                        className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 text-left space-y-2"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-semibold text-slate-200 truncate max-w-[70%]">
                            {job.originalName}
                          </span>
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                            {job.pages} {job.pages === 1 ? 'page' : 'pages'}
                          </span>
                        </div>

                        {/* Config details block (No pricing) */}
                        <div className="flex justify-between items-center py-1.5 border-y border-slate-900/60 text-[10px] text-slate-400 font-medium">
                          <span>Mode: {job.color ? 'Color' : 'B&W'}</span>
                          <span>Copies: x{job.copies}</span>
                          <span>Layout: {job.duplex ? 'Double Sided' : 'Single Sided'}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>Job ID: {job.id.substring(0, 8)}...</span>
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Waiting for print
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={resetUploadState}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                  Upload More Files
                </button>
              </div>
            </motion.div>
          ) : (
            /* UPLOAD PORTAL MAIN */
            <motion.div
              key="portal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`glass-panel p-8 rounded-3xl border-dashed border-2 cursor-pointer flex flex-col items-center justify-center text-center space-y-3 transition-all duration-300 ${
                  isDragging 
                    ? 'border-brand-primary bg-indigo-500/5 scale-[1.01]' 
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
                
                <div className="h-12 w-12 rounded-2xl bg-slate-900/80 flex items-center justify-center border border-slate-800 shadow-md">
                  <Upload className="h-6 w-6 text-slate-400" />
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Drag & drop files here
                  </p>
                  <p className="text-xs text-slate-400">
                    or click to browse from device
                  </p>
                </div>
                
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  PDF, Images, DOCX (Max 200MB)
                </p>
              </div>

              {/* Selected Files & Settings */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                    Selected Files ({selectedFiles.length})
                  </h3>

                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                    {selectedFiles.map((item) => (
                      <div 
                        key={item.id}
                        className="p-4 rounded-2xl glass-card border-slate-800 space-y-3.5"
                      >
                        {/* File details */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center space-x-3 truncate">
                            {item.previewUrl ? (
                              <img 
                                src={item.previewUrl} 
                                alt="file preview" 
                                className="h-10 w-10 object-cover rounded-lg border border-slate-700" 
                              />
                            ) : (
                              <div className="h-10 w-10 bg-slate-850 border border-slate-855 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-indigo-400" />
                              </div>
                            )}
                            <div className="truncate">
                              <p className="text-xs font-semibold text-slate-200 truncate leading-snug">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {item.size}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFile(item.id)}
                            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-brand-danger rounded-md transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* File Print Config Options */}
                        <div className="grid grid-cols-3 gap-3 pt-2.5 border-t border-slate-900/60 text-xs items-center">
                          {/* Copies Config */}
                          <div className="space-y-1 col-span-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">Copies</span>
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => updateFileSetting(item.id, 'copies', Math.max(1, item.copies - 1))}
                                className="h-6 w-6 rounded bg-slate-855 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-5 text-center text-xs font-bold font-mono">
                                {item.copies}
                              </span>
                              <button
                                onClick={() => updateFileSetting(item.id, 'copies', item.copies + 1)}
                                className="h-6 w-6 rounded bg-slate-855 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Color Switch */}
                          <div className="flex flex-col items-center justify-center space-y-1 col-span-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Color Print</span>
                            <button
                              onClick={() => updateFileSetting(item.id, 'color', !item.color)}
                              className={`h-5 w-9 rounded-full transition-all duration-300 relative ${
                                item.color ? 'bg-brand-success' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`h-3 w-3 rounded-full bg-white absolute top-1 transition-all ${
                                item.color ? 'right-1' : 'left-1'
                              }`} />
                            </button>
                          </div>

                          {/* Duplex Switch */}
                          <div className="flex flex-col items-center justify-center space-y-1 col-span-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">2-Sided</span>
                            <button
                              onClick={() => updateFileSetting(item.id, 'duplex', !item.duplex)}
                              className={`h-5 w-9 rounded-full transition-all duration-300 relative ${
                                item.duplex ? 'bg-indigo-500' : 'bg-slate-800'
                              }`}
                            >
                              <div className={`h-3 w-3 rounded-full bg-white absolute top-1 transition-all ${
                                item.duplex ? 'right-1' : 'left-1'
                              }`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upload Actions */}
                  {!isUploading ? (
                    <button
                      onClick={handleUpload}
                      className="w-full py-3.5 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-glow transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      <Layers className="h-4.5 w-4.5" />
                      Upload to Shop ({selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'})
                    </button>
                  ) : (
                    <div className="p-4 glass-panel rounded-2xl border-indigo-500/10 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Uploading documents...
                        </span>
                        <span className="text-slate-400 font-mono">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Watermark */}
      <footer className="w-full text-center text-[10px] text-slate-600 mt-8 pt-4 border-t border-slate-900/40 z-10 font-mono">
        PrintX © 2026 • Developed by <strong className="text-indigo-400 font-semibold uppercase tracking-wider">Nanda</strong>
      </footer>
    </div>
  );
}
