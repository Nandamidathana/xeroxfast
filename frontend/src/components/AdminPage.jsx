import React, { useState, useRef, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Download, ExternalLink, ArrowRight, Printer, QrCode, User, Phone, Briefcase } from 'lucide-react';
import { useStore } from '../store';

export default function AdminPage() {
  const { currentShopId, setShopId } = useStore();
  const [shopInput, setShopInput] = useState(currentShopId);
  const [copiedType, setCopiedType] = useState(null); // 'user' | 'shop'
  const qrRef = useRef(null);

  // Profile setup states
  const getProfile = (shopId) => {
    try {
      const data = localStorage.getItem(`shop_profile_${shopId}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.name && parsed.purpose && parsed.phone) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const [profile, setProfile] = useState(() => getProfile(currentShopId));
  const [nameInput, setNameInput] = useState(profile?.name || '');
  const [purposeInput, setPurposeInput] = useState(profile?.purpose || '');
  const [phoneInput, setPhoneInput] = useState(profile?.phone || '');

  // Synchronize when currentShopId changes
  useEffect(() => {
    const activeProfile = getProfile(currentShopId);
    setProfile(activeProfile);
    setNameInput(activeProfile?.name || '');
    setPurposeInput(activeProfile?.purpose || '');
    setPhoneInput(activeProfile?.phone || '');
  }, [currentShopId]);

  const origin = window.location.origin;
  const userUrl = `${origin}/u?shop=${currentShopId}`;
  const shopUrl = `${origin}/shop?shop=${currentShopId}`;

  const handleUpdateShop = (e) => {
    e.preventDefault();
    if (shopInput.trim()) {
      const nextShopId = shopInput.trim().toLowerCase();
      setShopId(nextShopId);
    }
  };

  const handleRegisterProfile = (e) => {
    e.preventDefault();
    if (nameInput.trim() && purposeInput.trim() && phoneInput.trim()) {
      const newProfile = {
        name: nameInput.trim(),
        purpose: purposeInput.trim(),
        phone: phoneInput.trim()
      };
      localStorage.setItem(`shop_profile_${currentShopId}`, JSON.stringify(newProfile));
      setProfile(newProfile);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadQRCode = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `qr-print-${currentShopId}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 bg-[#0b0f19] text-slate-100 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8 z-10">
        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-primary to-indigo-400 flex items-center justify-center shadow-glow">
            <Printer className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              AirSketch Print
            </h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">QR Printing System</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm text-slate-400">
          <span className="h-2 w-2 rounded-full bg-brand-success animate-pulse"></span>
          <span>Cloud Server Active</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center z-10 flex-grow">
        
        {/* Left Side: Form Controls */}
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary px-2.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20">
              Shop Configuration
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-white">
              Create Your Instant Walk-Up Portal.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Define a unique Shop ID. Your customers can scan a generated QR code to upload documents and print directly without installing any software or logging in.
            </p>
          </div>

          <form onSubmit={handleUpdateShop} className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Enter Shop ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                placeholder="e.g. quickprint, library-floor1"
                className="flex-1 px-4 py-3 rounded-xl glass-input text-white border-slate-700 bg-slate-900/60 focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-brand-primary hover:bg-indigo-700 text-white rounded-xl font-medium transition-all duration-300 flex items-center gap-2 hover:scale-[1.02]"
              >
                Apply
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* URL Cards */}
          <div className="space-y-4 pt-2">
            {/* Customer Link Card */}
            <div className="p-4 rounded-2xl glass-card relative group hover:border-slate-700 transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                  Customer Upload Link
                </span>
                {profile ? (
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 break-all select-all">
                {userUrl}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  disabled={!profile}
                  onClick={() => copyToClipboard(userUrl, 'user')}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedType === 'user' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-brand-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
                <a
                  href={profile ? userUrl : '#'}
                  onClick={(e) => { if (!profile) e.preventDefault(); }}
                  target={profile ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                    profile
                      ? 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border-brand-primary/20'
                      : 'bg-slate-800/40 text-slate-500 border-slate-800/20 pointer-events-none'
                  }`}
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Shop Dashboard Link Card */}
            <div className="p-4 rounded-2xl glass-card relative group hover:border-slate-700 transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-brand-primary uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Shop Dashboard Link
                </span>
                {profile ? (
                  <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 break-all select-all">
                {shopUrl}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  disabled={!profile}
                  onClick={() => copyToClipboard(shopUrl, 'shop')}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedType === 'shop' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-brand-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
                <a
                  href={profile ? shopUrl : '#'}
                  onClick={(e) => { if (!profile) e.preventDefault(); }}
                  target={profile ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                    profile
                      ? 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border-brand-primary/20'
                      : 'bg-slate-800/40 text-slate-500 border-slate-800/20 pointer-events-none'
                  }`}
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Card Display or Registration Form */}
        <div className="flex flex-col items-center justify-center">
          {profile ? (
            <div className="w-full max-w-[340px] p-6 rounded-3xl glass-panel relative shadow-premium border-slate-800 flex flex-col items-center justify-center glow-active">
              {/* Soft decorative header inside QR card */}
              <div className="flex items-center gap-2 mb-6">
                <QrCode className="h-5 w-5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer QR Portal</span>
              </div>

              {/* QR Code Container */}
              <div
                ref={qrRef}
                className="p-4 bg-white rounded-2xl shadow-inner border border-slate-200 transition-all duration-300 hover:scale-[1.02]"
              >
                <QRCodeCanvas
                  value={userUrl}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Shop Identifier text */}
              <div className="mt-6 text-center space-y-1">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Active Shop</p>
                <h3 className="text-lg font-bold text-indigo-300 font-mono tracking-wide">
                  {currentShopId}
                </h3>
              </div>

              {/* Download Button */}
              <button
                onClick={downloadQRCode}
                className="mt-6 w-full py-3 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-glow transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Download QR Code (PNG)
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[340px] p-6 rounded-3xl glass-panel relative shadow-premium border-slate-850 flex flex-col glow-active">
              {/* Soft decorative header inside Form card */}
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Setup QR Portal</span>
              </div>

              <div className="space-y-1 mb-5">
                <h3 className="text-base font-bold text-white tracking-tight">Complete Shop Profile</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Provide details for <strong className="text-indigo-300 font-mono capitalize">{currentShopId}</strong> to generate its QR code.
                </p>
              </div>

              <form onSubmit={handleRegisterProfile} className="space-y-4">
                {/* Name Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Owner/Shop Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Alex Copy Center"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 text-white text-xs font-semibold outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Purpose Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Purpose / Service
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={purposeInput}
                      onChange={(e) => setPurposeInput(e.target.value)}
                      placeholder="e.g. Student Printing, Xerox"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 text-white text-xs font-semibold outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Phone Number Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 text-white text-xs font-semibold outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!nameInput.trim() || !purposeInput.trim() || !phoneInput.trim()}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-xl shadow-glow transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <QrCode className="h-4 w-4" />
                  Generate QR Code
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-600 mt-8 pt-4 border-t border-slate-900/60 z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>AirSketch Print © 2026. Made with passion for high-speed printing workflows.</span>
        <span className="text-[10px] text-slate-500 font-mono">Developed by <strong className="text-indigo-400 font-semibold uppercase tracking-wider">Nanda</strong></span>
      </footer>
    </div>
  );
}
