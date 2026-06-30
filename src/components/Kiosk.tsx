import React, { useState } from 'react';
import { QRScanner } from './QRScanner';
import { Numpad } from './Numpad';
import { useRegistry, type Captain } from '../context/RegistryContext';
import { CheckCircle, AlertTriangle, Users } from 'lucide-react';

// Change before each event. Do not commit the real value to a public repo.
const ADMIN_PIN = '9999';

type Step = 'IDLE' | 'SCANNING' | 'MANUAL_SEARCH' | 'VERIFYING' | 'COLLECT_PHONE' | 'SUCCESS' | 'LOCKED' | 'ADMIN_OVERRIDE';

export const Kiosk: React.FC = () => {
  const { registry, updateSyncStatus, updatePhoneLast4, getCheckedInCount } = useRegistry();
  const [step, setStep] = useState<Step>('IDLE');
  const [scannedCaptain, setScannedCaptain] = useState<Captain | null>(null);
  const [pin, setPin] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [hiddenTapCount, setHiddenTapCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const { updatePhone } = useRegistry();

  const handleScan = (data: string) => {
    try {
      const payload = JSON.parse(data);
      if (payload.v_id) {
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && now > payload.exp) {
          alert('This pass has expired. Please visit precincts.info/pass to generate a new one.');
          reset();
          return;
        }
        const captain = registry.find(c => c.uuid === payload.v_id);
        if (captain) {
          if (captain.syncStatus === 1 || captain.syncStatus === 2) {
            alert('Captain is already checked in.');
            reset();
            return;
          }
          setScannedCaptain(captain);
          if (captain.phoneLast4 === null) {
            setStep('COLLECT_PHONE');
          } else {
            setStep('VERIFYING');
          }
          setPin('');
          setSmsConsent(false);
          setIdentityConfirmed(false);
        }
      }
    } catch (e) {
      console.error("Invalid QR code");
    }
  };

  const handleSavePhone = () => {
    if (!scannedCaptain || !smsConsent) return;
    if (pin.length === 10) {
      updatePhone(scannedCaptain.uuid, pin);
      updateSyncStatus(scannedCaptain.uuid, 1);
      setStep('SUCCESS');
      setTimeout(() => reset(), 3000);
    }
  };

  const handleVerify = () => {
    if (!scannedCaptain || !identityConfirmed) return;
    if (scannedCaptain.phoneLast4 === pin) {
      updateSyncStatus(scannedCaptain.uuid, 1);
      setStep('SUCCESS');
      setTimeout(() => reset(), 3000);
    } else {
      const newFails = failCount + 1;
      setFailCount(newFails);
      setPin('');
      if (newFails >= 2) {
        updateSyncStatus(scannedCaptain.uuid, 3);
        setStep('LOCKED');
      } else {
        alert('Incorrect PIN. Please try again.');
      }
    }
  };

  const handleAdminVerify = () => {
    if (pin === ADMIN_PIN && scannedCaptain) {
      updateSyncStatus(scannedCaptain.uuid, 2);
      setStep('SUCCESS');
      setTimeout(() => reset(), 3000);
    } else {
      setPin('');
      alert('Incorrect Admin PIN.');
    }
  };

  const reset = () => {
    setStep('IDLE');
    setScannedCaptain(null);
    setPin('');
    setFailCount(0);
    setHiddenTapCount(0);
    setSearchQuery('');
    setSmsConsent(false);
    setIdentityConfirmed(false);
  };

  const handleHiddenTap = () => {
    if (step === 'LOCKED') {
      const taps = hiddenTapCount + 1;
      setHiddenTapCount(taps);
      if (taps >= 3) {
        setStep('ADMIN_OVERRIDE');
        setPin('');
        setHiddenTapCount(0);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Header / Quorum Counter */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center border-b border-slate-200">
        <div className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="text-blue-600" />
          Quorum Check-in
        </div>
        <div className="bg-emerald-100 text-emerald-800 px-5 py-2 rounded-xl font-bold text-xl border border-emerald-200 flex items-center gap-3 shadow-inner">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-sm"></span>
          </span>
          Live Quorum: {getCheckedInCount()} Verified
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {step === 'IDLE' && (
          <div className="text-center space-y-8 animate-in fade-in duration-300">
            <button 
              onClick={() => setStep('SCANNING')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-[3rem] py-16 px-24 text-5xl font-bold shadow-2xl transition-transform active:scale-95 flex flex-col items-center gap-4 border-b-8 border-blue-800 active:border-b-0 active:translate-y-2"
            >
              Tap to Scan QR Pass
            </button>
            <button 
              onClick={() => setStep('MANUAL_SEARCH')}
              className="text-blue-600 font-semibold text-2xl underline hover:text-blue-800 transition-colors"
            >
              No QR Code? Search by Name
            </button>
          </div>
        )}

        {step === 'MANUAL_SEARCH' && (
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 border border-slate-200 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Search by Name</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Type first letters of last name…"
              autoFocus
              className="w-full p-4 text-2xl border-2 border-slate-300 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {searchQuery.length >= 2
                ? registry
                    .filter(c =>
                      c.lastName.toLowerCase().startsWith(searchQuery.trim().toLowerCase())
                    )
                    .map(c => (
                      <button
                        key={c.uuid}
                        onClick={() => {
                          if (c.syncStatus === 1 || c.syncStatus === 2) {
                            alert('Captain is already checked in.');
                            return;
                          }
                          setScannedCaptain(c);
                          setSearchQuery('');
                          if (c.phoneLast4 === null) {
                            setStep('COLLECT_PHONE');
                          } else {
                            setStep('VERIFYING');
                          }
                          setPin('');
                          setSmsConsent(false);
                          setIdentityConfirmed(false);
                        }}
                        className={`w-full text-left p-4 border rounded-xl transition-colors flex justify-between items-center ${
                          c.syncStatus > 0 
                            ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' 
                            : 'bg-slate-50 hover:bg-blue-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <span className="text-xl font-bold text-slate-800">{c.lastName}, {c.firstName}</span>
                          <span className="ml-3 text-slate-500 font-medium">Precinct {c.precinct}</span>
                        </div>
                        {c.syncStatus > 0 && (
                          <span className="text-emerald-600 font-bold text-sm bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Checked In
                          </span>
                        )}
                      </button>
                    ))
                : <p className="text-slate-400 text-center text-lg">Type at least 2 letters to search.</p>
              }
            </div>
            <button onClick={() => { setSearchQuery(''); reset(); }} className="mt-8 text-slate-500 font-bold text-xl hover:text-slate-700 w-full text-center">
              Cancel
            </button>
          </div>
        )}

        {step === 'SCANNING' && (
          <div className="w-full max-w-2xl text-center animate-in slide-in-from-bottom-8 duration-300">
            <h2 className="text-4xl font-bold text-slate-800 mb-8">Scan your pass</h2>
            <QRScanner onScan={handleScan} />
            <button onClick={reset} className="mt-8 text-slate-500 font-bold text-2xl hover:text-slate-700">Cancel</button>
          </div>
        )}

        {step === 'VERIFYING' && scannedCaptain && (
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 text-center border border-slate-200 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              Welcome, Captain {scannedCaptain.firstName} {scannedCaptain.lastName}
            </h2>
            <div className="bg-slate-100 inline-block px-4 py-1 rounded-full text-slate-700 font-bold mb-6 border border-slate-300">
              Precinct {scannedCaptain.precinct}
            </div>
            
            <div className="mb-6 flex items-start text-left px-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <input
                type="checkbox"
                id="identityConfirmed"
                checked={identityConfirmed}
                onChange={(e) => setIdentityConfirmed(e.target.checked)}
                className="mt-1 w-6 h-6 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
              />
              <label htmlFor="identityConfirmed" className="ml-3 text-slate-800 font-medium cursor-pointer">
                I confirm that I am {scannedCaptain.firstName} {scannedCaptain.lastName} and my information is still accurate.
              </label>
            </div>

            <p className="text-slate-600 mb-6 font-medium text-lg leading-relaxed px-4">
              To verify your identity and comply with anti-proxy bylaws, please enter the last 4 digits of your registered phone number:<br/>
              <span className="text-slate-800 font-bold tracking-widest mt-4 inline-block text-3xl bg-slate-100 py-2 px-6 rounded-xl border border-slate-300">***-***-____</span>
            </p>
            
            <Numpad 
              value={pin}
              onChange={setPin}
              onClear={() => setPin('')}
              onSubmit={handleVerify}
              submitDisabled={!identityConfirmed}
            />
            
            <button onClick={reset} className="mt-8 text-slate-500 font-bold text-xl hover:text-slate-700">Cancel</button>
          </div>
        )}

        {step === 'COLLECT_PHONE' && scannedCaptain && (
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 text-center border border-slate-200 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              Welcome, Captain {scannedCaptain.firstName} {scannedCaptain.lastName}
            </h2>
            <div className="bg-slate-100 inline-block px-4 py-1 rounded-full text-slate-700 font-bold mb-8 border border-slate-300">
              Precinct {scannedCaptain.precinct}
            </div>
            <p className="text-slate-600 mb-6 font-medium text-lg leading-relaxed px-4">
              We don't have a phone number on file for you yet.<br/>
              Please enter your 10-digit cell phone number to complete check-in:
            </p>

            <Numpad 
              value={pin}
              onChange={setPin}
              onClear={() => setPin('')}
              onSubmit={handleSavePhone}
              maxLength={10}
              submitDisabled={!smsConsent}
            />

            <div className="mt-6 flex items-start text-left px-4">
              <input
                type="checkbox"
                id="smsConsent"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-1 w-6 h-6 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
              />
              <label htmlFor="smsConsent" className="ml-3 text-slate-600 text-sm cursor-pointer">
                I confirm this is my personal cell phone number and I consent to receive important meeting updates via SMS.
              </label>
            </div>
            
            <button onClick={reset} className="mt-8 text-slate-500 font-bold text-xl hover:text-slate-700">Cancel</button>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle className="w-64 h-64 text-emerald-500 mb-8 drop-shadow-xl" />
            <h2 className="text-5xl font-black text-emerald-600 drop-shadow-sm">Verification Complete</h2>
          </div>
        )}

        {step === 'LOCKED' && (
          <div className="flex flex-col items-center justify-center max-w-2xl text-center animate-in zoom-in-95 duration-300 bg-white p-16 rounded-[3rem] shadow-2xl border-4 border-red-100">
            <AlertTriangle className="w-40 h-40 text-red-500 mb-8 drop-shadow-xl" />
            <h2 className="text-5xl font-black text-slate-900 mb-6">Verification Failed</h2>
            <p className="text-3xl text-slate-600 font-medium bg-red-50 py-4 px-8 rounded-2xl border border-red-100">
              Staff Assistance Required
            </p>
          </div>
        )}

        {step === 'ADMIN_OVERRIDE' && (
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 text-center border-4 border-red-500 relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full bg-red-500 text-white font-bold py-2 uppercase tracking-widest text-lg rounded-t-2xl shadow-sm">
              Admin Mode
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-3 mt-8">
              Staff Override
            </h2>
            <p className="text-red-600 font-bold mb-8 text-lg px-4 bg-red-50 py-3 rounded-xl border border-red-100">
              Enter Admin PIN to override check-in for {scannedCaptain?.firstName} {scannedCaptain?.lastName}.
            </p>
            
            <Numpad 
              value={pin}
              onChange={setPin}
              onClear={() => setPin('')}
              onSubmit={handleAdminVerify}
            />
            <button onClick={reset} className="mt-8 text-slate-500 font-bold text-xl hover:text-slate-700">Cancel Override</button>
          </div>
        )}

        {/* Hidden Touch Target (Bottom Left Corner) */}
        {step === 'LOCKED' && (
          <div 
            onClick={handleHiddenTap}
            className="absolute bottom-0 left-0 w-48 h-48 z-50 cursor-default opacity-0"
          ></div>
        )}
      </div>
    </div>
  );
};
