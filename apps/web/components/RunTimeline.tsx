'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { EvidenceViewer } from './EvidenceViewer';
import type { CommandRun } from '@/lib/types';

interface Props {
  commandRuns: CommandRun[];
}

export function RunTimeline({ commandRuns }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-2">
      {commandRuns.map((run, i) => (
        <div key={run.id} className="border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(run.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-750 text-left"
          >
            <span className="text-gray-500 text-xs w-5 text-right">{i + 1}</span>
            <StatusBadge status={run.status} />
            <TypeBadge type={run.type} />
            <span className="font-mono text-sm text-gray-100 flex-1">{run.commandName}</span>
            <span className="text-xs text-gray-400 font-mono">{run.action}</span>
            {run.durationMs !== undefined && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={11} /> {run.durationMs}ms
              </span>
            )}
            {expanded[run.id] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>

          {expanded[run.id] && (
            <div className="p-4 bg-gray-900 space-y-3">
              {run.errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {run.errorMessage}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>Started: <span className="text-gray-300">{new Date(run.startedAt).toLocaleTimeString()}</span></div>
                {run.finishedAt && <div>Finished: <span className="text-gray-300">{new Date(run.finishedAt).toLocaleTimeString()}</span></div>}
                <div>Correlation: <span className="font-mono text-gray-300">{run.correlationId}</span></div>
              </div>
              {run.evidence && Object.keys(run.evidence).length > 0 && (
                <EvidenceViewer evidence={run.evidence} title={`Evidence: ${run.commandName}`} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
