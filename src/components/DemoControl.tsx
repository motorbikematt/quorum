import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const DemoControl: React.FC = () => {
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();

  const handleReset = () => {
    localStorage.removeItem('quorumRegistry');
    setResetSuccess(true);
    
    // Give user a moment to see the success message, then reload to reseed the context
    setTimeout(() => {
      window.location.href = '/#/kiosk'; // Redirects and reloads context
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Demo Controls</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Use this page to reset the local database for your next demo. This will clear all checked-in statuses and custom PINs.
          </p>
        </div>

        {resetSuccess ? (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-4 rounded-xl font-medium mb-6 animate-pulse">
            Database reset successfully! Redirecting...
          </div>
        ) : (
          <button 
            onClick={handleReset}
            className="w-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-white font-bold py-4 px-6 rounded-xl shadow-md mb-4"
          >
            Reset Database
          </button>
        )}

        <button 
          onClick={() => navigate('/kiosk')}
          className="text-slate-500 text-sm font-medium hover:text-slate-700"
        >
          Cancel & Return to Kiosk
        </button>
      </div>
    </div>
  );
};
