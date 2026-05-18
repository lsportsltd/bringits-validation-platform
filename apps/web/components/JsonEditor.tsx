'use client';

import { useState, useEffect } from 'react';

interface Props {
  value: any;
  onChange: (value: any) => void;
  label?: string;
  height?: string;
  placeholder?: string;
}

export function JsonEditor({ value, onChange, label, height = 'h-48', placeholder }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      setText(JSON.stringify(value, null, 2));
    } catch {
      setText('{}');
    }
  }, []);

  const handleChange = (raw: string) => {
    setText(raw);
    try {
      const parsed = JSON.parse(raw);
      onChange(parsed);
      setError('');
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder || '{}'}
        className={`w-full ${height} font-mono text-sm border rounded-lg p-3 bg-gray-950 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y ${error ? 'border-red-500' : 'border-gray-700'}`}
        spellCheck={false}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
