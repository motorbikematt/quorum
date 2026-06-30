import React from 'react';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
  maxLength?: number;
}

export const Numpad: React.FC<NumpadProps> = ({ value, onChange, onSubmit, onClear, disabled, submitDisabled, maxLength = 4 }) => {
  const handlePress = (num: string) => {
    if (value.length < maxLength && !disabled) {
      onChange(value + num);
    }
  };

  const handleDelete = () => {
    if (!disabled) {
      onChange(value.slice(0, -1));
    }
  };

  const renderKey = (label: string, onClick: () => void, extraClasses = '') => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-16 text-2xl font-semibold bg-white border border-slate-200 rounded-xl shadow-sm active:bg-slate-100 flex items-center justify-center transition-colors ${extraClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm select-none">
      <div className="col-span-3 mb-4 flex items-center justify-center">
        {maxLength === 4 ? (
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-12 h-12 rounded-lg border-2 border-slate-300 flex items-center justify-center text-2xl font-bold bg-white text-slate-800">
                {value[i] !== undefined ? '*' : ''}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full text-center text-3xl font-bold tracking-widest text-slate-800 bg-white border-2 border-slate-300 rounded-xl h-14 flex items-center justify-center">
            {value.length > 0 ? value : <span className="text-slate-300 opacity-50">Phone Number</span>}
          </div>
        )}
      </div>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => renderKey(num.toString(), () => handlePress(num.toString())))}
      {renderKey('CLR', onClear, 'text-red-500 font-bold text-lg')}
      {renderKey('0', () => handlePress('0'))}
      {renderKey('DEL', handleDelete, 'text-slate-500 text-lg')}
      <div className="col-span-3 mt-2">
        <button
          onClick={onSubmit}
          disabled={value.length < maxLength || disabled || submitDisabled}
          className="w-full h-16 bg-blue-600 text-white text-xl font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
        >
          Verify
        </button>
      </div>
    </div>
  );
};
