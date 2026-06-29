import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRegistry } from '../context/RegistryContext';

export const PassGenerator: React.FC = () => {
  const { registry } = useRegistry();
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [passData, setPassData] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [captainInfo, setCaptainInfo] = useState<{name: string, pct: string} | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const captain = registry.find(
      c =>
        c.lastName.toLowerCase() === lastName.trim().toLowerCase() &&
        c.zip === zipCode.trim()
    );
    
    if (captain) {
      const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
      const payload = {
        v_id: captain.uuid,
        pct: captain.precinctAbbr,
        exp
      };
      setPassData(JSON.stringify(payload));
      setCaptainInfo({ name: `${captain.firstName} ${captain.lastName}`, pct: captain.precinct });
    } else {
      setError('No record found matching that information.');
      setPassData(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden mt-8 border border-slate-200">
        <div className="bg-blue-700 p-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-tight">Quorum Pass</h1>
          <p className="text-blue-100 mt-1">Get your digital meeting credential</p>
        </div>
        
        {!passData ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. 45429"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 mt-4"
            >
              Retrieve Pass
            </button>
          </form>
        ) : (
          <div className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 border-2 border-slate-100 rounded-2xl shadow-sm mb-6 inline-block">
              <QRCodeSVG value={passData} size={250} level="H" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">{captainInfo?.name}</h2>
            <p className="text-slate-500 mb-6 font-medium">Precinct {captainInfo?.pct}</p>
            
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center w-full">
              <p className="text-emerald-800 font-medium mb-3 text-sm">
                Your credentials for the Central Committee meeting are ready. As the representative for {captainInfo?.pct}, your precincts.info publishing dashboard is standing by.
              </p>
              <button onClick={() => window.open('https://precincts.info/activate', '_blank')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 text-sm">
                Click here to set a password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
