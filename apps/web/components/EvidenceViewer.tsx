'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface Props {
  evidence: Record<string, any>;
  title?: string;
}

export function EvidenceViewer({ evidence, title = 'Evidence' }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(evidence, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-800 hover:bg-gray-750 text-sm font-medium text-gray-200"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); copy(); }}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </button>
      {expanded && (
        <pre className="p-4 text-xs font-mono text-emerald-300 bg-gray-950 overflow-auto max-h-96">
          {json}
        </pre>
      )}
    </div>
  );
}
